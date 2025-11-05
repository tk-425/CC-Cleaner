import express from 'express';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import trash from 'trash';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist')));

const HOME = os.homedir();
const CLAUDE_JSON_PATH = path.join(HOME, '.claude.json');
const CLAUDE_DIR = path.join(HOME, '.claude');
const PROJECTS_DIR = path.join(HOME, '.claude', 'projects');
const SESSION_ENV_DIR = path.join(HOME, '.claude', 'session-env');
const FILE_HISTORY_DIR = path.join(HOME, '.claude', 'file-history');
const DEBUG_DIR = path.join(HOME, '.claude', 'debug');
const TODOS_DIR = path.join(HOME, '.claude', 'todos');
const CC_CLEANER_DIR = path.join(HOME, '.cc-cleaner');
const CONFIG_BACKUP_DIR = path.join(HOME, '.cc-cleaner', 'config-copy');
const CC_CLEANER_BACKUP_DIR = path.join(HOME, '.cc-cleaner', 'backup');

// Ensure required directories exist
if (!fs.existsSync(CC_CLEANER_DIR)) {
  fs.mkdirSync(CC_CLEANER_DIR, { recursive: true });
}
if (!fs.existsSync(CONFIG_BACKUP_DIR)) {
  fs.mkdirSync(CONFIG_BACKUP_DIR, { recursive: true });
}
if (!fs.existsSync(SESSION_ENV_DIR)) {
  fs.mkdirSync(SESSION_ENV_DIR, { recursive: true });
}
if (!fs.existsSync(CC_CLEANER_BACKUP_DIR)) {
  fs.mkdirSync(CC_CLEANER_BACKUP_DIR, { recursive: true });
}

// Helper function to get directory size (cross-platform: macOS and Linux)
function getDirSize(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) return 0;

    let result;
    if (process.platform === 'darwin') {
      // macOS: du -sk returns size in kilobytes
      result = execSync(`du -sk "${dirPath}" 2>/dev/null | awk '{print $1}'`, { encoding: 'utf-8' }).trim();
      return (parseInt(result) || 0) * 1024; // Convert from KB to bytes
    } else {
      // Linux: du -sb returns size in bytes (GNU coreutils)
      result = execSync(`du -sb "${dirPath}" 2>/dev/null | awk '{print $1}'`, { encoding: 'utf-8' }).trim();
      return parseInt(result) || 0;
    }
  } catch {
    return 0;
  }
}

