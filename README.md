# Keyward Marimo Widget

A Marimo notebook widget for Grist with the Keyward API for table operations.

## Quick Start

```python
print("Table:", api.table_name)

api.add_record({"Column": "value"})
api.add_records([{"Column": "a"}, {"Column": "b"}])
api.bulk_add_records([{"Column": "x"}, {"Column": "y"}])
api.update_record(row_id, {"Column": "new_value"})
api.delete_record(row_id)

print("Applied:", api.apply_now())
```

## Full Demo

```python
print("1. Table:", api.table_name)

api.add_record({"Air_FC_T_In": 111.1, "Air_FC_T_Out": 222.2})
print("2. Added 1 record")

api.add_records([
    {"Air_FC_T_In": 333.3, "Elec_FC_I": 10},
    {"Air_FC_T_In": 444.4, "Elec_FC_I": 20}
])
print("3. Added 2 records")

api.bulk_add_records([
    {"Air_FC_T_In": 555.5},
    {"Air_FC_T_In": 666.6},
    {"Air_FC_T_In": 777.7}
])
print("4. Bulk added 3 records")

api.update_record(1, {"Air_FC_T_In": 999.9})
print("5. Updated row 1")

api.delete_record(3)
print("6. Deleted row 3")

print("7. Pending:", len(api.get_pending_actions()))
print("8. Applied:", api.apply_now())

"Done"
```

## API Reference

| Method | Description |
|--------|-------------|
| `api.table_name` | Get/set target table (auto-detected) |
| `api.get_table()` | Get DataFrame (avoid with large tables) |
| `api.add_record({})` | Add single record |
| `api.add_records([])` | Add multiple records |
| `api.bulk_add_records([])` | Bulk add (single action, efficient) |
| `api.update_record(id, {})` | Update record by row ID |
| `api.delete_record(id)` | Delete record by row ID |
| `api.delete_records([ids])` | Delete multiple records |
| `api.get_pending_actions()` | View queued actions |
| `api.apply_now()` | Apply all pending actions |
| `api.query(filters, columns, limit)` | Query with filters |

## Important Notes

1. **Add and apply in same cell** - Pending actions reset between cells
2. **Avoid `get_table()` with large tables** - Can be slow with 10K+ rows
3. **Table auto-detects** - No need to set `api.table_name` manually
4. **Duplicate prevention** - `apply_now()` prevents duplicate submissions

## Architecture

- **Data Sync**: Grist → `data.json` → Python (500ms debounce)
- **Actions**: Python → `UIElementMessageNotification` → Grist
- **Package**: Keyward injected via SETUP_CODE at runtime

## Deployment

```bash
python3 main.py
git add -A && git commit -m "Update" && git push
```

GitHub Actions deploys to GitHub Pages automatically.
