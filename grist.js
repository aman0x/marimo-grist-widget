// ============================================================================
// MARIMO-GRIST WIDGET INTEGRATION
// ============================================================================

// ============================================================================
// COMLINK WORKER INTERCEPTION - Expose grist to Pyodide workers
// ============================================================================

const pendingWorkers = [];
const OriginalWorker = window.Worker;

class GristWorker extends OriginalWorker {
  constructor(scriptURL, options) {
    super(scriptURL, options);
    if (window.grist && window.Comlink) {
      exposeGristToWorker(this);
    } else {
      pendingWorkers.push(this);
    }
  }
}

window.Worker = GristWorker;

function exposeGristToWorker(worker) {
  Comlink.expose(
    {
      grist: {
        ...grist,
        getTable: (tableId) => Comlink.proxy(grist.getTable(tableId)),
      }
    },
    worker
  );
  console.log("✓ Grist API exposed to worker via Comlink");
}

// ============================================================================

const GRIST_OPTION_KEY = "marimo_code";

const KEYWARD_INIT_PY = `from .api import KeywardApi, api
from .table_operations import (
    get_dataframe,
    add_records,
    update_record,
    delete_records,
    create_table,
    remove_table,
    add_column,
    remove_column,
    get_actions_button,
    set_table_name,
    get_table_name,
)

__version__ = "0.1.0"

__all__ = [
    'KeywardApi',
    'api',
    'get_dataframe',
    'add_records',
    'update_record',
    'delete_records',
    'create_table',
    'remove_table',
    'add_column',
    'remove_column',
    'get_actions_button',
    'set_table_name',
    'get_table_name',
]
`;

const KEYWARD_TABLE_OPS_PY = `import json
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
`;

const KEYWARD_API_PY = `import pandas as pd
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
`;

const SETUP_CODE = `
import sys
if "/marimo" not in sys.path:
    sys.path.insert(0, "/marimo")

GRIST_DATA_PATH = "data.json"

def send_grist_actions(actions):
    from marimo._messaging.notification import UIElementMessageNotification
    from marimo._messaging.serde import serialize_kernel_message
    from marimo._runtime.context import get_context
    from marimo import ui

    if len(actions) == 0:
        return
    assert isinstance(actions[0], list) or isinstance(actions[0], tuple), (
        "You must provide a list of actions"
    )

    msg = UIElementMessageNotification(
        ui_element="grist",
        model_id=None,
        message={"actions": actions},
    )

    kernel_msg = serialize_kernel_message(msg)
    ctx = get_context()
    return ui.run_button(
        label="update grist table",
        on_change=lambda x: ctx.stream.write(kernel_msg)
    )
`;

const NOTEBOOK_BASE = `# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "pandas",
#     "matplotlib",
#     "polars",
# ]
# ///

import marimo

__generated_with = "0.19.0"
app = marimo.App(width="medium")

with app.setup(hide_code=True):
    ${SETUP_CODE.split("\n").join("\n    ")}
`;

// Default empty notebook template
const POLARS_NOTEBOOK = `${NOTEBOOK_BASE}
@app.cell()
def _():
    import polars as pl
    import json
    return (pd,json)


@app.cell()
def _(pd):
    with open(GRIST_DATA_PATH) as f:
        df = pl.DataFrame(json.load(f))
    df
`;

const DEFAULT_NOTEBOOK = `${NOTEBOOK_BASE}
@app.cell()
def _():
    import pandas as pd
    return (pd,)


@app.cell()
def _(pd):
    df = pd.read_json(GRIST_DATA_PATH).set_index("id")
    df
`;

const DATA_DUPLICATION_NOTEBOOK = `${NOTEBOOK_BASE}
@app.cell()
def _():
    import pandas as pd
    return (pd,)


@app.cell()
def _(pd):
    df = pd.read_json(GRIST_DATA_PATH).set_index("id")
    df

@app.cell()
def _(pd, df, send_grist_actions):
    CURRENT_TABLE_NAME = "Table1"
    send_grist_actions([
        ["AddRecord", CURRENT_TABLE_NAME, None, dict(d)] for _, d in df.iterrows()
    ])
`;

const NOTEBOOK_TEMPLATES = {
  default: DEFAULT_NOTEBOOK,
  polars: POLARS_NOTEBOOK,
  duplicate: DATA_DUPLICATION_NOTEBOOK,
};

let bridge = null;
let pendingRecords = null;
let hasTableAccess = false;

// ============================================================================
// MARIMO INITIALIZATION
// ============================================================================

