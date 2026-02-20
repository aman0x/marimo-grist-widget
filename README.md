# Keyward Marimo Widget

A Marimo notebook widget for Grist with the Keyward API for table operations.

## How It Works

### Architecture

Unlike JupyterLite (which uses Comlink to bridge Python and JavaScript), Marimo WASM runs in a module script context where `importScripts()` is blocked. This widget uses a **file-based approach**:

1. **Data Sync (Grist → Python)**: JavaScript writes table data to `data.json`, Python reads from it
2. **Actions (Python → Grist)**: Python queues actions, sends via `UIElementMessageNotification`, JavaScript intercepts and applies via `grist.docApi.applyUserActions()`

### Keyward Package Injection

The keyward package is embedded directly in `SETUP_CODE` within `grist.js`. When the Marimo notebook's setup cell runs, it:

1. Creates `/marimo/keyward/` directory
2. Writes `__init__.py`, `table_operations.py`, and `api.py`
3. Adds `/marimo` to `sys.path`

This ensures keyward is available before any user cells run.

## Usage

### Get Table Data

```python
from keyward import api
df = api.get_table()
df
```

### Add Records

```python
from keyward import api
api.add_record({"Name": "Test", "Value": 123})
api.apply_button()  # Click the button to apply
```

### Update Records

```python
from keyward import api
api.update_record(1, {"Name": "Updated"})
api.apply_button()
```

### Delete Records

```python
from keyward import api
api.delete_record(1)
api.apply_button()
```

### Bulk Operations

```python
from keyward import api
records = [{"Name": "A"}, {"Name": "B"}, {"Name": "C"}]
api.bulk_add_records(records)
api.apply_button()
```

### Set Target Table

```python
from keyward import api
api.table_name = "MyTable"
```

## Key Files

- `grist.js` - Main integration code, contains:
  - `SETUP_CODE` - Creates keyward package, sets up `send_grist_actions()`
  - `NOTEBOOK_BASE` - Default notebook template
  - `syncGristData()` - Writes data to `data.json`
  - `handleKernelMessage()` - Intercepts Python actions and sends to Grist

- `main.py` - Build script that exports Marimo assets and creates `dist/`

## Important Notes

1. **No Comlink/Browser API**: The grist Python module from JupyterLite does NOT work in Marimo due to `importScripts()` being blocked in module scripts.

2. **File-based data exchange**: Data flows through `data.json`, not direct API calls.

3. **Action queue pattern**: Actions are queued in Python, then sent via a button click to Grist.

4. **Setup cell timing**: The setup cell must run before other cells to ensure keyward is available.

## Deployment

```bash
uv run python main.py
git add -A && git commit -m "Update" && git push
```

GitHub Actions deploys to GitHub Pages automatically.
