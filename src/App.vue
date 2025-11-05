<template>
  <div class="app">
    <header class="header">
      <div class="header-left">
        <h1>Claude Code Cleaner</h1>
      </div>
      <div class="header-right">
        <div class="stats">
          <div class="stat-item">
            <span class="stat-label">Projects</span>
            <span class="stat-value">{{ stats.totalProjects || 0 }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Projects Size</span>
            <span class="stat-value">{{ stats.formatProjectsBytes || '0 B' }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Orphaned</span>
            <span class="stat-value">{{ stats.orphanedCount || 0 }}</span>
          </div>
        </div>
        <button class="primary" @click="createFullBackup" title="Create a full backup of your .claude directory">
          Create Backup
        </button>
      </div>
    </header>

    <div class="tabs">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        :class="['tab-button', { active: activeTab === tab.id }]"
        @click="switchTab(tab.id)"
      >
        {{ tab.label }}
        <span class="tab-count">{{ getTabCount(tab.id) }}</span>
        <span v-if="getTabSelected(tab.id)" class="tab-selected">({{ getTabSelected(tab.id) }})</span>
      </button>
    </div>

    <div v-if="successMessage" class="success-message show">
      {{ successMessage }}
    </div>
    <div v-if="errorMessage" class="error-message show">
      {{ errorMessage }}
    </div>

    <!-- Projects Tab -->
    <div v-if="activeTab === 'json-projects'" class="tab-content active">
      <div v-if="jsonProjects.length > 0" class="project-list">
        <div v-for="project in jsonProjects" :key="project.path" class="project-item">
          <div class="project-info">
            <div class="project-name">{{ project.path.split('/').pop() }}</div>
            <div class="project-path">{{ project.path }}</div>
            <div v-if="project.sessionEnvs && project.sessionEnvs.length > 0" class="session-envs-list">
              <div class="session-envs-label">Session Env(s): {{ project.sessionEnvs.length }}</div>
              <div v-for="env in project.sessionEnvs" :key="env" class="session-env-item">{{ env }}</div>
            </div>
            <div class="project-meta">
              <span
                :class="['status-badge', project.exists ? 'status-exists' : 'status-missing']"
                :title="project.exists ? 'Project folder found on disk' : 'Project folder not found on disk (may have been moved or deleted)'"
              >
                {{ project.exists ? 'Folder Found' : 'Folder Not Found' }}
              </span>
              <span>Last Cost: {{ project.config?.lastCost ? '$' + project.config.lastCost.toFixed(4) : 'N/A' }}</span>
              <span>Duration: {{ formatDuration(project.config?.lastDuration) }}</span>
            </div>
          </div>
          <div class="project-actions">
            <button @click="removeProject(project.path)">Remove from Config</button>
          </div>
        </div>
      </div>
      <div v-else class="empty-state">
        <h3>No projects found</h3>
      </div>
    </div>

    <!-- Sessions Tab -->
    <div v-if="activeTab === 'sessions'" class="tab-content active">
      <div class="info-note">
        <p><strong>Session Data:</strong> Debug information, history, and cache files from Claude Code sessions. These can exist even if the project folder has been moved or deleted.</p>
      </div>
      <div class="bulk-actions">
        <div class="select-all-container">
          <input
            type="checkbox"
            id="select-all-sessions"
            class="checkbox"
            :checked="allSessionsSelected"
            @change="toggleAllSessions"
          />
          <label for="select-all-sessions">Select All</label>
        </div>
        <button class="danger" @click="cleanSelectedSessions" style="margin-left: auto">
          Move to Trash
        </button>
      </div>

      <div v-if="sessions.length > 0" class="project-list">
        <div v-for="session in sessions" :key="session.dir" class="project-item">
          <div class="project-info">
            <div class="project-name">{{ session.dir }}</div>
            <div class="project-path">{{ session.actualPath }}</div>
            <div v-if="session.sessionEnvs && session.sessionEnvs.length > 0" class="session-envs-list">
              <div class="session-envs-label">Session Env(s): {{ session.sessionEnvs.length }}</div>
              <div v-for="env in session.sessionEnvs" :key="env" class="session-env-item">{{ env }}</div>
            </div>
            <div class="project-meta">
              <span class="size-indicator">Size: {{ formatBytes(session.size) }}</span>
              <span>Files/Dirs: {{ session.files }}</span>
            </div>
          </div>
          <div class="project-actions">
            <input
              type="checkbox"
              class="checkbox session-checkbox"
              :checked="selectedSessions.has(session.dir)"
              @change="toggleSessionCheckbox(session.dir)"
            />
            <button @click="cleanSession(session.dir)">Clean</button>
          </div>
        </div>
      </div>
      <div v-else class="empty-state">
        <h3>No session data found</h3>
      </div>
    </div>

    <!-- File History Tab -->
    <div v-if="activeTab === 'file-history'" class="tab-content active">
      <div class="info-note">
        <p><strong>File History:</strong> Version history and snapshots of files edited during Claude Code sessions. These records accumulate over time and can be safely cleaned up to save disk space.</p>
      </div>
      <div class="bulk-actions">
        <div class="select-all-container">
          <input
            type="checkbox"
            id="select-all-file-history"
            class="checkbox"
            :checked="allFileHistorySelected"
            @change="toggleAllFileHistory"
          />
          <label for="select-all-file-history">Select All</label>
        </div>
        <button class="danger" @click="cleanSelectedFileHistory" style="margin-left: auto">
          Move to Trash
        </button>
      </div>

      <div v-if="fileHistory.length > 0" class="project-list">
        <div v-for="history in fileHistory" :key="history.dir" class="project-item">
          <div class="project-info">
            <div class="project-name">{{ history.dir }}</div>
            <div v-if="history.sessionEnvs && history.sessionEnvs.length > 0" class="session-envs-list">
              <div class="session-envs-label">Session Env(s): {{ history.sessionEnvs.length }}</div>
              <div v-for="env in history.sessionEnvs" :key="env" class="session-env-item">{{ env }}</div>
            </div>
            <div class="project-meta">
              <span class="size-indicator">Size: {{ formatBytes(history.size) }}</span>
              <span>Files/Dirs: {{ history.files }}</span>
            </div>
          </div>
          <div class="project-actions">
            <input
              type="checkbox"
              class="checkbox file-history-checkbox"
              :checked="selectedFileHistory.has(history.dir)"
              @change="toggleFileHistoryCheckbox(history.dir)"
            />
            <button @click="cleanFileHistory(history.dir)">Clean</button>
          </div>
        </div>
      </div>
      <div v-else class="empty-state">
        <h3>No file history found</h3>
      </div>
    </div>

    <!-- Orphaned File History Tab -->
    <div v-if="activeTab === 'orphaned-file-history'" class="tab-content active">
      <div class="info-note">
        <p><strong>Orphaned File History:</strong> File history entries that don't correspond to any active projects. These can be safely cleaned up to reclaim disk space.</p>
      </div>
      <div class="bulk-actions">
        <div class="select-all-container">
          <input
            type="checkbox"
            id="select-all-orphaned-file-history"
            class="checkbox"
            :checked="allOrphanedFileHistorySelected"
            @change="toggleAllOrphanedFileHistory"
          />
          <label for="select-all-orphaned-file-history">Select All</label>
        </div>
        <button class="danger" @click="cleanSelectedOrphanedFileHistory" style="margin-left: auto">
          Move to Trash
        </button>
      </div>

      <div v-if="orphanedFileHistory.length > 0" class="project-list">
        <div v-for="history in orphanedFileHistory" :key="history.dir" class="project-item">
          <div class="project-info">
            <div class="project-name">{{ history.dir }}</div>
            <div v-if="history.sessionEnvs && history.sessionEnvs.length > 0" class="session-envs-list">
              <div class="session-envs-label">Session Env(s): {{ history.sessionEnvs.length }}</div>
              <div v-for="env in history.sessionEnvs" :key="env" class="session-env-item">{{ env }}</div>
            </div>
            <div class="project-meta">
              <span class="status-badge status-orphaned">Orphaned</span>
              <span class="size-indicator">Size: {{ formatBytes(history.size) }}</span>
              <span>Files/Dirs: {{ history.files }}</span>
            </div>
          </div>
          <div class="project-actions">
            <input
              type="checkbox"
              class="checkbox orphaned-file-history-checkbox"
              :checked="selectedOrphanedFileHistory.has(history.dir)"
              @change="toggleOrphanedFileHistoryCheckbox(history.dir)"
            />
            <button class="danger" @click="cleanOrphanedFileHistory(history.dir)">Clean</button>
          </div>
        </div>
      </div>
      <div v-else class="empty-state">
        <h3>No orphaned file history found</h3>
        <p>Great! All your file history is associated with active projects.</p>
      </div>
    </div>

    <!-- Orphaned Tab -->
    <div v-if="activeTab === 'orphaned'" class="tab-content active">
      <div class="bulk-actions">
        <div class="select-all-container">
          <input
            type="checkbox"
            id="select-all-orphaned"
            class="checkbox"
            :checked="allOrphanedSelected"
            @change="toggleAllOrphaned"
          />
          <label for="select-all-orphaned">Select All</label>
        </div>
        <button class="danger" @click="deleteSelectedOrphaned" style="margin-left: auto">
          Move to Trash
        </button>
      </div>

      <div v-if="orphaned.length > 0" class="project-list">
        <div v-for="orphan in orphaned" :key="orphan.dir" class="project-item">
          <div class="project-info">
            <div class="project-name">{{ orphan.dir }}</div>
            <div class="project-path">{{ orphan.actualPath }}</div>
            <div v-if="orphan.sessionEnvs && orphan.sessionEnvs.length > 0" class="session-envs-list">
              <div class="session-envs-label">Session Env(s): {{ orphan.sessionEnvs.length }}</div>
              <div v-for="env in orphan.sessionEnvs" :key="env" class="session-env-item">{{ env }}</div>
            </div>
            <div class="project-meta">
              <span class="status-badge status-orphaned">Orphaned</span>
              <span class="size-indicator">Size: {{ formatBytes(orphan.size) }}</span>
              <span>Files/Dirs: {{ orphan.files }}</span>
            </div>
          </div>
          <div class="project-actions">
            <input
              type="checkbox"
              class="checkbox orphaned-checkbox"
              :checked="selectedOrphaned.has(orphan.dir)"
              @change="toggleOrphanedCheckbox(orphan.dir)"
            />
            <button class="danger" @click="deleteOrphaned(orphan.dir)">Delete</button>
          </div>
        </div>
      </div>
      <div v-else class="empty-state">
        <h3>No orphaned projects found</h3>
        <p>Great! Your projects are clean.</p>
      </div>
    </div>

    <!-- Backups Tab -->
    <div v-if="activeTab === 'backups'" class="tab-content active">
      <div v-if="backups.length > 0" class="project-list">
        <div v-for="backup in backups" :key="backup.filename" class="project-item">
          <div class="project-info">
            <div class="project-name">{{ backup.filename }}</div>
            <div class="project-meta">
              <span class="size-indicator">Size: {{ formatBytes(backup.size) }}</span>
              <span>Created: {{ formatDate(backup.created) }}</span>
              <span>Modified: {{ formatDate(backup.modified) }}</span>
            </div>
          </div>
          <div class="project-actions">
            <button @click="viewBackup(backup)">View</button>
            <button class="primary" @click="restoreBackup(backup)">Restore</button>
          </div>
        </div>
      </div>
      <div v-else class="empty-state">
        <h3>No backups found</h3>
        <p>Backups are created automatically when you clean sessions or remove projects.</p>
      </div>
    </div>

    <!-- Legend -->
    <div class="legend">
      <h3>Legend</h3>
      <div class="legend-content">
        <div class="legend-section">
          <h4>Status Badges (Projects Tab)</h4>
          <div class="legend-items">
            <div class="legend-item">
              <span class="status-badge status-exists">Folder Found</span>
              <span>Project folder exists at the configured path on your disk</span>
            </div>
            <div class="legend-item">
              <span class="status-badge status-missing">Folder Not Found</span>
              <span>Project folder was moved, deleted, or path changed</span>
            </div>
          </div>
        </div>

        <div class="legend-section">
          <h4>Orphaned Status (Orphaned Tab)</h4>
          <div class="legend-items">
            <div class="legend-item">
              <span class="status-badge status-orphaned">Orphaned</span>
              <span>Session data exists but no entry in .claude.json (safe to delete)</span>
            </div>
          </div>
        </div>

        <div class="legend-section">
          <h4>Data Types</h4>
          <div class="legend-items">
            <div class="legend-item">
              <span class="legend-label">Session Data</span>
              <span>Debug info, history, and cache from Claude Code sessions. Can exist even if project folder is gone.</span>
            </div>
            <div class="legend-item">
              <span class="legend-label">Config Backups</span>
              <span>Timestamped copies of .claude.json created automatically before cleanup operations. Can be restored anytime.</span>
            </div>
          </div>
        </div>

        <div class="legend-section">
          <h4>Size Indicators</h4>
          <div class="legend-items">
            <div class="legend-item">
              <span class="legend-label">Size: X MB</span>
              <span>Total disk space used by session data or backup file</span>
            </div>
            <div class="legend-item">
              <span class="legend-label">Files/Dirs: X</span>
              <span>Number of files and directories in session data</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Confirmation Dialog -->
    <div v-if="showConfirmation" class="confirmation-dialog show">
      <div class="dialog-content">
        <h2>{{ confirmationTitle }}</h2>
        <p>{{ confirmationMessage }}</p>
        <div class="dialog-actions">
          <button @click="cancelConfirmation">Cancel</button>
          <button class="danger" @click="confirmAction">Confirm</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';

// State
const activeTab = ref('json-projects');
const jsonProjects = ref([]);
const sessions = ref([]);
const orphaned = ref([]);
const fileHistory = ref([]);
const orphanedFileHistory = ref([]);
const backups = ref([]);
const stats = ref({});
const selectedSessions = ref(new Set());
const selectedOrphaned = ref(new Set());
const selectedFileHistory = ref(new Set());
const selectedOrphanedFileHistory = ref(new Set());
const successMessage = ref('');
const errorMessage = ref('');
const showConfirmation = ref(false);
const confirmationTitle = ref('');
const confirmationMessage = ref('');
let confirmationCallback = null;

const tabs = [
  { id: 'json-projects', label: 'Projects (.claude.json)' },
  { id: 'sessions', label: 'Session Data (.claude/projects)' },
  { id: 'file-history', label: 'File History' },
  { id: 'orphaned-file-history', label: 'Orphaned File History' },
  { id: 'orphaned', label: 'Orphaned Projects' },
  { id: 'backups', label: 'Config Backups' }
];

// Computed properties
const allSessionsSelected = computed(() => {
  return sessions.value.length > 0 && sessions.value.every(s => selectedSessions.value.has(s.dir));
});

const allOrphanedSelected = computed(() => {
  return orphaned.value.length > 0 && orphaned.value.every(o => selectedOrphaned.value.has(o.dir));
});

const allFileHistorySelected = computed(() => {
  return fileHistory.value.length > 0 && fileHistory.value.every(f => selectedFileHistory.value.has(f.dir));
});

const allOrphanedFileHistorySelected = computed(() => {
  return orphanedFileHistory.value.length > 0 && orphanedFileHistory.value.every(f => selectedOrphanedFileHistory.value.has(f.dir));
});

// Helper functions
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function formatDuration(ms) {
  if (!ms) return 'N/A';
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleString();
}

function showSuccess(message) {
  successMessage.value = message;
  setTimeout(() => (successMessage.value = ''), 4000);
}

function showError(message) {
  errorMessage.value = message;
  setTimeout(() => (errorMessage.value = ''), 4000);
}

function switchTab(tabId) {
  activeTab.value = tabId;
}

// Tab counter functions
function getTabCount(tabId) {
  switch (tabId) {
    case 'json-projects':
      return jsonProjects.value.length;
    case 'sessions':
      return sessions.value.length;
    case 'file-history':
      return fileHistory.value.length;
    case 'orphaned-file-history':
      return orphanedFileHistory.value.length;
    case 'orphaned':
      return orphaned.value.length;
    case 'backups':
      return backups.value.length;
    default:
      return 0;
  }
}

function getTabSelected(tabId) {
  switch (tabId) {
    case 'sessions':
      return selectedSessions.value.size > 0 ? selectedSessions.value.size : null;
    case 'file-history':
      return selectedFileHistory.value.size > 0 ? selectedFileHistory.value.size : null;
    case 'orphaned-file-history':
      return selectedOrphanedFileHistory.value.size > 0 ? selectedOrphanedFileHistory.value.size : null;
    case 'orphaned':
      return selectedOrphaned.value.size > 0 ? selectedOrphaned.value.size : null;
    default:
      return null;
  }
}

// Tab navigation
function toggleSessionCheckbox(dir) {
  if (selectedSessions.value.has(dir)) {
    selectedSessions.value.delete(dir);
  } else {
    selectedSessions.value.add(dir);
  }
  selectedSessions.value = new Set(selectedSessions.value);
}

function toggleOrphanedCheckbox(dir) {
  if (selectedOrphaned.value.has(dir)) {
    selectedOrphaned.value.delete(dir);
  } else {
    selectedOrphaned.value.add(dir);
  }
  selectedOrphaned.value = new Set(selectedOrphaned.value);
}

function toggleFileHistoryCheckbox(dir) {
  if (selectedFileHistory.value.has(dir)) {
    selectedFileHistory.value.delete(dir);
  } else {
    selectedFileHistory.value.add(dir);
  }
  selectedFileHistory.value = new Set(selectedFileHistory.value);
}

function toggleAllSessions() {
  if (allSessionsSelected.value) {
    selectedSessions.value.clear();
  } else {
    sessions.value.forEach(s => selectedSessions.value.add(s.dir));
  }
  selectedSessions.value = new Set(selectedSessions.value);
}

function toggleAllOrphaned() {
  if (allOrphanedSelected.value) {
    selectedOrphaned.value.clear();
  } else {
    orphaned.value.forEach(o => selectedOrphaned.value.add(o.dir));
  }
  selectedOrphaned.value = new Set(selectedOrphaned.value);
}

function toggleAllFileHistory() {
  if (allFileHistorySelected.value) {
    selectedFileHistory.value.clear();
  } else {
    fileHistory.value.forEach(f => selectedFileHistory.value.add(f.dir));
  }
  selectedFileHistory.value = new Set(selectedFileHistory.value);
}

// Confirmation dialog
function showConfirmationDialog(title, message, callback) {
  confirmationTitle.value = title;
  confirmationMessage.value = message;
  confirmationCallback = callback;
  showConfirmation.value = true;
}

function confirmAction() {
  showConfirmation.value = false;
  if (confirmationCallback) {
    confirmationCallback();
  }
}

function cancelConfirmation() {
  showConfirmation.value = false;
}

// API calls
async function loadData() {
  try {
    const [jsonRes, sessionsRes, fileHistoryRes, orphanedFileHistoryRes, orphanedRes, statsRes, backupsRes] = await Promise.all([
      fetch('/api/projects/json'),
      fetch('/api/projects/sessions'),
      fetch('/api/projects/file-history'),
      fetch('/api/projects/orphaned-file-history'),
      fetch('/api/projects/orphaned'),
      fetch('/api/stats'),
      fetch('/api/backups')
    ]);

    jsonProjects.value = await jsonRes.json();
    sessions.value = await sessionsRes.json();
    fileHistory.value = await fileHistoryRes.json();
    orphanedFileHistory.value = await orphanedFileHistoryRes.json();
    orphaned.value = await orphanedRes.json();
    stats.value = await statsRes.json();
    backups.value = await backupsRes.json();
  } catch (error) {
    showError('Failed to load data: ' + error.message);
  }
}

async function cleanSession(dir) {
  showConfirmationDialog(
    'Move Session to Trash',
    `Move this session data to trash?\n\nDirectory: ${dir}`,
    async () => {
      try {
        const res = await fetch('/api/clean/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dir })
        });
        const data = await res.json();
        if (data.success) {
          showSuccess('Session moved to trash. Backup created: ' + (data.backup?.filename || 'unknown'));
          selectedSessions.value.delete(dir);
          loadData();
        } else {
          showError(data.message || 'Failed to move session to trash');
        }
      } catch (error) {
        showError('Error: ' + error.message);
      }
    }
  );
}

async function cleanSelectedSessions() {
  if (selectedSessions.value.size === 0) {
    showError('No sessions selected');
    return;
  }

  showConfirmationDialog(
    'Move Sessions to Trash',
    `Move ${selectedSessions.value.size} session(s) to trash?`,
    async () => {
      try {
        const res = await fetch('/api/clean/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dirs: Array.from(selectedSessions.value) })
        });
        const data = await res.json();
        if (data.success) {
          showSuccess(`Moved ${data.results.filter(r => r.success).length} session(s) to trash. Backup created: ${data.backup?.filename || 'unknown'}`);
          selectedSessions.value.clear();
          loadData();
        } else {
          showError(data.message || 'Failed to move sessions to trash');
        }
      } catch (error) {
        showError('Error: ' + error.message);
      }
    }
  );
}

