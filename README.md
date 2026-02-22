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

## API Reference

```python
from keyward import api
```

### Table Management

```python
api.table_name = "Table1"    # Set target table
api.get_table()              # Get DataFrame of current table
```

### Single Record Operations

```python
api.add_record({"Name": "Test", "Value": 123})
api.update_record(row_id, {"Name": "Updated"})
api.delete_record(row_id)
```

### Multiple Records

```python
api.add_records([{"Name": "A"}, {"Name": "B"}])
api.update_records([{"id": 1, "Name": "X"}, {"id": 2, "Name": "Y"}])
api.delete_records([1, 2, 3])
```

### Bulk Operations (Single Action)

```python
api.bulk_add_records([{"Name": "A"}, {"Name": "B"}, {"Name": "C"}])
```

### Table Structure

```python
api.create_table("NewTable", {"Name": "Text", "Value": "Numeric"})
api.remove_table("TableName")
api.add_column("col_id", "Text", "Label")
api.remove_column("col_id")
```

### Query

```python
api.query(filters={"Name": "Test"}, columns=["Name", "Value"], limit=10)
```

### Apply Actions

```python
api.apply_now()      # Auto-apply immediately (returns action count)
api.apply_button()   # Returns a button to manually apply
```

### Pending Actions

```python
api.get_pending_actions()    # View queued actions
api.clear_pending_actions()  # Clear without applying
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

3. **Auto-apply**: Use `api.apply_now()` to apply actions immediately without a button click.

4. **Fresh templates**: Widget always loads fresh templates on initialization.

## Deployment

```bash
uv run python main.py
git add -A && git commit -m "Update" && git push
```

GitHub Actions deploys to GitHub Pages automatically.
