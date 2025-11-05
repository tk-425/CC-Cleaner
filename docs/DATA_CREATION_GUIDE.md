# Claude Code Data Creation Guide

This document explains when Claude Code creates different types of data files and when they become orphaned.

## File History

### When Created
- **Automatically during sessions**: File History is created when Claude Code reads, edits, or analyzes files during a session
- **Version tracking**: Each time a file is modified through Claude Code, a snapshot is saved to `~/.claude/file-history/`
- **Continuous accumulation**: Occurs every time you use Claude Code, regardless of project registration

### Location
```
~/.claude/file-history/
```

### When Orphaned
- When the file-history UUID **does not have a matching session-env directory** in `~/.claude/session-env/`
- When you delete a session but the file history remains
- When a project was used in Claude Code but never formally registered with a UUID (no corresponding session-env)
- Orphaned file history entries can be safely deleted as they no longer correspond to any active session

### Example
1. You start Claude Code in a project directory
2. Claude Code reads and analyzes files → File History is created with a UUID
3. The project is **never formally registered** in `.claude.json` (no session-env created)
4. Result: File History becomes **orphaned** (safe to delete) - matches the logic used for orphaned debug files

---

## Debug Files

### When Created
- **During every Claude Code session**: Debug files are created automatically when you start using Claude Code
- **Session initialization**: When Claude Code starts a session, it creates a debug directory with a unique session UUID
- **Logging**: Contains debug information, logs, and temporary data from that session
- **Automatic process**: No user action required - happens silently in the background

### Location
```
~/.claude/debug/{session-uuid}/
```

### When Orphaned
- When the session's UUID **does not have a matching entry** in `.claude.json`
- **Important**: Just starting Claude Code in a project directory does NOT automatically add it to `.claude.json`
- The project must be explicitly registered through Claude Code features to get a UUID entry
- If a session was created but the project was never registered, those debug files are **orphaned**

### Example
1. You start Claude Code in a project directory
2. Claude Code creates a session with UUID and debug files
3. The project is **never registered** in `.claude.json`
4. Result: Debug files are **orphaned** (safe to delete)

---

## Todos

### When Created
- **User action required**: Todos are created when you explicitly add entries during a Claude Code session
- **Session-specific**: Todos are associated with the project session you're working in
- **Manual creation**: Created by user actions like "Add to todos" or similar features
- **Per-session**: Each session can have its own todo entries

### Location
```
~/.claude/todos/{session-uuid}/
```

### When Orphaned
- When the session's UUID **does not have a matching entry** in `.claude.json`
- When you delete a project from `.claude.json` but todo entries remain
- If a session was created but the project was never formally registered
- Orphaned todos indicate they belong to sessions that no longer have active projects

### Example
1. You start Claude Code in a project directory
2. You add some todos during the session
3. The project is **never registered** in `.claude.json`
4. Result: Todo files are **orphaned** (safe to delete, but you may want to review first)

---

## Session-Env (Environment Data)

### When Created
- **During session initialization**: When Claude Code starts a session for a project
- **Environment setup**: Creates environment-specific data and state for that session
- **Automatic**: Created alongside debug and other session data

### Location
```
~/.claude/session-env/{session-uuid}/
```

### When Orphaned
- When the session UUID **does not have a matching entry** in `.claude.json`
- When the corresponding session directory in `~/.claude/projects/` is deleted

### Automatic Cleanup
- CC-Cleaner automatically removes session-env directories when you delete session data
- No need to manually clean these up

---

## Project Registration in .claude.json

### How Projects Get Registered
When Claude Code scans a project directory, it automatically:
1. Creates a unique session UUID for that project
2. Registers the project in `.claude.json` with the UUID
3. Creates a session-env directory in `~/.claude/session-env/` with the UUID
4. Creates file-history, debug, todos directories with the UUID

### Claude Code Scanning Behavior
When Claude Code first opens/scans a project directory:
- **Immediately**: A UUID is generated and the project is registered in `.claude.json`
- **During session**: File-history, debug files, and todos are created with this UUID
- **Session-env exists**: This is the definitive indicator that Claude Code has formally registered a project

### Important Note
**The presence of session-env with a UUID is the source of truth for active projects.** If a project exists on disk but has no matching session-env UUID, it means Claude Code has never formally scanned/registered that project.

This is why you may see orphaned file-history, debug, and todo files - they were created during a session, but the matching session-env directory no longer exists (was deleted or the session was removed).

---

## How to Identify Orphaned Data

### Using CC-Cleaner
CC-Cleaner automatically identifies orphaned data by:
1. Reading all active session UUIDs from `~/.claude/session-env/` (active sessions)
2. Comparing file/directory UUIDs in `~/.claude/` against active session UUIDs
3. Marking any data without a matching active session as "orphaned"

### Tabs in CC-Cleaner
- **File History**: All file history entries (regardless of active session status)
- **Orphaned File History**: Only entries without a matching active session-env (safe to delete)
- **Debug**: All debug files (regardless of active session status)
- **Orphaned Debug**: Only entries without a matching active session-env (safe to delete)
- **Todos**: All todo entries (regardless of active session status)
- **Orphaned Todos**: Only entries without a matching active session-env (safe to delete)

---

## Safety Considerations

### Safe to Delete
- ✅ Orphaned File History - No longer associated with any project
- ✅ Orphaned Debug - No longer associated with any project
- ✅ Orphaned Todos - No longer associated with any project (but review first if you need the content)
- ✅ Orphaned Session-Env - Automatically cleaned up with sessions

### Should Review Before Deleting
- ⚠️ Orphaned Todos - May contain important information you want to preserve
- ⚠️ File History - Contains version history that may be useful

### Cannot Delete Safely
- ❌ Active Project Data (not orphaned) - Still in use by registered projects
- ❌ Projects still in `.claude.json` - May be needed for Claude Code functionality

---

## Summary Table

| Data Type | Created By | Registration Required | When Orphaned | Safe to Delete |
|-----------|------------|----------------------|---------------|----------------|
| File History | Automatic (file access) | Active session-env | No matching session-env | Yes |
| Debug | Automatic (session start) | Active session-env | No matching session-env | Yes |
| Todos | User action (add todos) | Active session-env | No matching session-env | Yes (review first) |
| Session-Env | Automatic (session init) | Active session | No matching session | Yes |
| Session Data | Automatic (session) | Active session | No matching session | Yes |