async function deleteOrphaned(dir) {
  showConfirmationDialog(
    'Move Orphaned Project to Trash',
    `Move this orphaned session data to trash?\n\nDirectory: ${dir}`,
    async () => {
      try {
        const res = await fetch('/api/clean/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dir })
        });
        const data = await res.json();
        if (data.success) {
          showSuccess('Orphaned project moved to trash. Backup created: ' + (data.backup?.filename || 'unknown'));
          selectedOrphaned.value.delete(dir);
          loadData();
        } else {
          showError(data.message || 'Failed to move to trash');
        }
      } catch (error) {
        showError('Error: ' + error.message);
      }
    }
  );
}

async function deleteSelectedOrphaned() {
  if (selectedOrphaned.value.size === 0) {
    showError('No orphaned projects selected');
    return;
  }

  showConfirmationDialog(
    'Move Selected Orphaned Projects to Trash',
    `Move ${selectedOrphaned.value.size} orphaned project(s) to trash?`,
    async () => {
      try {
        const res = await fetch('/api/clean/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dirs: Array.from(selectedOrphaned.value) })
        });
        const data = await res.json();
        if (data.success) {
          showSuccess(`Moved ${data.results.filter(r => r.success).length} orphaned project(s) to trash. Backup created: ${data.backup?.filename || 'unknown'}`);
          selectedOrphaned.value.clear();
          loadData();
        } else {
          showError(data.message || 'Failed to move to trash');
        }
      } catch (error) {
        showError('Error: ' + error.message);
      }
    }
  );
}

