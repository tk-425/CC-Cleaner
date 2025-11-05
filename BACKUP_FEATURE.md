# Config Backup Feature

## Overview

CC-Cleaner now automatically creates backups of your `.claude.json` configuration file whenever you perform any cleanup or modification operation. This ensures you can always revert to a previous state if something goes wrong.

## How It Works

### Automatic Backups

Backups are **automatically created** before any of these operations:
1. **Clean Session Data** - Moving session data to trash
2. **Remove Projects** - Removing projects from `.claude.json`
3. **Restore Backup** - Restoring a previous backup (creates backup of current state first)

### Backup Location

All backups are stored in:
```
~/.claude/config-copy/
```

### Backup Naming

Backups are named with the format:
```
.claude.copy.YYYY-MM-DD_HH-MM-SS.json
```

Example:
```
.claude.copy.2024-11-04_15-30-45.json
```

This naming makes it easy to identify when each backup was created.

## Using Backups

### Viewing Backups

1. Open CC-Cleaner
2. Click on the **"Config Backups"** tab
3. See a list of all available backups with:
   - Filename with timestamp
   - File size
   - Created and modified dates

### Restoring a Backup

1. Go to the **"Config Backups"** tab
2. Find the backup you want to restore
3. Click the **"Restore"** button
4. Confirm the restoration in the dialog
5. The backup will be restored, and your current config will be backed up too

## Safety Features

✅ **Dual Backups**: When restoring a backup, the current `.claude.json` is automatically backed up first
✅ **Never Loses Data**: All backups are preserved, never deleted
✅ **Transparent Process**: You see backup filenames in success messages
✅ **Easy Recovery**: All backups are listed and sortable by date

## Example Workflow

```
1. You remove some projects from CC-Cleaner
   ↓
   Backup created: .claude.copy.2024-11-04_14-30-00.json
   ↓
2. Later you realize you made a mistake
   ↓
3. Go to Config Backups tab
   ↓
4. Click "Restore" on the backup
   ↓
   Current config backed up as: .claude.copy.2024-11-04_15-45-12.json
   Old config restored!
   ↓
5. All your removed projects are back
```

## Technical Details

- Backups are standard JSON files
- You can manually inspect any backup by opening it with a text editor
- Backups are stored in the same location as other Claude Code config data
- Filenames use ISO 8601 date format for sorting and readability
- All timestamps are in local time
