# Keyward Marimo Widget

A Marimo notebook widget for Grist with the Keyward API for table operations.

## Quick Start

```python
# Table auto-detected from Grist
print("Table:", api.table_name)

# Add records
api.add_record({"Column": "value"})
api.add_records([{"Column": "a"}, {"Column": "b"}])
api.bulk_add_records([{"Column": "x"}, {"Column": "y"}])

# Update/Delete
api.update_record(row_id, {"Column": "new_value"})
api.delete_record(row_id)

# Apply all changes
print("Applied:", api.apply_now())
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

## Architecture

- **Data Sync**: Grist → `data.json` → Python
- **Actions**: Python → `UIElementMessageNotification` → Grist
- **Package**: Keyward injected via SETUP_CODE at runtime

## Deployment

```bash
python3 main.py
git add -A && git commit -m "Update" && git push
```

GitHub Actions deploys to GitHub Pages automatically.