async function cleanFileHistory(dir) {
  showConfirmationDialog(
    'Move File History to Trash',
    `Move this file history to trash?\n\nDirectory: ${dir}`,
    async () => {
      try {
        const res = await fetch('/api/clean/file-history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dir })
        });
        const data = await res.json();
        if (data.success) {
          showSuccess('File history moved to trash. Backup created: ' + (data.backup?.filename || 'unknown'));
          selectedFileHistory.value.delete(dir);
          loadData();
        } else {
          showError(data.message || 'Failed to move to trash');
        }
      } catch (error) {
        showError('Error: ' + error.message);
      }
    }
  );
}

async function cleanSelectedFileHistory() {
  if (selectedFileHistory.value.size === 0) {
    showError('No file history selected');
    return;
  }

  showConfirmationDialog(
    'Move Selected File History to Trash',
    `Move ${selectedFileHistory.value.size} file history(ies) to trash?`,
    async () => {
      try {
        const res = await fetch('/api/clean/file-histories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dirs: Array.from(selectedFileHistory.value) })
        });
        const data = await res.json();
        if (data.success) {
          showSuccess(`Moved ${data.results.filter(r => r.success).length} file history(ies) to trash. Backup created: ${data.backup?.filename || 'unknown'}`);
          selectedFileHistory.value.clear();
          loadData();
        } else {
          showError(data.message || 'Failed to move to trash');
        }
      } catch (error) {
        showError('Error: ' + error.message);
      }
    }
  );
}

