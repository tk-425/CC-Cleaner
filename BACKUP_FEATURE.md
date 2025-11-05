# Backup Features

## Overview

CC-Cleaner provides two types of backups to protect your Claude Code data:

1. **Config Backups** - Automatic `.claude.json` backups before each operation
2. **Full Directory Backups** - Complete backups of your entire `.claude` folder and `.claude.json` file

All backups are stored centrally in `~/.cc-cleaner/` for easy management.

## Data Types Managed by CC-Cleaner

CC-Cleaner can help you manage and clean up the following types of Claude Code data:

- **Projects**: Configurations stored in `.claude.json`
- **Session Data**: Active and orphaned session directories in `~/.claude/projects/`
- **Session Environment Data**: Environment-specific data in `~/.claude/session-env/`
- **File History**: Version history and snapshots from `~/.claude/file-history/`
- **Debug Files**: Debug information and logs from sessions
- **Todos**: Todo entries from Claude Code sessions

Each data type can be individually reviewed, selected via checkboxes, and managed in bulk operations. The app distinguishes between active data (linked to projects) and orphaned data (no longer associated with any project).

## Config Backups

### How It Works

Config backups are **automatically created** before any of these operations:
1. **Clean Session Data** - Moving session data to trash
2. **Remove Projects** - Removing projects from `.claude.json`
3. **Restore Backup** - Restoring a previous backup (creates backup of current state first)

### Backup Location

All config backups are stored in:
```
~/.cc-cleaner/config-copy/
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

## Full Directory Backups

### How It Works

Click the **"Create Backup"** button in the header to create a complete backup of your entire Claude Code setup. This backs up:
- The entire `.claude` directory (projects, session data, configuration, etc.)
- The `.claude.json` configuration file

We recommend creating a full backup before performing bulk operations.

### Backup Location

All full backups are stored in:
```
~/.cc-cleaner/backup/
```

### Backup Naming

Full backups are created with timestamps in this format:
```
.claude-YYYY-MM-DD_HH-MM-SS          (directory)
.claude-YYYY-MM-DD_HH-MM-SS.json     (config file)
```

Example:
```
.claude-2024-11-04_15-30-45/         (complete .claude directory)
.claude-2024-11-04_15-30-45.json     (config file)
```

Both files use matching timestamps so they're clearly related.

## Using Backups

### Viewing Config Backups

1. Open CC-Cleaner
2. Click on the **"Config Backups"** tab
3. See a list of all available automatic config backups with:
   - Filename with timestamp
   - File size
   - Created and modified dates

### Viewing Full Directory Backups

Full directory backups are stored in `~/.cc-cleaner/backup/` and can be accessed directly from your file system. Each backup contains:
- A `.claude-YYYY-MM-DD_HH-MM-SS` directory with the complete `.claude` folder contents
- A `.claude-YYYY-MM-DD_HH-MM-SS.json` file with your configuration

### Restoring a Config Backup

1. Go to the **"Config Backups"** tab
2. Find the config backup you want to restore
3. Click the **"Restore"** button
4. Confirm the restoration in the dialog
5. The backup will be restored, and your current config will be backed up too

### Restoring a Full Directory Backup

Full directory backups can be restored manually:
1. Open your file system and navigate to `~/.cc-cleaner/backup/`
2. Find the backup you want to restore (using the timestamp)
3. Copy the `.claude-YYYY-MM-DD_HH-MM-SS` directory back to `~/.claude`
4. Copy the `.claude-YYYY-MM-DD_HH-MM-SS.json` file back to `~/.claude.json`

Alternatively, you can use the terminal:
```bash
cp -r ~/.cc-cleaner/backup/.claude-YYYY-MM-DD_HH-MM-SS ~/.claude
cp ~/.cc-cleaner/backup/.claude-YYYY-MM-DD_HH-MM-SS.json ~/.claude.json
```

## Safety Features

✅ **Multiple Backup Layers**: Both automatic config backups and manual full directory backups
✅ **Dual Backups on Restore**: When restoring a config backup, the current state is automatically backed up first
✅ **Never Loses Data**: All backups are preserved, never deleted
✅ **Transparent Process**: You see backup filenames in success messages
✅ **Easy Recovery**: Config backups listed in UI, full backups accessible via file system
✅ **Timestamped**: All backups include creation time for easy identification

## Example Workflows

### Workflow 1: Quick Config Recovery
```
1. Before bulk operations, click "Create Backup" button
   ↓
   Backup created: .claude-2024-11-04_14-30-00/
   Backup created: .claude-2024-11-04_14-30-00.json
   ↓
2. You perform bulk cleanup operations
   ↓
3. If something goes wrong, restore from ~/.cc-cleaner/backup/
   ↓
4. Both .claude directory and .claude.json are restored
```

### Workflow 2: Config-Only Recovery
```
1. You remove some projects from CC-Cleaner
   ↓
   Automatic backup created: .claude.copy.2024-11-04_14-30-00.json
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

### Config Backups
- Backups are standard JSON files
- You can manually inspect any backup by opening it with a text editor
- Filenames use ISO 8601 date format (`YYYY-MM-DD_HH-MM-SS`) for sorting and readability
- All timestamps are in local time

### Full Directory Backups
- Complete recursive copy of the entire `.claude` directory structure
- Includes all files and subdirectories (projects, session data, etc.)
- Config file is backed up separately with matching timestamp
- Stored as regular directories and files (not compressed)
- Can be restored manually via file system or terminal commands
- Timestamps on both directory and file allow easy identification

### Storage Location
All backups are centrally stored in `~/.cc-cleaner/`:
```
~/.cc-cleaner/
├── config-copy/          # Automatic .claude.json backups
│   ├── .claude.copy.2024-11-04_14-30-00.json
│   ├── .claude.copy.2024-11-04_15-45-12.json
│   └── ...
└── backup/              # Full directory backups
    ├── .claude-2024-11-04_14-30-00/
    ├── .claude-2024-11-04_14-30-00.json
    └── ...
```
