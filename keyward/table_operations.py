import json
import pandas as pd
from typing import Any, Dict, List, Optional, Union

GRIST_DATA_PATH = "data.json"
_current_table_name = "Table1"
_pending_actions = []


def set_table_name(name: str):
    global _current_table_name
    _current_table_name = name


def get_table_name() -> str:
    return _current_table_name


def get_dataframe() -> pd.DataFrame:
    try:
        with open(GRIST_DATA_PATH) as f:
            data = json.load(f)
        return pd.DataFrame(data).set_index("id")
    except FileNotFoundError:
        return pd.DataFrame()
    except Exception as e:
        print(f"Error reading data: {e}")
        return pd.DataFrame()


def _queue_action(action: List[Any]):
    global _pending_actions
    _pending_actions.append(action)


def _get_pending_actions() -> List[List[Any]]:
    return _pending_actions.copy()


def _clear_pending_actions():
    global _pending_actions
    _pending_actions = []


def add_records(records: Union[Dict[str, Any], List[Dict[str, Any]]], table_name: Optional[str] = None) -> List[List[Any]]:
    if isinstance(records, dict):
        records = [records]

    table = table_name or _current_table_name
    actions = []

    for record in records:
        actions.append(["AddRecord", table, None, record])

    for action in actions:
        _queue_action(action)

    return actions


def update_record(row_id: int, updates: Dict[str, Any], table_name: Optional[str] = None) -> List[Any]:
    table = table_name or _current_table_name
    action = ["UpdateRecord", table, row_id, updates]
    _queue_action(action)
    return action


def update_records(updates: List[Dict[str, Any]], table_name: Optional[str] = None) -> List[List[Any]]:
    actions = []
    for update in updates:
        row_id = update.get('id')
        if row_id is None:
            continue
        data = {k: v for k, v in update.items() if k != 'id'}
        action = update_record(row_id, data, table_name)
        actions.append(action)
    return actions


def delete_records(row_ids: Union[int, List[int]], table_name: Optional[str] = None) -> List[List[Any]]:
    if isinstance(row_ids, int):
        row_ids = [row_ids]

    table = table_name or _current_table_name
    actions = []

    for row_id in row_ids:
        action = ["RemoveRecord", table, row_id]
        _queue_action(action)
        actions.append(action)

    return actions


def create_table(table_name: str, columns: Dict[str, str]) -> List[List[Any]]:
    actions = [["AddTable", table_name, []]]

    for label, col_type in columns.items():
        field_id = "ID_field" if label.strip().lower() == "id" else label
        actions.append([
            "AddVisibleColumn", table_name, field_id,
            {"type": col_type, "label": label, "widgetOptions": "", "formula": ""}
        ])

    for action in actions:
        _queue_action(action)

    return actions


def remove_table(table_name: str) -> List[Any]:
    action = ["RemoveTable", table_name]
    _queue_action(action)
    return action


def add_column(col_id: str, col_type: str = "Text", label: Optional[str] = None, table_name: Optional[str] = None) -> List[Any]:
    table = table_name or _current_table_name
    action = [
        "AddVisibleColumn", table, col_id,
        {"type": col_type, "label": label or col_id, "widgetOptions": "", "formula": ""}
    ]
    _queue_action(action)
    return action


def remove_column(col_id: str, table_name: Optional[str] = None) -> List[Any]:
    table = table_name or _current_table_name
    action = ["RemoveColumn", table, col_id]
    _queue_action(action)
    return action


def replace_table_data(data: Dict[str, List[Any]], table_name: Optional[str] = None) -> List[Any]:
    table = table_name or _current_table_name
    action = ["ReplaceTableData", table, [], data]
    _queue_action(action)
    return action


def bulk_add_records(records: List[Dict[str, Any]], table_name: Optional[str] = None) -> List[Any]:
    if not records:
        return []

    table = table_name or _current_table_name
    columns = set()
    for record in records:
        columns.update(record.keys())

    bulk_data = {}
    for col in columns:
        bulk_data[col] = [record.get(col) for record in records]

    action = ["BulkAddRecord", table, [None] * len(records), bulk_data]
    _queue_action(action)
    return action


def get_actions_button(clear_after: bool = True):
    from marimo._messaging.notification import UIElementMessageNotification
    from marimo._messaging.serde import serialize_kernel_message
    from marimo._runtime.context import get_context
    from marimo import ui

    actions = _get_pending_actions()

    if len(actions) == 0:
        return ui.text("No pending actions")

    if clear_after:
        _clear_pending_actions()

    msg = UIElementMessageNotification(
        ui_element="grist",
        model_id=None,
        message={"actions": actions},
    )

    kernel_msg = serialize_kernel_message(msg)
    ctx = get_context()

    return ui.run_button(
        label=f"Apply {len(actions)} action(s) to Grist",
        on_change=lambda x: ctx.stream.write(kernel_msg)
    )