function toggleOrphanedFileHistoryCheckbox(dir) {
  if (selectedOrphanedFileHistory.value.has(dir)) {
    selectedOrphanedFileHistory.value.delete(dir);
  } else {
    selectedOrphanedFileHistory.value.add(dir);
  }
  selectedOrphanedFileHistory.value = new Set(selectedOrphanedFileHistory.value);
}

function toggleAllOrphanedFileHistory() {
  if (allOrphanedFileHistorySelected.value) {
    selectedOrphanedFileHistory.value.clear();
  } else {
    orphanedFileHistory.value.forEach(f => selectedOrphanedFileHistory.value.add(f.dir));
  }
  selectedOrphanedFileHistory.value = new Set(selectedOrphanedFileHistory.value);
}

async function cleanOrphanedFileHistory(dir) {
  showConfirmationDialog(
    'Move Orphaned File History to Trash',
    `Move this orphaned file history to trash?\n\nDirectory: ${dir}`,
    async () => {
      try {
        const res = await fetch('/api/clean/orphaned-file-history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dir })
        });
        const data = await res.json();
        if (data.success) {
          showSuccess('Orphaned file history moved to trash. Backup created: ' + (data.backup?.filename || 'unknown'));
          selectedOrphanedFileHistory.value.delete(dir);
          loadData();
        } else {
          showError(data.message || 'Failed to move to trash');
        }
      } catch (error) {
        showError('Error: ' + error.message);
      }
    }
  );
}