// Helper function to format bytes
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Helper function to recursively copy a directory (deep copy)
function copyDirRecursive(src, dest) {
  try {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }

    const files = fs.readdirSync(src);
    for (const file of files) {
      const srcPath = path.join(src, file);
      const destPath = path.join(dest, file);
      const stat = fs.statSync(srcPath);

      if (stat.isDirectory()) {
        copyDirRecursive(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
    return true;
  } catch (error) {
    console.error('Error copying directory:', error);
    return false;
  }
}

// Helper function to create a backup of .claude.json
function createConfigBackup() {
  try {
    if (!fs.existsSync(CLAUDE_JSON_PATH)) {
      return null;
    }

    // Format: .claude.copy.<YYYY-MM-DD_HH-MM-SS>.json
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
    const backupFileName = `.claude.copy.${dateStr}_${timeStr}.json`;
    const backupPath = path.join(CONFIG_BACKUP_DIR, backupFileName);

    // Copy the file
    fs.copyFileSync(CLAUDE_JSON_PATH, backupPath);

    return {
      filename: backupFileName,
      path: backupPath,
      timestamp: now.toISOString(),
      size: fs.statSync(backupPath).size
    };
  } catch (error) {
    console.error('Error creating config backup:', error);
    return null;
  }
}

// Get list of config backups
function getConfigBackups() {
  try {
    if (!fs.existsSync(CONFIG_BACKUP_DIR)) {
      return [];
    }

    const files = fs.readdirSync(CONFIG_BACKUP_DIR)
      .filter(f => f.startsWith('.claude.copy.') && f.endsWith('.json'))
      .map(filename => {
        const fullPath = path.join(CONFIG_BACKUP_DIR, filename);
        const stat = fs.statSync(fullPath);
        return {
          filename,
          path: fullPath,
          size: stat.size,
          created: stat.birthtime.toISOString(),
          modified: stat.mtime.toISOString()
        };
      })
      .sort((a, b) => new Date(b.modified) - new Date(a.modified));

    return files;
  } catch (error) {
    console.error('Error reading config backups:', error);
    return [];
  }
}

// Get projects from .claude.json
function getJsonProjects() {
  try {
    const data = JSON.parse(fs.readFileSync(CLAUDE_JSON_PATH, 'utf-8'));
    return Object.keys(data.projects || {}).map(projectPath => {
      // Check if there's a corresponding session directory
      const encodedPath = encodePathForSession(projectPath);
      const sessionDirPath = path.join(PROJECTS_DIR, encodedPath);
      const sessionEnvs = fs.existsSync(sessionDirPath) ? getRelatedSessionEnvs(encodedPath) : [];

      return {
        path: projectPath,
        exists: fs.existsSync(projectPath),
        config: data.projects[projectPath],
        sessionEnvs: sessionEnvs
      };
    });
  } catch (error) {
    console.error('Error reading .claude.json:', error);
    return [];
  }
}

// Get session data directories
function getSessionProjects() {
  try {
    if (!fs.existsSync(PROJECTS_DIR)) return [];

    const dirs = fs.readdirSync(PROJECTS_DIR);
    return dirs
      .filter(dir => {
        // Skip system files and hidden files
        if (dir.startsWith('.')) return false;

        const fullPath = path.join(PROJECTS_DIR, dir);
        // Only include directories
        try {
          return fs.statSync(fullPath).isDirectory();
        } catch {
          return false;
        }
      })
      .map(dir => {
        const fullPath = path.join(PROJECTS_DIR, dir);
        // Decode the directory name back to actual path
        const decodedPath = dir.replace(/-/g, '/').replace(/\//g, (match, offset) => {
          if (offset === 0) return '/';
          return dir[offset - 1] === '-' ? '/' : '-';
        });
        // Better decoding: directories are stored as -path-like-this
        const actualPath = '/' + dir.substring(1).split('-').join('/');

        // Get related session-env directories
        const relatedSessionEnvs = getRelatedSessionEnvs(dir);

        return {
          dir: dir,
          actualPath: actualPath,
          fullPath: fullPath,
          size: getDirSize(fullPath),
          files: fs.readdirSync(fullPath).length,
          sessionEnvs: relatedSessionEnvs
        };
      });
  } catch (error) {
    console.error('Error reading projects directory:', error);
    return [];
  }
}

// Helper function to extract session UUIDs from a project's session directory
function getSessionUuidsForProject(sessionDirName) {
  try {
    const projectPath = path.join(PROJECTS_DIR, sessionDirName);
    if (!fs.existsSync(projectPath)) return [];

    const files = fs.readdirSync(projectPath);
    // Session files are named like UUID.jsonl or UUID (directories)
    return files
      .filter(file => {
        // UUID pattern: 8-4-4-4-12 hex characters
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/.test(file.toLowerCase());
      })
      .map(uuid => uuid.split('.')[0]); // Remove .jsonl extension if present
  } catch (error) {
    console.error('Error extracting session UUIDs:', error);
    return [];
  }
}

// Helper function to find related session-env directories for a project
function getRelatedSessionEnvs(sessionDirName) {
  try {
    const uuids = getSessionUuidsForProject(sessionDirName);

    if (!fs.existsSync(SESSION_ENV_DIR)) return [];

    const sessionEnvDirs = fs.readdirSync(SESSION_ENV_DIR);

    // Return only session-env dirs that match this project's UUIDs
    return sessionEnvDirs.filter(dir => uuids.includes(dir.toLowerCase()));
  } catch (error) {
    console.error('Error getting related session-env:', error);
    return [];
  }
}

// Helper function to encode paths for comparison (case-insensitive)
// Converts project path to lowercase session directory format for matching
function encodePathForSession(projectPath) {
  // Remove leading slash, replace all non-alphanumeric with -, and convert to lowercase
  return '-' + projectPath.substring(1).replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
}

// Get orphaned projects (in .claude/projects but not in .claude.json)
function getOrphanedProjects() {
  const jsonProjects = getJsonProjects();
  const sessionProjects = getSessionProjects();

  return sessionProjects.filter(session => {
    // Check if this session directory corresponds to any project in .claude.json
    // Compare in lowercase to handle case variations reliably
    const sessionDirLowercase = session.dir.toLowerCase();
    return !jsonProjects.some(jsonProject => {
      const encodedPath = encodePathForSession(jsonProject.path);
      return sessionDirLowercase === encodedPath;
    });
  });
}

// Helper function to find related file-history directories for a project
function getRelatedFileHistory(sessionDirName) {
  try {
    const uuids = getSessionUuidsForProject(sessionDirName);

    if (!fs.existsSync(FILE_HISTORY_DIR)) return [];

    const fileHistoryDirs = fs.readdirSync(FILE_HISTORY_DIR);

    // Return only file-history dirs that match this project's UUIDs
    return fileHistoryDirs.filter(dir => uuids.includes(dir.toLowerCase()));
  } catch (error) {
    console.error('Error getting related file-history:', error);
    return [];
  }
}

// Get all UUIDs from all projects
function getAllProjectUuids() {
  try {
    const uuids = new Set();
    const sessions = getSessionProjects();

    for (const session of sessions) {
      const sessionUuids = getSessionUuidsForProject(session.dir);
      sessionUuids.forEach(uuid => uuids.add(uuid.toLowerCase()));
    }

    return uuids;
  } catch (error) {
    console.error('Error getting all project UUIDs:', error);
    return new Set();
  }
}

// Get file-history data
function getFileHistoryProjects() {
  try {
    if (!fs.existsSync(FILE_HISTORY_DIR)) return [];

    const dirs = fs.readdirSync(FILE_HISTORY_DIR);
    return dirs
      .filter(dir => {
        // Skip system files and hidden files
        if (dir.startsWith('.')) return false;

        const fullPath = path.join(FILE_HISTORY_DIR, dir);
        // Only include directories
        try {
          return fs.statSync(fullPath).isDirectory();
        } catch {
          return false;
        }
      })
      .map(dir => {
        const fullPath = path.join(FILE_HISTORY_DIR, dir);

        // Get related session-env directories for this UUID
        const relatedSessionEnvs = [];
        if (fs.existsSync(SESSION_ENV_DIR)) {
          const sessionEnvDirs = fs.readdirSync(SESSION_ENV_DIR);
          const matchingSessionEnvs = sessionEnvDirs.filter(env => env.toLowerCase() === dir.toLowerCase());
          relatedSessionEnvs.push(...matchingSessionEnvs);
        }

        return {
          dir: dir,
          fullPath: fullPath,
          size: getDirSize(fullPath),
          files: fs.readdirSync(fullPath).length,
          sessionEnvs: relatedSessionEnvs
        };
      });
  } catch (error) {
    console.error('Error reading file-history directory:', error);
    return [];
  }
}

// Get orphaned file-history (file-history dirs not matching any active project UUID)
function getOrphanedFileHistory() {
  try {
    if (!fs.existsSync(FILE_HISTORY_DIR)) return [];

    const allProjectUuids = getAllProjectUuids();
    const dirs = fs.readdirSync(FILE_HISTORY_DIR);

    return dirs
      .filter(dir => {
        // Skip system files and hidden files
        if (dir.startsWith('.')) return false;

        const fullPath = path.join(FILE_HISTORY_DIR, dir);
        // Only include directories
        try {
          if (!fs.statSync(fullPath).isDirectory()) return false;
        } catch {
          return false;
        }

        // Check if this UUID exists in any active project
        return !allProjectUuids.has(dir.toLowerCase());
      })
      .map(dir => {
        const fullPath = path.join(FILE_HISTORY_DIR, dir);

        // Get related session-env directories for this UUID
        const relatedSessionEnvs = [];
        if (fs.existsSync(SESSION_ENV_DIR)) {
          const sessionEnvDirs = fs.readdirSync(SESSION_ENV_DIR);
          const matchingSessionEnvs = sessionEnvDirs.filter(env => env.toLowerCase() === dir.toLowerCase());
          relatedSessionEnvs.push(...matchingSessionEnvs);
        }

        return {
          dir: dir,
          fullPath: fullPath,
          size: getDirSize(fullPath),
          files: fs.readdirSync(fullPath).length,
          sessionEnvs: relatedSessionEnvs
        };
      });
  } catch (error) {
    console.error('Error reading orphaned file-history:', error);
    return [];
  }
}

// Get debug files
function getDebugFiles() {
  try {
    if (!fs.existsSync(DEBUG_DIR)) return [];

    const files = fs.readdirSync(DEBUG_DIR);
    return files
      .filter(file => {
        // Skip system files and hidden files
        if (file.startsWith('.')) return false;
        // Skip the "latest" file
        if (file === 'latest') return false;

        const fullPath = path.join(DEBUG_DIR, file);
        // Only include files, not directories
        try {
          return fs.statSync(fullPath).isFile();
        } catch {
          return false;
        }
      })
      .map(file => {
        const fullPath = path.join(DEBUG_DIR, file);
        const stats = fs.statSync(fullPath);

        return {
          filename: file,
          fullPath: fullPath,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime
        };
      })
      .sort((a, b) => new Date(b.modified) - new Date(a.modified)); // Sort by newest first
  } catch (error) {
    console.error('Error reading debug directory:', error);
    return [];
  }
}

// Get orphaned debug files (files that don't correspond to any active session)
function getOrphanedDebugFiles() {
  try {
    if (!fs.existsSync(DEBUG_DIR)) return [];

    // Get all active session UUIDs
    const allSessionUuids = new Set();
    if (fs.existsSync(SESSION_ENV_DIR)) {
      const sessionEnvDirs = fs.readdirSync(SESSION_ENV_DIR);
      sessionEnvDirs.forEach(dir => {
        if (!dir.startsWith('.')) {
          allSessionUuids.add(dir.toLowerCase());
        }
      });
    }

    // Get debug files
    const files = fs.readdirSync(DEBUG_DIR);
    return files
      .filter(file => {
        // Skip system files and hidden files
        if (file.startsWith('.')) return false;
        // Skip the "latest" file
        if (file === 'latest') return false;

        const fullPath = path.join(DEBUG_DIR, file);
        // Only include files
        try {
          if (!fs.statSync(fullPath).isFile()) return false;
        } catch {
          return false;
        }

        // Extract UUID from filename (format: UUID.txt or similar)
        const fileUuid = file.split('.')[0];

        // Check if this UUID exists in any active session
        return !allSessionUuids.has(fileUuid.toLowerCase());
      })
      .map(file => {
        const fullPath = path.join(DEBUG_DIR, file);
        const stats = fs.statSync(fullPath);

        return {
          filename: file,
          fullPath: fullPath,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime
        };
      })
      .sort((a, b) => new Date(b.modified) - new Date(a.modified)); // Sort by newest first
  } catch (error) {
    console.error('Error reading orphaned debug files:', error);
    return [];
  }
}

// Get todos files
function getTodosFiles() {
  try {
    if (!fs.existsSync(TODOS_DIR)) return [];

    // Get all active session UUIDs
    const allSessionUuids = new Set();
    if (fs.existsSync(SESSION_ENV_DIR)) {
      const sessionEnvDirs = fs.readdirSync(SESSION_ENV_DIR);
      sessionEnvDirs.forEach(dir => {
        if (!dir.startsWith('.')) {
          allSessionUuids.add(dir.toLowerCase());
        }
      });
    }

    const files = fs.readdirSync(TODOS_DIR);
    return files
      .filter(file => {
        // Skip system files and hidden files
        if (file.startsWith('.')) return false;

        const fullPath = path.join(TODOS_DIR, file);
        // Only include files, not directories
        try {
          return fs.statSync(fullPath).isFile();
        } catch {
          return false;
        }
      })
      .map(file => {
        const fullPath = path.join(TODOS_DIR, file);
        const stats = fs.statSync(fullPath);

        // Extract UUID from filename
        const fileUuid = file.split('-agent-')[0];

        return {
          filename: file,
          fullPath: fullPath,
          uuid: fileUuid,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime
        };
      })
      .sort((a, b) => new Date(b.modified) - new Date(a.modified)); // Sort by newest first
  } catch (error) {
    console.error('Error reading todos files:', error);
    return [];
  }
}

// Get orphaned todos files (files that don't correspond to any active session)
function getOrphanedTodosFiles() {
  try {
    if (!fs.existsSync(TODOS_DIR)) return [];

    // Get all active session UUIDs
    const allSessionUuids = new Set();
    if (fs.existsSync(SESSION_ENV_DIR)) {
      const sessionEnvDirs = fs.readdirSync(SESSION_ENV_DIR);
      sessionEnvDirs.forEach(dir => {
        if (!dir.startsWith('.')) {
          allSessionUuids.add(dir.toLowerCase());
        }
      });
    }

    const files = fs.readdirSync(TODOS_DIR);
    return files
      .filter(file => {
        // Skip system files and hidden files
        if (file.startsWith('.')) return false;

        const fullPath = path.join(TODOS_DIR, file);
        // Only include files
        try {
          if (!fs.statSync(fullPath).isFile()) return false;
        } catch {
          return false;
        }

        // Extract UUID from filename (format: <UUID>-agent-<UUID>.json)
        const fileUuid = file.split('-agent-')[0];

        // Check if this UUID exists in any active session
        return !allSessionUuids.has(fileUuid.toLowerCase());
      })
      .map(file => {
        const fullPath = path.join(TODOS_DIR, file);
        const stats = fs.statSync(fullPath);

        // Extract UUID from filename
        const fileUuid = file.split('-agent-')[0];

        return {
          filename: file,
          fullPath: fullPath,
          uuid: fileUuid,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime
        };
      })
      .sort((a, b) => new Date(b.modified) - new Date(a.modified)); // Sort by newest first
  } catch (error) {
    console.error('Error reading orphaned todos files:', error);
    return [];
  }
}

// API Endpoints
app.get('/api/projects/json', (req, res) => {
  const projects = getJsonProjects().map(p => ({
    ...p,
    hasSession: fs.existsSync(path.join(PROJECTS_DIR, encodePath(p.path)))
  }));
  res.json(projects);
});

app.get('/api/projects/sessions', (req, res) => {
  const sessions = getSessionProjects();
  res.json(sessions);
});

app.get('/api/projects/orphaned', (req, res) => {
  const orphaned = getOrphanedProjects();
  // Add session-env info to orphaned projects
  const orphanedWithSessionEnvs = orphaned.map(project => ({
    ...project,
    sessionEnvs: getRelatedSessionEnvs(project.dir)
  }));
  res.json(orphanedWithSessionEnvs);
});

app.get('/api/projects/file-history', (req, res) => {
  const fileHistory = getFileHistoryProjects();
  res.json(fileHistory);
});

app.get('/api/projects/orphaned-file-history', (req, res) => {
  const orphanedFileHistory = getOrphanedFileHistory();
  res.json(orphanedFileHistory);
});

app.get('/api/projects/debug', (req, res) => {
  const debugFiles = getDebugFiles();
  res.json(debugFiles);
});

app.get('/api/projects/orphaned-debug', (req, res) => {
  const orphanedDebug = getOrphanedDebugFiles();
  res.json(orphanedDebug);
});

app.get('/api/projects/todos', (req, res) => {
  const todos = getTodosFiles();
  res.json(todos);
});

app.get('/api/projects/orphaned-todos', (req, res) => {
  const orphanedTodos = getOrphanedTodosFiles();
  res.json(orphanedTodos);
});

app.get('/api/stats', (req, res) => {
  const jsonProjects = getJsonProjects();
  const sessions = getSessionProjects();
  const orphaned = getOrphanedProjects();
  const fileHistory = getFileHistoryProjects();
  const orphanedFileHistory = getOrphanedFileHistory();
  const debugFiles = getDebugFiles();
  const orphanedDebugFiles = getOrphanedDebugFiles();
  const todos = getTodosFiles();
  const orphanedTodos = getOrphanedTodosFiles();

  const totalSessionSize = sessions.reduce((sum, s) => sum + s.size, 0);
  const orphanedSize = orphaned.reduce((sum, o) => sum + o.size, 0);
  const totalProjectsSize = getDirSize(CLAUDE_DIR);
  const totalFileHistorySize = fileHistory.reduce((sum, f) => sum + f.size, 0);
  const orphanedFileHistorySize = orphanedFileHistory.reduce((sum, f) => sum + f.size, 0);
  const totalDebugSize = debugFiles.reduce((sum, f) => sum + f.size, 0);
  const orphanedDebugSize = orphanedDebugFiles.reduce((sum, f) => sum + f.size, 0);
  const totalTodosSize = todos.reduce((sum, f) => sum + f.size, 0);
  const orphanedTodosSize = orphanedTodos.reduce((sum, f) => sum + f.size, 0);

  res.json({
    totalProjects: jsonProjects.length,
    projectsWithSessions: jsonProjects.filter(p => p.exists && fs.existsSync(path.join(PROJECTS_DIR, encodePath(p.path)))).length,
    totalSessionSize: totalSessionSize,
    totalProjectsSize: totalProjectsSize,
    formatBytes: formatBytes(totalSessionSize),
    formatProjectsBytes: formatBytes(totalProjectsSize),
    orphanedCount: orphaned.length,
    orphanedSize: orphanedSize,
    fileHistoryCount: fileHistory.length,
    fileHistorySize: totalFileHistorySize,
    formatFileHistoryBytes: formatBytes(totalFileHistorySize),
    orphanedFileHistoryCount: orphanedFileHistory.length,
    orphanedFileHistorySize: orphanedFileHistorySize,
    formatOrphanedFileHistoryBytes: formatBytes(orphanedFileHistorySize),
    debugCount: debugFiles.length,
    debugSize: totalDebugSize,
    formatDebugBytes: formatBytes(totalDebugSize),
    orphanedDebugCount: orphanedDebugFiles.length,
    orphanedDebugSize: orphanedDebugSize,
    formatOrphanedDebugBytes: formatBytes(orphanedDebugSize),
    todosCount: todos.length,
    todosSize: totalTodosSize,
    formatTodosBytes: formatBytes(totalTodosSize),
    orphanedTodosCount: orphanedTodos.length,
    orphanedTodosSize: orphanedTodosSize,
    formatOrphanedTodosBytes: formatBytes(orphanedTodosSize)
  });
});

// Get config backups
app.get('/api/backups', (req, res) => {
  const backups = getConfigBackups();
  res.json(backups);
});

// Create full backup of .claude directory and .claude.json
app.post('/api/backup/full-claude', (req, res) => {
  try {
    if (!fs.existsSync(CLAUDE_DIR)) {
      return res.status(400).json({ success: false, message: '.claude directory not found' });
    }

    // Create backup with timestamp
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
    const timestamp = `${dateStr}_${timeStr}`;

    // Backup .claude directory
    const claudeDirBackupName = `.claude-${timestamp}`;
    const claudeDirBackupPath = path.join(CC_CLEANER_BACKUP_DIR, claudeDirBackupName);

    const success = copyDirRecursive(CLAUDE_DIR, claudeDirBackupPath);
    if (!success) {
      return res.status(500).json({ success: false, message: 'Failed to backup .claude directory' });
    }

    // Backup .claude.json file
    const claudeJsonBackupName = `.claude-${timestamp}.json`;
    const claudeJsonBackupPath = path.join(CC_CLEANER_BACKUP_DIR, claudeJsonBackupName);

    if (fs.existsSync(CLAUDE_JSON_PATH)) {
      fs.copyFileSync(CLAUDE_JSON_PATH, claudeJsonBackupPath);
    }

    // Calculate total backup size
    const claudeDirSize = getDirSize(claudeDirBackupPath);
    const claudeJsonSize = fs.existsSync(claudeJsonBackupPath) ? fs.statSync(claudeJsonBackupPath).size : 0;
    const totalSize = claudeDirSize + claudeJsonSize;

    res.json({
      success: true,
      message: `Full backup created successfully`,
      timestamp: timestamp,
      backups: {
        claudeDir: claudeDirBackupName,
        claudeJson: claudeJsonBackupName
      },
      location: CC_CLEANER_BACKUP_DIR,
      totalSize: formatBytes(totalSize),
      createdAt: now.toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Helper to encode paths like the .claude/projects directory does
function encodePath(projectPath) {
  return projectPath.split('/').join('-');
}

// Clean up session data (move to trash) - creates backup first
app.post('/api/clean/session', async (req, res) => {
  const { dir } = req.body;
  const fullPath = path.join(PROJECTS_DIR, dir);

  try {
    // Create backup before cleanup
    const backup = createConfigBackup();

    if (fs.existsSync(fullPath)) {
      const pathsToTrash = [fullPath];

      // Also collect related session-env directories
      const relatedSessionEnvs = getRelatedSessionEnvs(dir);
      for (const sessionEnv of relatedSessionEnvs) {
        const sessionEnvPath = path.join(SESSION_ENV_DIR, sessionEnv);
        if (fs.existsSync(sessionEnvPath)) {
          pathsToTrash.push(sessionEnvPath);
        }
      }

      await trash(pathsToTrash);
      res.json({
        success: true,
        message: `Moved ${dir} and ${relatedSessionEnvs.length} related session-env(s) to trash`,
        sessionEnvsMoved: relatedSessionEnvs,
        backup: backup
      });
    } else {
      res.json({ success: false, message: 'Directory not found' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Clean multiple sessions (move to trash) - creates backup first
app.post('/api/clean/sessions', async (req, res) => {
  const { dirs } = req.body;
  const results = [];

  try {
    // Create backup before cleanup
    const backup = createConfigBackup();

    const pathsToTrash = [];
    const allSessionEnvsMoved = [];

    for (const dir of dirs) {
      const fullPath = path.join(PROJECTS_DIR, dir);
      if (fs.existsSync(fullPath)) {
        pathsToTrash.push(fullPath);

        // Also collect related session-env directories
        const relatedSessionEnvs = getRelatedSessionEnvs(dir);
        for (const sessionEnv of relatedSessionEnvs) {
          const sessionEnvPath = path.join(SESSION_ENV_DIR, sessionEnv);
          if (fs.existsSync(sessionEnvPath)) {
            pathsToTrash.push(sessionEnvPath);
            allSessionEnvsMoved.push(sessionEnv);
          }
        }

        results.push({ dir, success: true, sessionEnvs: relatedSessionEnvs });
      } else {
        results.push({ dir, success: false, reason: 'Not found' });
      }
    }

    if (pathsToTrash.length > 0) {
      await trash(pathsToTrash);
    }

    res.json({ success: true, results, sessionEnvsMoved: allSessionEnvsMoved, backup: backup });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Clean up file-history data (move to trash) - creates backup first
app.post('/api/clean/file-history', async (req, res) => {
  const { dir } = req.body;
  const fullPath = path.join(FILE_HISTORY_DIR, dir);

  try {
    // Create backup before cleanup
    const backup = createConfigBackup();

    if (fs.existsSync(fullPath)) {
      const pathsToTrash = [fullPath];

      // Also collect related session-env directories
      const relatedSessionEnvs = [];
      if (fs.existsSync(SESSION_ENV_DIR)) {
        const sessionEnvDirs = fs.readdirSync(SESSION_ENV_DIR);
        const matchingSessionEnvs = sessionEnvDirs.filter(env => env.toLowerCase() === dir.toLowerCase());
        for (const sessionEnv of matchingSessionEnvs) {
          const sessionEnvPath = path.join(SESSION_ENV_DIR, sessionEnv);
          if (fs.existsSync(sessionEnvPath)) {
            pathsToTrash.push(sessionEnvPath);
            relatedSessionEnvs.push(sessionEnv);
          }
        }
      }

      await trash(pathsToTrash);
      res.json({
        success: true,
        message: `Moved ${dir} and ${relatedSessionEnvs.length} related session-env(s) to trash`,
        sessionEnvsMoved: relatedSessionEnvs,
        backup: backup
      });
    } else {
      res.json({ success: false, message: 'Directory not found' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Clean multiple file-history entries (move to trash) - creates backup first
app.post('/api/clean/file-histories', async (req, res) => {
  const { dirs } = req.body;
  const results = [];

  try {
    // Create backup before cleanup
    const backup = createConfigBackup();

    const pathsToTrash = [];
    const allSessionEnvsMoved = [];

    for (const dir of dirs) {
      const fullPath = path.join(FILE_HISTORY_DIR, dir);
      if (fs.existsSync(fullPath)) {
        pathsToTrash.push(fullPath);

        // Also collect related session-env directories
        if (fs.existsSync(SESSION_ENV_DIR)) {
          const sessionEnvDirs = fs.readdirSync(SESSION_ENV_DIR);
          const matchingSessionEnvs = sessionEnvDirs.filter(env => env.toLowerCase() === dir.toLowerCase());
          for (const sessionEnv of matchingSessionEnvs) {
            const sessionEnvPath = path.join(SESSION_ENV_DIR, sessionEnv);
            if (fs.existsSync(sessionEnvPath)) {
              pathsToTrash.push(sessionEnvPath);
              allSessionEnvsMoved.push(sessionEnv);
            }
          }
        }

        results.push({ dir, success: true, sessionEnvs: [] });
      } else {
        results.push({ dir, success: false, reason: 'Not found' });
      }
    }

    if (pathsToTrash.length > 0) {
      await trash(pathsToTrash);
    }

    res.json({ success: true, results, sessionEnvsMoved: allSessionEnvsMoved, backup: backup });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Clean up orphaned file-history (move to trash) - creates backup first
app.post('/api/clean/orphaned-file-history', async (req, res) => {
  const { dir } = req.body;
  const fullPath = path.join(FILE_HISTORY_DIR, dir);

  try {
    // Create backup before cleanup
    const backup = createConfigBackup();

    if (fs.existsSync(fullPath)) {
      const pathsToTrash = [fullPath];

      // Also collect related session-env directories
      const relatedSessionEnvs = [];
      if (fs.existsSync(SESSION_ENV_DIR)) {
        const sessionEnvDirs = fs.readdirSync(SESSION_ENV_DIR);
        const matchingSessionEnvs = sessionEnvDirs.filter(env => env.toLowerCase() === dir.toLowerCase());
        for (const sessionEnv of matchingSessionEnvs) {
          const sessionEnvPath = path.join(SESSION_ENV_DIR, sessionEnv);
          if (fs.existsSync(sessionEnvPath)) {
            pathsToTrash.push(sessionEnvPath);
            relatedSessionEnvs.push(sessionEnv);
          }
        }
      }

      await trash(pathsToTrash);
      res.json({
        success: true,
        message: `Moved orphaned file-history ${dir} and ${relatedSessionEnvs.length} related session-env(s) to trash`,
        sessionEnvsMoved: relatedSessionEnvs,
        backup: backup
      });
    } else {
      res.json({ success: false, message: 'Directory not found' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Clean multiple orphaned file-history entries (move to trash) - creates backup first
app.post('/api/clean/orphaned-file-histories', async (req, res) => {
  const { dirs } = req.body;
  const results = [];

  try {
    // Create backup before cleanup
    const backup = createConfigBackup();

    const pathsToTrash = [];
    const allSessionEnvsMoved = [];

    for (const dir of dirs) {
      const fullPath = path.join(FILE_HISTORY_DIR, dir);
      if (fs.existsSync(fullPath)) {
        pathsToTrash.push(fullPath);

        // Also collect related session-env directories
        if (fs.existsSync(SESSION_ENV_DIR)) {
          const sessionEnvDirs = fs.readdirSync(SESSION_ENV_DIR);
          const matchingSessionEnvs = sessionEnvDirs.filter(env => env.toLowerCase() === dir.toLowerCase());
          for (const sessionEnv of matchingSessionEnvs) {
            const sessionEnvPath = path.join(SESSION_ENV_DIR, sessionEnv);
            if (fs.existsSync(sessionEnvPath)) {
              pathsToTrash.push(sessionEnvPath);
              allSessionEnvsMoved.push(sessionEnv);
            }
          }
        }

        results.push({ dir, success: true, sessionEnvs: [] });
      } else {
        results.push({ dir, success: false, reason: 'Not found' });
      }
    }

    if (pathsToTrash.length > 0) {
      await trash(pathsToTrash);
    }

    res.json({ success: true, results, sessionEnvsMoved: allSessionEnvsMoved, backup: backup });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Clean debug file (move to trash)
app.post('/api/clean/debug', async (req, res) => {
  const { filename } = req.body;
  const fullPath = path.join(DEBUG_DIR, filename);

  try {
    // Validate debug file exists and is in the debug directory
    if (!fs.existsSync(fullPath) || !fullPath.startsWith(DEBUG_DIR)) {
      return res.status(400).json({ success: false, message: 'Invalid debug file' });
    }

    // Move to trash instead of permanent deletion
    try {
      await trash(fullPath);
      res.json({ success: true, message: 'Debug file moved to trash' });
    } catch (trashError) {
      res.status(500).json({ success: false, message: 'Failed to move debug file to trash: ' + trashError.message });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Clean multiple debug files (move to trash)
app.post('/api/clean/debug-files', async (req, res) => {
  const { filenames } = req.body;

  if (!Array.isArray(filenames) || filenames.length === 0) {
    return res.status(400).json({ success: false, message: 'Invalid filenames' });
  }

  const results = [];
  const pathsToTrash = [];

  for (const filename of filenames) {
    try {
      const fullPath = path.join(DEBUG_DIR, filename);

      // Validate debug file exists and is in the debug directory
      if (!fs.existsSync(fullPath) || !fullPath.startsWith(DEBUG_DIR)) {
        results.push({ filename, success: false, message: 'Invalid debug file' });
        continue;
      }

      pathsToTrash.push(fullPath);
      results.push({ filename, success: true });
    } catch (error) {
      results.push({ filename, success: false, message: error.message });
    }
  }

  try {
    if (pathsToTrash.length > 0) {
      await trash(pathsToTrash);
    }
    res.json({ success: true, results });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Clean single orphaned debug file (move to trash)
app.post('/api/clean/orphaned-debug', async (req, res) => {
  const { filename } = req.body;
  const fullPath = path.join(DEBUG_DIR, filename);

  try {
    // Validate debug file exists and is in the debug directory
    if (!fs.existsSync(fullPath) || !fullPath.startsWith(DEBUG_DIR)) {
      return res.status(400).json({ success: false, message: 'Invalid debug file' });
    }

    // Move to trash instead of permanent deletion
    try {
      await trash(fullPath);
      res.json({ success: true, message: 'Orphaned debug file moved to trash' });
    } catch (trashError) {
      res.status(500).json({ success: false, message: 'Failed to move orphaned debug file to trash: ' + trashError.message });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Clean multiple orphaned debug files (move to trash)
app.post('/api/clean/orphaned-debug-files', async (req, res) => {
  const { filenames } = req.body;

  if (!Array.isArray(filenames) || filenames.length === 0) {
    return res.status(400).json({ success: false, message: 'Invalid filenames' });
  }

  const results = [];
  const pathsToTrash = [];

  for (const filename of filenames) {
    try {
      const fullPath = path.join(DEBUG_DIR, filename);

      // Validate debug file exists and is in the debug directory
      if (!fs.existsSync(fullPath) || !fullPath.startsWith(DEBUG_DIR)) {
        results.push({ filename, success: false, message: 'Invalid debug file' });
        continue;
      }

      pathsToTrash.push(fullPath);
      results.push({ filename, success: true });
    } catch (error) {
      results.push({ filename, success: false, message: error.message });
    }
  }

  try {
    if (pathsToTrash.length > 0) {
      await trash(pathsToTrash);
    }
    res.json({ success: true, results });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Clean single todos file (move to trash)
app.post('/api/clean/todo', async (req, res) => {
  const { filename } = req.body;
  const fullPath = path.join(TODOS_DIR, filename);

  try {
    // Validate todos file exists and is in the todos directory
    if (!fs.existsSync(fullPath) || !fullPath.startsWith(TODOS_DIR)) {
      return res.status(400).json({ success: false, message: 'Invalid todos file' });
    }

    // Move to trash instead of permanent deletion
    try {
      await trash(fullPath);
      res.json({ success: true, message: 'Todos file moved to trash' });
    } catch (trashError) {
      res.status(500).json({ success: false, message: 'Failed to move todos file to trash: ' + trashError.message });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Clean multiple todos files (move to trash)
app.post('/api/clean/todos', async (req, res) => {
  const { filenames } = req.body;

  if (!Array.isArray(filenames) || filenames.length === 0) {
    return res.status(400).json({ success: false, message: 'Invalid filenames' });
  }

  const results = [];
  const pathsToTrash = [];

  for (const filename of filenames) {
    try {
      const fullPath = path.join(TODOS_DIR, filename);

      // Validate todos file exists and is in the todos directory
      if (!fs.existsSync(fullPath) || !fullPath.startsWith(TODOS_DIR)) {
        results.push({ filename, success: false, message: 'Invalid todos file' });
        continue;
      }

      pathsToTrash.push(fullPath);
      results.push({ filename, success: true });
    } catch (error) {
      results.push({ filename, success: false, message: error.message });
    }
  }

  try {
    if (pathsToTrash.length > 0) {
      await trash(pathsToTrash);
    }
    res.json({ success: true, results });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Clean single orphaned todos file (move to trash)
app.post('/api/clean/orphaned-todo', async (req, res) => {
  const { filename } = req.body;
  const fullPath = path.join(TODOS_DIR, filename);

  try {
    // Validate todos file exists and is in the todos directory
    if (!fs.existsSync(fullPath) || !fullPath.startsWith(TODOS_DIR)) {
      return res.status(400).json({ success: false, message: 'Invalid todos file' });
    }

    // Move to trash instead of permanent deletion
    try {
      await trash(fullPath);
      res.json({ success: true, message: 'Orphaned todos file moved to trash' });
    } catch (trashError) {
      res.status(500).json({ success: false, message: 'Failed to move orphaned todos file to trash: ' + trashError.message });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Clean multiple orphaned todos files (move to trash)
app.post('/api/clean/orphaned-todos', async (req, res) => {
  const { filenames } = req.body;

  if (!Array.isArray(filenames) || filenames.length === 0) {
    return res.status(400).json({ success: false, message: 'Invalid filenames' });
  }

  const results = [];
  const pathsToTrash = [];

  for (const filename of filenames) {
    try {
      const fullPath = path.join(TODOS_DIR, filename);

      // Validate todos file exists and is in the todos directory
      if (!fs.existsSync(fullPath) || !fullPath.startsWith(TODOS_DIR)) {
        results.push({ filename, success: false, message: 'Invalid todos file' });
        continue;
      }

      pathsToTrash.push(fullPath);
      results.push({ filename, success: true });
    } catch (error) {
      results.push({ filename, success: false, message: error.message });
    }
  }

  try {
    if (pathsToTrash.length > 0) {
      await trash(pathsToTrash);
    }
    res.json({ success: true, results });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Remove project from .claude.json - creates backup first
app.post('/api/remove/project', (req, res) => {
  const { projectPath } = req.body;

  try {
    // Create backup before modifying
    const backup = createConfigBackup();

    const data = JSON.parse(fs.readFileSync(CLAUDE_JSON_PATH, 'utf-8'));
    delete data.projects[projectPath];

    fs.writeFileSync(CLAUDE_JSON_PATH, JSON.stringify(data, null, 2));

    res.json({
      success: true,
      message: `Removed project: ${projectPath}`,
      backup: backup
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Restore backup
app.post('/api/restore/backup', (req, res) => {
  const { filename } = req.body;

  try {
    const backupPath = path.join(CONFIG_BACKUP_DIR, filename);

    // Validate backup file exists and is in the config backup directory
    if (!fs.existsSync(backupPath) || !backupPath.startsWith(CONFIG_BACKUP_DIR)) {
      return res.status(400).json({ success: false, message: 'Invalid backup file' });
    }

    // Create a backup of the current file before restoring
    const preRestoreBackup = createConfigBackup();

    // Restore the backup
    fs.copyFileSync(backupPath, CLAUDE_JSON_PATH);

    res.json({
      success: true,
      message: `Backup restored successfully. Current config backed up as: ${preRestoreBackup?.filename || 'unknown'}`,
      preRestoreBackup: preRestoreBackup
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Remove backup endpoint
app.post('/api/remove/backup', async (req, res) => {
  const { filename } = req.body;

  try {
    const backupPath = path.join(CONFIG_BACKUP_DIR, filename);

    // Validate backup file exists and is in the config backup directory
    if (!fs.existsSync(backupPath) || !backupPath.startsWith(CONFIG_BACKUP_DIR)) {
      return res.status(400).json({ success: false, message: 'Invalid backup file' });
    }

    // Move to trash instead of permanent deletion
    try {
      await trash(backupPath);
      res.json({ success: true, message: 'Backup moved to trash' });
    } catch (trashError) {
      res.status(500).json({ success: false, message: 'Failed to move backup to trash: ' + trashError.message });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Remove multiple backups endpoint
app.post('/api/remove/backups', async (req, res) => {
  const { filenames } = req.body;

  if (!Array.isArray(filenames) || filenames.length === 0) {
    return res.status(400).json({ success: false, message: 'Invalid filenames' });
  }

  const results = [];
  for (const filename of filenames) {
    try {
      const backupPath = path.join(CONFIG_BACKUP_DIR, filename);

      // Validate backup file exists and is in the config backup directory
      if (!fs.existsSync(backupPath) || !backupPath.startsWith(CONFIG_BACKUP_DIR)) {
        results.push({ filename, success: false, message: 'Invalid backup file' });
        continue;
      }

      // Move to trash
      try {
        await trash(backupPath);
        results.push({ filename, success: true });
      } catch (trashError) {
        results.push({ filename, success: false, message: trashError.message });
      }
    } catch (error) {
      results.push({ filename, success: false, message: error.message });
    }
  }

  res.json({ success: true, results });
});

app.listen(PORT, () => {
  console.log(`CC-Cleaner running at http://localhost:${PORT}`);
});
