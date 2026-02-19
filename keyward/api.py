import pandas as pd
from typing import Any, Dict, List, Optional, Union
from .table_operations import (
    get_dataframe,
    add_records as _add_records,
    update_record as _update_record,
    update_records as _update_records,
    delete_records as _delete_records,
    create_table as _create_table,
    remove_table as _remove_table,
    add_column as _add_column,
    remove_column as _remove_column,
    replace_table_data as _replace_table_data,
    bulk_add_records as _bulk_add_records,
    get_actions_button,
    set_table_name,
    get_table_name,
    _get_pending_actions,
    _clear_pending_actions,
)


class KeywardApi:
    def __init__(self, table_name: Optional[str] = None):
        if table_name:
            set_table_name(table_name)

    @property
    def table_name(self) -> str:
        return get_table_name()

    @table_name.setter
    def table_name(self, name: str):
        set_table_name(name)

    def get_table(self) -> pd.DataFrame:
        return get_dataframe()

    def add_record(self, record: Dict[str, Any], table_name: Optional[str] = None) -> List[Any]:
        actions = _add_records(record, table_name)
        return actions[0] if actions else []

    def add_records(self, records: List[Dict[str, Any]], table_name: Optional[str] = None) -> List[List[Any]]:
        return _add_records(records, table_name)

    def bulk_add_records(self, records: List[Dict[str, Any]], table_name: Optional[str] = None) -> List[Any]:
        return _bulk_add_records(records, table_name)

    def update_record(self, row_id: int, updates: Dict[str, Any], table_name: Optional[str] = None) -> List[Any]:
        return _update_record(row_id, updates, table_name)

    def update_records(self, updates: List[Dict[str, Any]], table_name: Optional[str] = None) -> List[List[Any]]:
        return _update_records(updates, table_name)

    def delete_record(self, row_id: int, table_name: Optional[str] = None) -> List[Any]:
        actions = _delete_records(row_id, table_name)
        return actions[0] if actions else []

    def delete_records(self, row_ids: List[int], table_name: Optional[str] = None) -> List[List[Any]]:
        return _delete_records(row_ids, table_name)

    def create_table(self, table_name: str, columns: Dict[str, str]) -> List[List[Any]]:
        return _create_table(table_name, columns)

    def remove_table(self, table_name: str) -> List[Any]:
        return _remove_table(table_name)

    def add_column(self, col_id: str, col_type: str = "Text", label: Optional[str] = None, table_name: Optional[str] = None) -> List[Any]:
        return _add_column(col_id, col_type, label, table_name)

    def remove_column(self, col_id: str, table_name: Optional[str] = None) -> List[Any]:
        return _remove_column(col_id, table_name)

    def replace_table_data(self, data: Dict[str, List[Any]], table_name: Optional[str] = None) -> List[Any]:
        return _replace_table_data(data, table_name)

    def create_from_dataframe(self, table_name: str, df: pd.DataFrame) -> List[List[Any]]:
        type_mapping = {
            'int64': 'Numeric',
            'int32': 'Numeric',
            'float64': 'Numeric',
            'float32': 'Numeric',
            'bool': 'Bool',
            'datetime64[ns]': 'Date',
            'object': 'Text',
            'category': 'Text',
        }

        columns = {col: type_mapping.get(str(dt), 'Text') for col, dt in df.dtypes.items()}
        actions = _create_table(table_name, columns)

        records = df.where(pd.notna(df), None).to_dict('records')
        if records:
            actions.extend(_add_records(records, table_name))

        return actions

    def get_pending_actions(self) -> List[List[Any]]:
        return _get_pending_actions()

    def clear_pending_actions(self):
        _clear_pending_actions()

    def apply_button(self):
        return get_actions_button()

    def query(self, filters: Optional[Dict[str, Any]] = None, columns: Optional[List[str]] = None, limit: Optional[int] = None) -> pd.DataFrame:
        df = get_dataframe()

        if filters:
            for col, val in filters.items():
                if col in df.columns:
                    df = df[df[col] == val]

        if columns:
            available_cols = [c for c in columns if c in df.columns]
            df = df[available_cols]

        if limit and limit > 0:
            df = df.head(limit)

        return df


api = KeywardApi()