async function cleanSelectedOrphanedFileHistory() {
  if (selectedOrphanedFileHistory.value.size === 0) {
    showError('No orphaned file history selected');
    return;
  }

  showConfirmationDialog(
    'Move Selected Orphaned File History to Trash',
    `Move ${selectedOrphanedFileHistory.value.size} orphaned file history(ies) to trash?`,
    async () => {
      try {
        const res = await fetch('/api/clean/orphaned-file-histories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dirs: Array.from(selectedOrphanedFileHistory.value) })
        });
        const data = await res.json();
        if (data.success) {
          showSuccess(`Moved ${data.results.filter(r => r.success).length} orphaned file history(ies) to trash. Backup created: ${data.backup?.filename || 'unknown'}`);
          selectedOrphanedFileHistory.value.clear();
          loadData();
        } else {
          showError(data.message || 'Failed to move to trash');
        }
      } catch (error) {
        showError('Error: ' + error.message);
      }
    }
  );
}

async function removeProject(projectPath) {
  showConfirmationDialog(
    'Remove from Configuration',
    `Remove this project from .claude.json?\n\n${projectPath}`,
    async () => {
      try {
        const res = await fetch('/api/remove/project', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectPath })
        });
        const data = await res.json();
        if (data.success) {
          showSuccess('Project removed from configuration. Backup created: ' + (data.backup?.filename || 'unknown'));
          loadData();
        } else {
          showError(data.message || 'Failed to remove project');
        }
      } catch (error) {
        showError('Error: ' + error.message);
      }
    }
  );
}

