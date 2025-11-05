# Claude Code Cleaner

A modern web-based GUI tool to manage and clean Claude Code projects. Built with Vue 3, Vite, and Node.js. Helps you clean up session data, identify orphaned projects, and manage your Claude Code configuration.

⚠️ **DISCLAIMER**: This tool modifies Claude Code's configuration and data files. While all deleted items are moved to your system trash (and can be recovered), **use this tool carefully**. We are not responsible for any data loss or issues that may occur from using this tool. Always ensure you have backups before performing bulk operations, and verify your actions before confirming deletions.

## Features

- **Projects Tab**: View all projects from `.claude.json` with metadata (cost, duration, status) and related session-env directories
- **Session Data Tab**: Browse and move session data to trash from `~/.claude/projects/` directory, automatically cleaning related session-env data
- **File History Tab**: View and clean up file history entries from `~/.claude/file-history/` (version history and snapshots from Claude Code sessions)
- **Orphaned File History Tab**: Find and remove orphaned file history entries that don't correspond to any active projects (safe to delete)
- **Orphaned Projects Tab**: Find and move orphaned session data to trash (doesn't correspond to any project), including related session-env directories
- **Config Backups Tab**: View, restore, and manage `.claude.json` backups
- **Full .claude Directory Backup**: Create complete backups of your entire `.claude` directory (projects, session data, configuration, etc.) with a single click
- **Session Environment Tracking**: Displays and automatically cleans up session-env directories associated with each project/session
- **Bulk Operations**: Select multiple items and move them to trash in batch
- **Safe Operations**: All destructive operations require confirmation
- **Automatic Backups**: Creates timestamped backups of `.claude.json` before each operation
- **Trash Instead of Delete**: All removed items go to your system trash bin (recoverable)
- **Easy Restoration**: Restore any previous backup instantly with one click

## Tech Stack

- **Frontend**: Vue 3 with Composition API
- **Build Tool**: Vite 5
- **Backend**: Express.js with ES modules
- **File Operations**: trash-cli for safe deletion
- **Platform Support**: macOS and Linux

## Installation

1. Clone or navigate to the CC-Cleaner directory
2. Install dependencies:
```bash
npm install
```

## Usage

### Development Mode

For development with hot reload:

```bash
# Terminal 1: Start the Vite dev server
npm run dev

# Terminal 2: Start the Express server
node server.js
```

Then open http://localhost:5173 in your browser.

### Production Mode

```bash
# Build the frontend
npm run build

# Start the server (serves built frontend + API)
npm start
```

Then open http://localhost:3000 in your browser.

## Using CC-Cleaner

Once the app is running, you can use the tabs to:
   - **Projects (.claude.json)**: View all registered projects, see their metadata, related session-env directories, and remove them from configuration
   - **Session Data (.claude/projects)**: View session data for projects with their session-env count, select multiple sessions, and clean them (automatically removes related session-env data)
   - **File History**: View file history entries from `~/.claude/file-history/` (version history and snapshots from Claude Code sessions). These accumulate over time and can be safely cleaned up to save disk space
   - **Orphaned File History**: View file history entries that don't correspond to any active projects. These are safe to delete as they're no longer associated with any active projects
   - **Orphaned Projects**: View projects with session data but no entry in .claude.json, and delete them safely (automatically removes related session-env data)

### Full .claude Directory Backup
Click the **"Create Backup"** button in the header to create a complete backup of your Claude Code data. This backs up:
- The entire `.claude` directory (projects, session data, configuration, session-env, etc.)
- The `.claude.json` configuration file

Each backup creates two files:
- `.claude-YYYY-MM-DD_HH-MM-SS` (directory) - Complete copy of your `.claude` folder
- `.claude-YYYY-MM-DD_HH-MM-SS.json` (file) - Copy of your `.claude.json` file

Backups are stored in `~/.cc-cleaner/backup/` with timestamps for easy identification. We recommend creating a full backup before performing bulk operations.

### Session Environment Data
Each session/project can have associated session-env directories stored in `~/.claude/session-env/`. These directories are automatically tracked and cleaned up when you remove session data. The UI shows the count and list of related session-env directories for transparency.

## What Gets Moved to Trash

### Session Data
Moving session data to trash removes:
- Session files from `~/.claude/projects/`
- Related session-env directories from `~/.claude/session-env/`
- Debug information
- History
- Cache files
- Other temporary Claude Code data

This does **NOT** affect your actual project files. All items are moved to your system trash bin and can be permanently deleted or recovered from there.

### Orphaned Projects
These are session directories that exist in `~/.claude/projects/` but don't have a corresponding entry in `.claude.json`. Safe to move to trash. Also removes any related session-env directories. They'll be in your system trash bin for recovery if needed.

### Removing from Configuration
This removes a project from `.claude.json` (configuration is backed up before changes). Note: This only removes the project from configuration and does NOT delete the session data or session-env directories. Use the Session Data or Orphaned tabs if you want to delete those files.

## API Endpoints

### Projects & Sessions
- `GET /api/projects/json` - Get projects from .claude.json
- `GET /api/projects/sessions` - Get session data directories
- `GET /api/projects/orphaned` - Get orphaned projects
- `POST /api/clean/session` - Clean a single session (creates backup)
- `POST /api/clean/sessions` - Clean multiple sessions (creates backup)
- `POST /api/remove/project` - Remove project from .claude.json (creates backup)

### File History
- `GET /api/projects/file-history` - Get all file history entries
- `GET /api/projects/orphaned-file-history` - Get orphaned file history entries (not associated with active projects)
- `POST /api/clean/file-history` - Clean a single file history entry (creates backup)
- `POST /api/clean/file-histories` - Clean multiple file history entries (creates backup)
- `POST /api/clean/orphaned-file-history` - Clean a single orphaned file history entry (creates backup)
- `POST /api/clean/orphaned-file-histories` - Clean multiple orphaned file history entries (creates backup)

### Backups & Statistics
- `GET /api/stats` - Get statistics (project count, sizes, orphaned counts, etc.)
- `GET /api/backups` - Get list of config backups
- `POST /api/restore/backup` - Restore a backup file
- `POST /api/backup/full-claude` - Create full backup of .claude directory

## Safety Features

- ✅ Confirmation dialogs for all destructive operations
- ✅ Items moved to trash (not permanently deleted)
- ✅ Recover deleted items from system trash bin anytime
- ✅ **Automatic timestamped backups** of `.claude.json` before every operation
- ✅ **Full directory backups** (`.claude` folder + `.claude.json`) with one click
- ✅ **One-click backup restoration** if anything goes wrong
- ✅ All backups stored safely in `~/.cc-cleaner/` directory
- ✅ Dual-backup on restore (current state backed up before restoring old state)
- ✅ No modification to actual project files
- ✅ Session data is isolated from project data

## Tips

- Start by cleaning orphaned projects (they're moved to trash, safe and recoverable)
- Old session data from inactive projects can usually be safely moved to trash
- Always verify the project exists before removing it from configuration
- All items moved to trash can be recovered from your system trash bin
- Backing up your `.claude.json` is recommended before bulk operations

## Requirements

- **Node.js**: v14 or higher
- **Operating System**: macOS or Linux
- **Permissions**: Read/write access to `~/.claude/` directory and `~/` home directory

## Troubleshooting

**Port already in use**: Change the PORT in `server.js`

**Permission denied errors**: Ensure you have read/write access to `~/.claude/` directory

**Projects not showing**: Check that `.claude.json` exists and is readable

**Not working on Windows**: This tool is designed for macOS and Linux. Windows support would require modifications to the directory size calculation and file operations.

## Project Structure

```
CC-Cleaner/
├── server.js              # Express backend (ES modules)
├── vite.config.js         # Vite configuration
├── package.json           # Dependencies
├── index.html             # Entry HTML file
├── README.md              # This file
├── .gitignore             # Git ignore file
├── src/
│   ├── main.js           # Vue app entry point
│   └── App.vue           # Main Vue component
├── dist/                 # Built frontend (generated)
└── public/               # Static assets (if needed)

Backups are stored in: ~/.cc-cleaner/backup/
```

## Development

### Frontend
Edit `src/App.vue` for UI changes. The Vite dev server provides hot reload.

### Backend
Edit `server.js` for API changes. Uses ES modules for modern JavaScript.

### Building
```bash
npm run build
```

This generates optimized production files in the `dist/` directory.
