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

app.get('/api/stats', (req, res) => {
  const jsonProjects = getJsonProjects();
  const sessions = getSessionProjects();
  const orphaned = getOrphanedProjects();

  const totalSessionSize = sessions.reduce((sum, s) => sum + s.size, 0);
  const orphanedSize = orphaned.reduce((sum, o) => sum + o.size, 0);
  const totalProjectsSize = sessions.reduce((sum, s) => sum + s.size, 0);

  res.json({
    totalProjects: jsonProjects.length,
    projectsWithSessions: jsonProjects.filter(p => p.exists && fs.existsSync(path.join(PROJECTS_DIR, encodePath(p.path)))).length,
    totalSessionSize: totalSessionSize,
    totalProjectsSize: totalProjectsSize,
    formatBytes: formatBytes(totalSessionSize),
    formatProjectsBytes: formatBytes(totalProjectsSize),
    orphanedCount: orphaned.length,
    orphanedSize: orphanedSize
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

app.listen(PORT, () => {
  console.log(`CC-Cleaner running at http://localhost:${PORT}`);
});