function viewBackup(backup) {
  showConfirmationDialog(
    'Backup Info',
    `Filename: ${backup.filename}\nSize: ${formatBytes(backup.size)}\nCreated: ${formatDate(backup.created)}`,
    () => {}
  );
}

async function restoreBackup(backup) {
  showConfirmationDialog(
    'Restore Backup',
    `Are you sure you want to restore this backup?\n\n${backup.filename}\n\nThis will overwrite the current .claude.json file.`,
    async () => {
      try {
        const res = await fetch('/api/restore/backup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: backup.filename })
        });
        const data = await res.json();
        if (data.success) {
          showSuccess('Backup restored successfully');
          loadData();
        } else {
          showError(data.message || 'Failed to restore backup');
        }
      } catch (error) {
        showError('Error: ' + error.message);
      }
    }
  );
}

async function createFullBackup() {
  showConfirmationDialog(
    'Create Full Backup',
    `This will create a complete backup of:\n• .claude directory (projects, session data, etc.)\n• .claude.json configuration file\n\nBackups will be saved to ~/.cc-cleaner/backup/\n\nThis may take a while depending on the size of your data.`,
    async () => {
      try {
        const res = await fetch('/api/backup/full-claude', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        const data = await res.json();
        if (data.success) {
          showSuccess(`Full backup created successfully!\n\n.claude folder: ${data.backups.claudeDir}\n.claude.json: ${data.backups.claudeJson}\n\nTotal size: ${data.totalSize}\nLocation: ~/.cc-cleaner/backup/`);
        } else {
          showError(data.message || 'Failed to create backup');
        }
      } catch (error) {
        showError('Error: ' + error.message);
      }
    }
  );
}

// Lifecycle
onMounted(() => {
  loadData();
});
</script>

<style scoped>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.app {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  background: #0f0f0f;
  color: #e0e0e0;
  min-height: 100vh;
  padding: 20px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  border-bottom: 1px solid #333;
  padding-bottom: 20px;
  max-width: 1400px;
  margin-left: auto;
  margin-right: auto;
  gap: 20px;
}

.header-left {
  flex: 1;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 20px;
}

h1 {
  font-size: 28px;
  font-weight: 600;
}

.stats {
  display: flex;
  gap: 30px;
  font-size: 14px;
}

.stat-item {
  display: flex;
  flex-direction: column;
}

.stat-label {
  color: #999;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-value {
  font-size: 18px;
  font-weight: 600;
  color: #4a9eff;
  margin-top: 5px;
}

.tabs {
  display: flex;
  gap: 0;
  border-bottom: 1px solid #333;
  margin-bottom: 20px;
  max-width: 1400px;
  margin-left: auto;
  margin-right: auto;
  overflow-x: auto;
}

.tab-button {
  padding: 12px 24px;
  background: none;
  border: none;
  color: #999;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 6px;
}

.tab-button:hover {
  color: #e0e0e0;
}

.tab-button.active {
  color: #4a9eff;
  border-bottom-color: #4a9eff;
}

.tab-count {
  display: inline-block;
  background: #333;
  color: #999;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 12px;
  font-weight: 600;
}

.tab-button.active .tab-count {
  background: #4a9eff;
  color: #000;
}

.tab-selected {
  color: #6dd86d;
  font-size: 12px;
  font-weight: 600;
}

.tab-content {
  max-width: 1400px;
  margin-left: auto;
  margin-right: auto;
}

.project-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.project-item {
  background: #1a1a1a;
  border: 1px solid #333;
  border-radius: 6px;
  padding: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: all 0.2s;
}

.project-item:hover {
  border-color: #555;
  background: #222;
}

.project-info {
  flex: 1;
  padding-right: 20px;
}

.project-path {
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 12px;
  color: #999;
  word-break: break-all;
  margin-bottom: 8px;
}

.session-envs-list {
  margin: 8px 0 12px 0;
  padding: 8px;
  background: #1a1a1a;
  border-left: 3px solid #4a7a9a;
  border-radius: 3px;
}

.session-envs-label {
  font-size: 11px;
  font-weight: 600;
  color: #999;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}

.session-env-item {
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 11px;
  color: #a0c0e0;
  padding: 3px 4px;
  margin: 2px 0;
  word-break: break-all;
}

.project-name {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 6px;
  color: #e0e0e0;
}

.project-meta {
  display: flex;
  gap: 20px;
  font-size: 12px;
  color: #666;
  margin-top: 12px;
  flex-wrap: wrap;
}

.status-badge {
  padding: 4px 8px;
  border-radius: 3px;
  font-size: 11px;
  font-weight: 600;
}

.status-exists {
  background: #1a3a1a;
  color: #6dd86d;
}

.status-missing {
  background: #3a1a1a;
  color: #d86d6d;
}

.status-orphaned {
  background: #3a2a1a;
  color: #d8a86d;
}

.project-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.checkbox {
  width: 20px;
  height: 20px;
  cursor: pointer;
  accent-color: #4a9eff;
}

button {
  padding: 8px 16px;
  background: #2a2a2a;
  border: 1px solid #444;
  color: #e0e0e0;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.2s;
}

button:hover {
  background: #3a3a3a;
  border-color: #555;
}

button.primary {
  background: #4a9eff;
  border-color: #4a9eff;
  color: #000;
}

button.primary:hover {
  background: #5aafff;
  border-color: #5aafff;
}

button.danger {
  background: #d86d6d;
  border-color: #d86d6d;
  color: #fff;
}

button.danger:hover {
  background: #e87d7d;
  border-color: #e87d7d;
}

.bulk-actions {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  padding: 12px;
  background: #1a1a1a;
  border-radius: 6px;
  border: 1px solid #333;
}

.select-all-container {
  display: flex;
  align-items: center;
  gap: 8px;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: #666;
}

.empty-state h3 {
  margin-bottom: 10px;
  color: #999;
}

.size-indicator {
  font-size: 12px;
  color: #999;
  font-family: 'Monaco', 'Courier New', monospace;
}

.success-message {
  position: fixed;
  top: 20px;
  right: 20px;
  background: #1a3a1a;
  border: 1px solid #6dd86d;
  color: #6dd86d;
  padding: 16px 20px;
  border-radius: 6px;
  display: none;
  z-index: 999;
  max-width: 400px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  animation: slideIn 0.3s ease-out;
}

.success-message.show {
  display: block;
  animation: slideIn 0.3s ease-out, slideOut 0.3s ease-out 3.7s forwards;
}

.error-message {
  position: fixed;
  top: 20px;
  right: 20px;
  background: #3a1a1a;
  border: 1px solid #d86d6d;
  color: #d86d6d;
  padding: 16px 20px;
  border-radius: 6px;
  display: none;
  z-index: 999;
  max-width: 400px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  animation: slideIn 0.3s ease-out;
}

.error-message.show {
  display: block;
  animation: slideIn 0.3s ease-out, slideOut 0.3s ease-out 3.7s forwards;
}

@keyframes slideIn {
  from {
    transform: translateX(400px);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes slideOut {
  from {
    transform: translateX(0);
    opacity: 1;
  }
  to {
    transform: translateX(400px);
    opacity: 0;
  }
}

.confirmation-dialog {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  z-index: 1000;
  justify-content: center;
  align-items: center;
}

.confirmation-dialog.show {
  display: flex;
}

.dialog-content {
  background: #1a1a1a;
  border: 1px solid #333;
  border-radius: 8px;
  padding: 24px;
  max-width: 500px;
  width: 90%;
}

.dialog-content h2 {
  margin-bottom: 16px;
  font-size: 18px;
}

.dialog-content p {
  color: #999;
  margin-bottom: 24px;
  line-height: 1.6;
  white-space: pre-wrap;
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 12px;
}

.dialog-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.info-note {
  background: #1a2a3a;
  border-left: 3px solid #4a7a9a;
  padding: 12px 16px;
  border-radius: 4px;
  margin-bottom: 20px;
  max-width: 1400px;
  margin-left: auto;
  margin-right: auto;
}

.info-note p {
  margin: 0;
  font-size: 13px;
  color: #a0c0e0;
  line-height: 1.5;
}

.legend {
  background: #1a1a1a;
  border-top: 1px solid #333;
  padding: 30px 20px;
  margin-top: 40px;
  max-width: 1400px;
  margin-left: auto;
  margin-right: auto;
}

.legend h3 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 20px;
  color: #e0e0e0;
}

.legend-content {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 30px;
}

.legend-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.legend-section h4 {
  font-size: 13px;
  font-weight: 600;
  color: #999;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0;
}

.legend-items {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.legend-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  font-size: 12px;
  line-height: 1.5;
}

.legend-item span:first-child {
  flex-shrink: 0;
  white-space: nowrap;
}

.legend-item span:last-child {
  color: #999;
  flex: 1;
}

.legend-label {
  background: #2a2a2a;
  padding: 3px 8px;
  border-radius: 3px;
  font-family: 'Monaco', 'Courier New', monospace;
  font-weight: 500;
  color: #b0b0b0;
  border: 1px solid #333;
}
</style>
