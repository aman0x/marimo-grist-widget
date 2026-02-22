# Keyward Projects Index

| Project | Description | Docs | Status |
|---------|-------------|------|--------|
| marimo-grist-widget | Marimo notebook widget for Grist | [README](./README.md) | ✅ Complete |

## Features

| Feature | Status |
|---------|--------|
| Auto-detect table name | ✅ |
| Add record | ✅ |
| Add multiple records | ✅ |
| Bulk add records | ✅ |
| Update record | ✅ |
| Delete record | ✅ |
| apply_now() | ✅ |
| Duplicate prevention | ✅ |
| Debounced sync | ✅ |

## Issues Fixed

| Issue | Fix |
|-------|-----|
| Table name hardcoded | Auto-detect from Grist |
| apply_now not available | Added to KEYWARD constants |
| Duplicate action loop | Hash check prevents re-send |
| Rapid sync causing loop | 500ms debounce |