async function initializeMarimo(savedCode) {
  const code = savedCode || DEFAULT_NOTEBOOK;
  localStorage.setItem("marimo:file", JSON.stringify(code));

  // Set marimo mount config with our code
  window.__MARIMO_MOUNT_CONFIG__ = {
    filename: "notebook.py",
    mode: "edit",
    version: "0.19.4",
    serverToken: "unused",
    // code: JSON.stringify(code),
    config: {
      ai: {
        custom_providers: {},
        models: { custom_models: [], displayed_models: [] },
      },
      completion: {
        activate_on_typing: true,
        copilot: false,
        signature_hint_on_typing: false,
      },
      diagnostics: { sql_linter: true },
      display: {
        cell_output: "below",
        code_editor_font_size: 14,
        dataframes: "rich",
        default_table_max_columns: 50,
        default_table_page_size: 10,
        default_width: "medium",
        reference_highlighting: false,
        theme: "system",
      },
      formatting: { line_length: 79 },
      keymap: { overrides: {}, preset: "default" },
      language_servers: {
        pylsp: {
          enable_flake8: false,
          enable_mypy: true,
          enable_pydocstyle: false,
          enable_pyflakes: false,
          enable_pylint: false,
          enable_ruff: true,
          enabled: false,
        },
      },
      mcp: { mcpServers: {}, presets: [] },
      package_management: { manager: "uv" },
      runtime: {
        auto_instantiate: true,
        auto_reload: "off",
        default_sql_output: "auto",
        on_cell_change: "autorun",
        output_max_bytes: 8000000,
        reactive_tests: true,
        std_stream_max_bytes: 1000000,
        watcher_on_save: "lazy",
      },
      save: {
        autosave: "after_delay",
        autosave_delay: 1000,
        format_on_save: false,
      },
      server: { browser: "default", follow_symlink: false },
      snippets: { custom_paths: [], include_default_snippets: true },
    },
    configOverrides: {},
    appConfig: { sql_output: "auto", width: "medium" },
    view: { showAppCode: true },
    notebook: null,
    session: null,
    runtimeConfig: null,
  };

  const script = document.createElement("script");
  script.type = "module";
  script.crossOrigin = "anonymous";
  script.src = window.__MARIMO_ENTRYPOINT_URL__;
  document.head.appendChild(script);

  // Wait for bridge to be available
  console.info("WAIT FOR BRIDGE");
  await waitForBridge();
  bridge.rpc.addMessageListener("kernelMessage", handleKernelMessage);

  // Inject keyward package before any code runs
  await injectKeywardPackage();
  console.info("SETUP DONE");

  // Check permissions and show error if needed
  if (!hasTableAccess) {
    console.error("Widget does not have permission to read the table");
    console.log(bridge);
    await bridge.sendRun({
      cellIds: ["setup"],
      codes: [
        'raise ValueError("This widget does not have permission to read the table. Please change the widget permissions")',
      ],
    });
  }

  // Sync any records that arrived before bridge was ready
  if (pendingRecords) {
    console.log("Syncing pending records from initial load...");
    await syncGristData(pendingRecords);
    pendingRecords = null;
  }
}

function waitForBridge() {
  return new Promise((resolve) => {
    const checkBridge = setInterval(() => {
      if (window._marimo_private_PyodideBridge) {
        bridge = window._marimo_private_PyodideBridge;
        clearInterval(checkBridge);
        resolve();
      }
    }, 100);
  });
}

// ============================================================================
// RPC LISTENERS
// ============================================================================

function handleKernelMessage({ message }) {
  const data = JSON.parse(message).data;

  // Handle Grist actions from marimo
  if (data.op === "send-ui-element-message" && data.ui_element === "grist") {
    const actions = data.message.actions;
    grist.docApi.applyUserActions(actions);
  }
}

// ============================================================================
// KEYWARD PACKAGE INJECTION
// ============================================================================

async function injectKeywardPackage() {
  if (!bridge) {
    console.warn("Bridge not ready, cannot inject keyward package");
    return;
  }

  console.log("Injecting keyward package into Pyodide filesystem...");

  await bridge.sendUpdateFile({
    path: "/marimo/keyward/__init__.py",
    contents: KEYWARD_INIT_PY,
  });

  await bridge.sendUpdateFile({
    path: "/marimo/keyward/table_operations.py",
    contents: KEYWARD_TABLE_OPS_PY,
  });

  await bridge.sendUpdateFile({
    path: "/marimo/keyward/api.py",
    contents: KEYWARD_API_PY,
  });

  console.log("✓ Keyward package injected successfully");
}

// ============================================================================
// GRIST DATA SYNC
// ============================================================================

async function syncGristData(records) {
  if (!bridge) {
    console.warn("Bridge not ready, skipping data sync");
    return;
  }

  console.log("Syncing Grist data to marimo...");

  // Write data to pyodide filesystem
  await bridge.sendUpdateFile({
    path: "data.json",
    contents: JSON.stringify(records),
  });

  // Run setup cell to update GRIST_DATA_PATH
  await bridge.sendRun({
    cellIds: ["setup"],
    codes: [SETUP_CODE],
  });

  console.log("✓ Data synced successfully");
}

// ============================================================================
// GRIST INTEGRATION
// ============================================================================

grist.ready({
  requiredAccess: "full",
  // TODO: show button to chose notebook template
  onEditOptions: async () => {
    console.warn("options not implemented");
  },
});

// Expose grist to any workers that were created before grist was ready
for (const worker of pendingWorkers) {
  exposeGristToWorker(worker);
}
pendingWorkers.length = 0;

// Sync data when table updates
grist.onRecords(async (records) => {
  if (!bridge) {
    console.log("Bridge not ready yet, storing records for later sync...");
    pendingRecords = records;
    return;
  }
  await syncGristData(records);
});

grist.onOptions(async (options, settings) => {
  if (settings.accessLevel != "none") {
    hasTableAccess = true;
  }
});

window.addEventListener("hashchange", async function () {
  const hash = window.location.hash;
  const match_template = hash.match(/\#grist_marimo_template\/(.*)/)?.at(1);
  const match_code = hash.match(/\#code\/(.*)/)?.at(1);
  if (match_template) {
    if (NOTEBOOK_TEMPLATES[match_template] === null) {
      console.error(`template not found: ${match_template}`);
      return;
    }
    await grist.setOption(GRIST_OPTION_KEY, NOTEBOOK_TEMPLATES[match_template]);
    window.location.reload();
  }
  if (match_code) {
    const notebook_code =
      LZString.decompressFromEncodedURIComponent(match_code);
    grist.setOption(GRIST_OPTION_KEY, notebook_code);
  }
});

async function init() {
  // Always load fresh template (ignore saved code)
  await initializeMarimo(null);
  console.log("Marimo-Grist widget initialized");
}

init();
