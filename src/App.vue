<template>
  <div class="app">
    <header class="header">
      <div class="header-left">
        <div class="logo-title" @click="refreshPage" role="button" tabindex="0" @keydown.enter="refreshPage" title="Refresh page (Ctrl+Shift+R)">
          <img src="/broom.png" alt="Logo" class="logo">
          <h1>Claude Code Cleaner</h1>
        </div>
      </div>
      <div class="header-right">
        <div class="stats">
          <div class="stat-item">
            <span class="stat-label">Projects</span>
            <span class="stat-value">{{ stats.totalProjects || 0 }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Claude Size</span>
            <span class="stat-value">{{ stats.formatProjectsBytes || '0 B' }}</span>
          </div>
        </div>
        <button class="primary" @click="createFullBackup" title="Create a full backup of your .claude directory">
          Create Backup
        </button>
      </div>
    </header>

    <div class="main-container">
      <aside class="sidebar">
        <div class="folder-buttons-section">
          <button @click="openDirectory(claudeDir)" :title="`Open ${claudeDir}`" class="folder-button">
            <span>📁</span>
            <span class="folder-label">.claude</span>
          </button>
          <button @click="openDirectory(ccCleanerDir)" :title="`Open ${ccCleanerDir}`" class="folder-button">
            <span>📁</span>
            <span class="folder-label">.cc-cleaner</span>
          </button>
        </div>

        <nav class="tabs">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            :class="['tab-button', { active: activeTab === tab.id }]"
            @click="switchTab(tab.id)"
          >
            <span class="tab-label">
              <span class="tab-label-bold">{{ formatTabLabel(tab.label).bold }}</span>
              <span v-if="formatTabLabel(tab.label).normal" class="tab-label-normal">{{ formatTabLabel(tab.label).normal }}</span>
            </span>
            <div class="tab-info">
              <span :class="['tab-count', { 'tab-count-highlight': shouldHighlightTab(tab.id) }]">{{ getTabCount(tab.id) }}</span>
              <span v-if="getTabSelected(tab.id)" class="tab-selected">{{ getTabSelected(tab.id) }}</span>
            </div>
          </button>
        </nav>

        <div class="sidebar-footer">
          <a href="https://github.com/tk-425/CC-Cleaner" target="_blank" rel="noopener noreferrer" title="View on GitHub">
            <img src="/github.png" alt="GitHub" class="github-icon">
          </a>
        </div>
      </aside>

      <main class="content-area">

    <div v-if="successMessage" class="success-message show">
      {{ successMessage }}
    </div>
    <div v-if="errorMessage" class="error-message show">
      {{ errorMessage }}
    </div>

    <!-- Projects Tab -->
    <div v-if="activeTab === 'json-projects'" class="tab-content active">
      <div class="info-note">
        <p><strong>Projects:</strong> Projects configured in your .claude.json file. These are the main project configurations tracked by Claude Code. You can remove projects that are no longer needed.</p>
      </div>
      <div v-if="jsonProjects.length > 0" class="bulk-actions">
        <div class="select-all-container">
          <input
            type="checkbox"
            id="select-all-projects"
            class="checkbox"
            :checked="allProjectsSelected"
            @change="toggleAllProjects"
          />
          <label for="select-all-projects">Select All</label>
        </div>
        <button class="danger" @click="removeSelectedProjects" style="margin-left: auto" :disabled="selectedProjects.size === 0">
          Remove from Config
        </button>
      </div>
      <div v-if="jsonProjects.length > 0" class="project-list">
        <div v-for="project in jsonProjects" :key="project.path" class="project-item">
          <input
            type="checkbox"
            class="checkbox project-checkbox"
            :checked="selectedProjects.has(project.path)"
            @change="toggleProjectCheckbox(project.path)"
          />
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
            <button class="danger" @click="removeProject(project.path)">Remove from Config</button>
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
        <button class="danger" @click="cleanSelectedSessions" style="margin-left: auto" :disabled="selectedSessions.size === 0">
          Move to Trash
        </button>
      </div>

      <div v-if="sessions.length > 0" class="project-list">
        <div v-for="session in sessions" :key="session.dir" class="project-item">
          <input
            type="checkbox"
            class="checkbox session-checkbox"
            :checked="selectedSessions.has(session.dir)"
            @change="toggleSessionCheckbox(session.dir)"
          />
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
            <button class="danger" @click="cleanSession(session.dir)">Clean</button>
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
        <button class="danger" @click="cleanSelectedFileHistory" style="margin-left: auto" :disabled="selectedFileHistory.size === 0">
          Move to Trash
        </button>
      </div>

      <div v-if="fileHistory.length > 0" class="project-list">
        <div v-for="history in fileHistory" :key="history.dir" class="project-item">
          <input
            type="checkbox"
            class="checkbox file-history-checkbox"
            :checked="selectedFileHistory.has(history.dir)"
            @change="toggleFileHistoryCheckbox(history.dir)"
          />
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
            <button class="danger" @click="cleanFileHistory(history.dir)">Clean</button>
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
        <button class="danger" @click="cleanSelectedOrphanedFileHistory" style="margin-left: auto" :disabled="selectedOrphanedFileHistory.size === 0">
          Move to Trash
        </button>
      </div>

      <div v-if="orphanedFileHistory.length > 0" class="project-list">
        <div v-for="history in orphanedFileHistory" :key="history.dir" class="project-item">
          <input
            type="checkbox"
            class="checkbox orphaned-file-history-checkbox"
            :checked="selectedOrphanedFileHistory.has(history.dir)"
            @change="toggleOrphanedFileHistoryCheckbox(history.dir)"
          />
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
      <div class="info-note">
        <p><strong>Orphaned Projects:</strong> Project folders that exist on disk but are not configured in your .claude.json file. These can be safely moved to trash if you no longer need them.</p>
      </div>
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
        <button class="danger" @click="deleteSelectedOrphaned" style="margin-left: auto" :disabled="selectedOrphaned.size === 0">
          Move to Trash
        </button>
      </div>

      <div v-if="orphaned.length > 0" class="project-list">
        <div v-for="orphan in orphaned" :key="orphan.dir" class="project-item">
          <input
            type="checkbox"
            class="checkbox orphaned-checkbox"
            :checked="selectedOrphaned.has(orphan.dir)"
            @change="toggleOrphanedCheckbox(orphan.dir)"
          />
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
            <button class="danger" @click="deleteOrphaned(orphan.dir)">Delete</button>
          </div>
        </div>
      </div>
      <div v-else class="empty-state">
        <h3>No orphaned projects found</h3>
        <p>Great! Your projects are clean.</p>
      </div>
    </div>

    <!-- Debug Tab -->
    <div v-if="activeTab === 'debug'" class="tab-content active">
      <div class="info-note">
        <p><strong>Debug Files:</strong> Debug logs and diagnostic information from Claude Code. These files are generated during sessions and can be safely removed to free up disk space.</p>
      </div>
      <div class="bulk-actions">
        <div class="select-all-container">
          <input
            type="checkbox"
            id="select-all-debug"
            class="checkbox"
            :checked="allDebugFilesSelected"
            @change="toggleAllDebugFiles"
          />
          <label for="select-all-debug">Select All</label>
        </div>
        <button class="danger" @click="cleanSelectedDebugFiles" style="margin-left: auto" :disabled="selectedDebugFiles.size === 0">
          Move to Trash
        </button>
      </div>

      <div v-if="debugFiles.length > 0" class="project-list">
        <div v-for="debug in debugFiles" :key="debug.filename" class="project-item">
          <input
            type="checkbox"
            class="checkbox debug-checkbox"
            :checked="selectedDebugFiles.has(debug.filename)"
            @change="toggleDebugFileCheckbox(debug.filename)"
          />
          <div class="project-info">
            <div class="project-name">{{ debug.filename }}</div>
            <div class="project-meta">
              <span class="size-indicator">Size: {{ formatBytes(debug.size) }}</span>
              <span>Created: {{ formatDate(debug.created) }}</span>
              <span>Modified: {{ formatDate(debug.modified) }}</span>
            </div>
          </div>
          <div class="project-actions">
            <button class="danger" @click="cleanDebugFile(debug.filename)">Remove</button>
          </div>
        </div>
      </div>
      <div v-else class="empty-state">
        <h3>No debug files found</h3>
      </div>
    </div>

    <!-- Orphaned Debug Tab -->
    <div v-if="activeTab === 'orphaned-debug'" class="tab-content active">
      <div class="info-note">
        <p><strong>Orphaned Debug Files:</strong> Debug files that don't correspond to any active sessions. These can be safely removed to free up disk space.</p>
      </div>
      <div class="bulk-actions">
        <div class="select-all-container">
          <input
            type="checkbox"
            id="select-all-orphaned-debug"
            class="checkbox"
            :checked="allOrphanedDebugFilesSelected"
            @change="toggleAllOrphanedDebugFiles"
          />
          <label for="select-all-orphaned-debug">Select All</label>
        </div>
        <button class="danger" @click="cleanSelectedOrphanedDebugFiles" style="margin-left: auto" :disabled="selectedOrphanedDebugFiles.size === 0">
          Move to Trash
        </button>
      </div>

      <div v-if="orphanedDebugFiles.length > 0" class="project-list">
        <div v-for="debug in orphanedDebugFiles" :key="debug.filename" class="project-item">
          <input
            type="checkbox"
            class="checkbox orphaned-debug-checkbox"
            :checked="selectedOrphanedDebugFiles.has(debug.filename)"
            @change="toggleOrphanedDebugFileCheckbox(debug.filename)"
          />
          <div class="project-info">
            <div class="project-name">{{ debug.filename }}</div>
            <div class="project-meta">
              <span class="status-badge status-orphaned">Orphaned</span>
              <span class="size-indicator">Size: {{ formatBytes(debug.size) }}</span>
              <span>Created: {{ formatDate(debug.created) }}</span>
              <span>Modified: {{ formatDate(debug.modified) }}</span>
            </div>
          </div>
          <div class="project-actions">
            <button class="danger" @click="cleanOrphanedDebugFile(debug.filename)">Clean</button>
          </div>
        </div>
      </div>
      <div v-else class="empty-state">
        <h3>No orphaned debug files found</h3>
        <p>Great! All your debug files are associated with active sessions.</p>
      </div>
    </div>

    <!-- Todos Tab -->
    <div v-if="activeTab === 'todos'" class="tab-content active">
      <div class="info-note">
        <p><strong>Todos Files:</strong> Todo lists from Claude Code sessions. These files contain task tracking information from active sessions.</p>
      </div>
      <div class="bulk-actions">
        <div class="select-all-container">
          <input
            type="checkbox"
            id="select-all-todos"
            class="checkbox"
            :checked="allTodosSelected"
            @change="toggleAllTodos"
          />
          <label for="select-all-todos">Select All</label>
        </div>
        <button class="danger" @click="cleanSelectedTodos" style="margin-left: auto" :disabled="selectedTodos.size === 0">
          Move to Trash
        </button>
      </div>

      <div v-if="todosFiles.length > 0" class="project-list">
        <div v-for="todo in todosFiles" :key="todo.filename" class="project-item">
          <input
            type="checkbox"
            class="checkbox todos-checkbox"
            :checked="selectedTodos.has(todo.filename)"
            @change="toggleTodosCheckbox(todo.filename)"
          />
          <div class="project-info">
            <div class="project-name">{{ todo.filename }}</div>
            <div class="project-meta">
              <span class="size-indicator">Size: {{ formatBytes(todo.size) }}</span>
              <span>Created: {{ formatDate(todo.created) }}</span>
              <span>Modified: {{ formatDate(todo.modified) }}</span>
            </div>
          </div>
          <div class="project-actions">
            <button class="danger" @click="cleanTodosFile(todo.filename)">Remove</button>
          </div>
        </div>
      </div>
      <div v-else class="empty-state">
        <h3>No todos files found</h3>
      </div>
    </div>

    <!-- Orphaned Todos Tab -->
    <div v-if="activeTab === 'orphaned-todos'" class="tab-content active">
      <div class="info-note">
        <p><strong>Orphaned Todos Files:</strong> Todos files that don't correspond to any active sessions. These can be safely removed to free up disk space.</p>
      </div>
      <div class="bulk-actions">
        <div class="select-all-container">
          <input
            type="checkbox"
            id="select-all-orphaned-todos"
            class="checkbox"
            :checked="allOrphanedTodosSelected"
            @change="toggleAllOrphanedTodos"
          />
          <label for="select-all-orphaned-todos">Select All</label>
        </div>
        <button class="danger" @click="cleanSelectedOrphanedTodos" style="margin-left: auto" :disabled="selectedOrphanedTodos.size === 0">
          Move to Trash
        </button>
      </div>

      <div v-if="orphanedTodosFiles.length > 0" class="project-list">
        <div v-for="todo in orphanedTodosFiles" :key="todo.filename" class="project-item">
          <input
            type="checkbox"
            class="checkbox orphaned-todos-checkbox"
            :checked="selectedOrphanedTodos.has(todo.filename)"
            @change="toggleOrphanedTodosCheckbox(todo.filename)"
          />
          <div class="project-info">
            <div class="project-name">{{ todo.filename }}</div>
            <div class="project-meta">
              <span class="status-badge status-orphaned">Orphaned</span>
              <span class="size-indicator">Size: {{ formatBytes(todo.size) }}</span>
              <span>Created: {{ formatDate(todo.created) }}</span>
              <span>Modified: {{ formatDate(todo.modified) }}</span>
            </div>
          </div>
          <div class="project-actions">
            <button class="danger" @click="cleanOrphanedTodosFile(todo.filename)">Clean</button>
          </div>
        </div>
      </div>
      <div v-else class="empty-state">
        <h3>No orphaned todos files found</h3>
        <p>Great! All your todos are associated with active sessions.</p>
      </div>
    </div>

    <!-- Backups Tab -->
    <div v-if="activeTab === 'backups'" class="tab-content active">
      <div class="info-note">
        <p><strong>Configuration Backups:</strong> Automatic backups of your .claude.json configuration file created before major operations. You can safely remove old backups to free up disk space.</p>
      </div>
      <div class="bulk-actions">
        <div class="select-all-container">
          <input
            type="checkbox"
            id="select-all-backups"
            class="checkbox"
            :checked="allBackupsSelected"
            @change="toggleAllBackups"
          />
          <label for="select-all-backups">Select All</label>
        </div>
        <button class="danger" @click="removeSelectedBackups" style="margin-left: auto" :disabled="selectedBackups.size === 0">
          Move to Trash
        </button>
      </div>
      <div v-if="backups.length > 0" class="project-list">
        <div v-for="backup in backups" :key="backup.filename" class="project-item">
          <input
            type="checkbox"
            class="checkbox backup-checkbox"
            :checked="selectedBackups.has(backup.filename)"
            @change="toggleBackupCheckbox(backup.filename)"
          />
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
            <button class="danger" @click="removeBackup(backup)">Remove</button>
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
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';

// State
const activeTab = ref('sessions');
const jsonProjects = ref([]);
const sessions = ref([]);
const orphaned = ref([]);
const fileHistory = ref([]);
const orphanedFileHistory = ref([]);
const debugFiles = ref([]);
const orphanedDebugFiles = ref([]);
const todosFiles = ref([]);
const orphanedTodosFiles = ref([]);
const backups = ref([]);
const stats = ref({});
const selectedProjects = ref(new Set());
const selectedSessions = ref(new Set());
const selectedOrphaned = ref(new Set());
const selectedFileHistory = ref(new Set());
const selectedOrphanedFileHistory = ref(new Set());
const selectedDebugFiles = ref(new Set());
const selectedOrphanedDebugFiles = ref(new Set());
const selectedTodos = ref(new Set());
const selectedOrphanedTodos = ref(new Set());
const selectedBackups = ref(new Set());
const successMessage = ref('');
const errorMessage = ref('');
const showConfirmation = ref(false);
const confirmationTitle = ref('');
const confirmationMessage = ref('');
let confirmationCallback = null;

// Directory paths - will be set in onMounted
let claudeDir = '';
let ccCleanerDir = '';

const tabs = [
  { id: 'sessions', label: 'Session Data (.claude/projects)' },
  { id: 'json-projects', label: 'Projects (.claude.json)' },
  { id: 'orphaned', label: 'Orphaned Projects' },
  { id: 'file-history', label: 'File History' },
  { id: 'orphaned-file-history', label: 'Orphaned File History' },
  { id: 'debug', label: 'Debug' },
  { id: 'orphaned-debug', label: 'Orphaned Debug' },
  { id: 'todos', label: 'Todos' },
  { id: 'orphaned-todos', label: 'Orphaned Todos' },
  { id: 'backups', label: 'Config Backups' }
];

// Computed properties
const allProjectsSelected = computed(() => {
  return jsonProjects.value.length > 0 && jsonProjects.value.every(p => selectedProjects.value.has(p.path));
});

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

const allDebugFilesSelected = computed(() => {
  return debugFiles.value.length > 0 && debugFiles.value.every(f => selectedDebugFiles.value.has(f.filename));
});

const allOrphanedDebugFilesSelected = computed(() => {
  return orphanedDebugFiles.value.length > 0 && orphanedDebugFiles.value.every(f => selectedOrphanedDebugFiles.value.has(f.filename));
});

const allTodosSelected = computed(() => {
  return todosFiles.value.length > 0 && todosFiles.value.every(f => selectedTodos.value.has(f.filename));
});

const allOrphanedTodosSelected = computed(() => {
  return orphanedTodosFiles.value.length > 0 && orphanedTodosFiles.value.every(f => selectedOrphanedTodos.value.has(f.filename));
});

const allBackupsSelected = computed(() => {
  return backups.value.length > 0 && backups.value.every(b => selectedBackups.value.has(b.filename));
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
    case 'debug':
      return debugFiles.value.length;
    case 'orphaned-debug':
      return orphanedDebugFiles.value.length;
    case 'todos':
      return todosFiles.value.length;
    case 'orphaned-todos':
      return orphanedTodosFiles.value.length;
    case 'backups':
      return backups.value.length;
    default:
      return 0;
  }
}

function getTabSelected(tabId) {
  switch (tabId) {
    case 'json-projects':
      return selectedProjects.value.size > 0 ? selectedProjects.value.size : null;
    case 'sessions':
      return selectedSessions.value.size > 0 ? selectedSessions.value.size : null;
    case 'file-history':
      return selectedFileHistory.value.size > 0 ? selectedFileHistory.value.size : null;
    case 'orphaned-file-history':
      return selectedOrphanedFileHistory.value.size > 0 ? selectedOrphanedFileHistory.value.size : null;
    case 'orphaned':
      return selectedOrphaned.value.size > 0 ? selectedOrphaned.value.size : null;
    case 'debug':
      return selectedDebugFiles.value.size > 0 ? selectedDebugFiles.value.size : null;
    case 'orphaned-debug':
      return selectedOrphanedDebugFiles.value.size > 0 ? selectedOrphanedDebugFiles.value.size : null;
    case 'todos':
      return selectedTodos.value.size > 0 ? selectedTodos.value.size : null;
    case 'orphaned-todos':
      return selectedOrphanedTodos.value.size > 0 ? selectedOrphanedTodos.value.size : null;
    default:
      return null;
  }
}

function shouldHighlightTab(tabId) {
  const tabsToHighlight = ['orphaned-file-history', 'orphaned', 'orphaned-debug', 'orphaned-todos'];
  if (!tabsToHighlight.includes(tabId)) return false;
  return getTabCount(tabId) > 0;
}

function formatTabLabel(label) {
  const match = label.match(/^(.*?)\s*(\(.*\))$/);
  if (match) {
    return {
      bold: match[1],
      normal: ' ' + match[2]
    };
  }
  return {
    bold: label,
    normal: ''
  };
}

// Tab navigation
function toggleProjectCheckbox(path) {
  if (selectedProjects.value.has(path)) {
    selectedProjects.value.delete(path);
  } else {
    selectedProjects.value.add(path);
  }
  selectedProjects.value = new Set(selectedProjects.value);
}

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

function toggleAllProjects() {
  if (allProjectsSelected.value) {
    selectedProjects.value.clear();
  } else {
    jsonProjects.value.forEach(p => selectedProjects.value.add(p.path));
  }
  selectedProjects.value = new Set(selectedProjects.value);
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

function toggleBackupCheckbox(filename) {
  if (selectedBackups.value.has(filename)) {
    selectedBackups.value.delete(filename);
  } else {
    selectedBackups.value.add(filename);
  }
  selectedBackups.value = new Set(selectedBackups.value);
}

function toggleAllBackups() {
  if (allBackupsSelected.value) {
    selectedBackups.value.clear();
  } else {
    backups.value.forEach(b => selectedBackups.value.add(b.filename));
  }
  selectedBackups.value = new Set(selectedBackups.value);
}

function toggleDebugFileCheckbox(filename) {
  if (selectedDebugFiles.value.has(filename)) {
    selectedDebugFiles.value.delete(filename);
  } else {
    selectedDebugFiles.value.add(filename);
  }
  selectedDebugFiles.value = new Set(selectedDebugFiles.value);
}

function toggleAllDebugFiles() {
  if (allDebugFilesSelected.value) {
    selectedDebugFiles.value.clear();
  } else {
    debugFiles.value.forEach(f => selectedDebugFiles.value.add(f.filename));
  }
  selectedDebugFiles.value = new Set(selectedDebugFiles.value);
}

function toggleOrphanedDebugFileCheckbox(filename) {
  if (selectedOrphanedDebugFiles.value.has(filename)) {
    selectedOrphanedDebugFiles.value.delete(filename);
  } else {
    selectedOrphanedDebugFiles.value.add(filename);
  }
  selectedOrphanedDebugFiles.value = new Set(selectedOrphanedDebugFiles.value);
}

function toggleAllOrphanedDebugFiles() {
  if (allOrphanedDebugFilesSelected.value) {
    selectedOrphanedDebugFiles.value.clear();
  } else {
    orphanedDebugFiles.value.forEach(f => selectedOrphanedDebugFiles.value.add(f.filename));
  }
  selectedOrphanedDebugFiles.value = new Set(selectedOrphanedDebugFiles.value);
}

function toggleTodosCheckbox(filename) {
  if (selectedTodos.value.has(filename)) {
    selectedTodos.value.delete(filename);
  } else {
    selectedTodos.value.add(filename);
  }
  selectedTodos.value = new Set(selectedTodos.value);
}

function toggleAllTodos() {
  if (allTodosSelected.value) {
    selectedTodos.value.clear();
  } else {
    todosFiles.value.forEach(f => selectedTodos.value.add(f.filename));
  }
  selectedTodos.value = new Set(selectedTodos.value);
}

function toggleOrphanedTodosCheckbox(filename) {
  if (selectedOrphanedTodos.value.has(filename)) {
    selectedOrphanedTodos.value.delete(filename);
  } else {
    selectedOrphanedTodos.value.add(filename);
  }
  selectedOrphanedTodos.value = new Set(selectedOrphanedTodos.value);
}

function toggleAllOrphanedTodos() {
  if (allOrphanedTodosSelected.value) {
    selectedOrphanedTodos.value.clear();
  } else {
    orphanedTodosFiles.value.forEach(f => selectedOrphanedTodos.value.add(f.filename));
  }
  selectedOrphanedTodos.value = new Set(selectedOrphanedTodos.value);
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
    const [jsonRes, sessionsRes, fileHistoryRes, orphanedFileHistoryRes, orphanedRes, debugRes, orphanedDebugRes, todosRes, orphanedTodosRes, statsRes, backupsRes] = await Promise.all([
      fetch('/api/projects/json'),
      fetch('/api/projects/sessions'),
      fetch('/api/projects/file-history'),
      fetch('/api/projects/orphaned-file-history'),
      fetch('/api/projects/orphaned'),
      fetch('/api/projects/debug'),
      fetch('/api/projects/orphaned-debug'),
      fetch('/api/projects/todos'),
      fetch('/api/projects/orphaned-todos'),
      fetch('/api/stats'),
      fetch('/api/backups')
    ]);

    jsonProjects.value = await jsonRes.json();
    sessions.value = await sessionsRes.json();
    fileHistory.value = await fileHistoryRes.json();
    orphanedFileHistory.value = await orphanedFileHistoryRes.json();
    orphaned.value = await orphanedRes.json();
    debugFiles.value = await debugRes.json();
    orphanedDebugFiles.value = await orphanedDebugRes.json();
    todosFiles.value = await todosRes.json();
    orphanedTodosFiles.value = await orphanedTodosRes.json();
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

async function removeSelectedProjects() {
  if (selectedProjects.value.size === 0) {
    showError('No projects selected');
    return;
  }

  const projectPaths = Array.from(selectedProjects.value);
  showConfirmationDialog(
    'Remove Projects from Configuration',
    `Remove ${projectPaths.length} project(s) from .claude.json?`,
    async () => {
      try {
        for (const projectPath of projectPaths) {
          const res = await fetch('/api/remove/project', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectPath })
          });
          const data = await res.json();
          if (!data.success) {
            showError(data.message || 'Failed to remove project: ' + projectPath);
            return;
          }
        }
        showSuccess(`${projectPaths.length} project(s) removed from configuration`);
        selectedProjects.value.clear();
        loadData();
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

async function removeBackup(backup) {
  showConfirmationDialog(
    'Move Backup to Trash',
    `Move this backup file to trash?\n\n${backup.filename}\n\nSize: ${formatBytes(backup.size)}`,
    async () => {
      try {
        const res = await fetch('/api/remove/backup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: backup.filename })
        });
        const data = await res.json();
        if (data.success) {
          showSuccess('Backup moved to trash');
          loadData();
        } else {
          showError(data.message || 'Failed to move backup to trash');
        }
      } catch (error) {
        showError('Error: ' + error.message);
      }
    }
  );
}

async function removeSelectedBackups() {
  if (selectedBackups.value.size === 0) {
    showError('No backups selected');
    return;
  }

  showConfirmationDialog(
    'Move Selected Backups to Trash',
    `Move ${selectedBackups.value.size} backup(s) to trash?`,
    async () => {
      try {
        const res = await fetch('/api/remove/backups', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filenames: Array.from(selectedBackups.value) })
        });
        const data = await res.json();
        if (data.success) {
          showSuccess(`Moved ${data.results.filter(r => r.success).length} backup(s) to trash`);
          selectedBackups.value.clear();
          loadData();
        } else {
          showError(data.message || 'Failed to move backups to trash');
        }
      } catch (error) {
        showError('Error: ' + error.message);
      }
    }
  );
}

async function cleanDebugFile(filename) {
  showConfirmationDialog(
    'Move Debug File to Trash',
    `Move this debug file to trash?\n\n${filename}`,
    async () => {
      try {
        const res = await fetch('/api/clean/debug', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename })
        });
        const data = await res.json();
        if (data.success) {
          showSuccess('Debug file moved to trash');
          selectedDebugFiles.value.delete(filename);
          loadData();
        } else {
          showError(data.message || 'Failed to move debug file to trash');
        }
      } catch (error) {
        showError('Error: ' + error.message);
      }
    }
  );
}

async function cleanSelectedDebugFiles() {
  if (selectedDebugFiles.value.size === 0) {
    showError('No debug files selected');
    return;
  }

  showConfirmationDialog(
    'Move Selected Debug Files to Trash',
    `Move ${selectedDebugFiles.value.size} debug file(s) to trash?`,
    async () => {
      try {
        const res = await fetch('/api/clean/debug-files', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filenames: Array.from(selectedDebugFiles.value) })
        });
        const data = await res.json();
        if (data.success) {
          showSuccess(`Moved ${data.results.filter(r => r.success).length} debug file(s) to trash`);
          selectedDebugFiles.value.clear();
          loadData();
        } else {
          showError(data.message || 'Failed to move debug files to trash');
        }
      } catch (error) {
        showError('Error: ' + error.message);
      }
    }
  );
}

async function cleanOrphanedDebugFile(filename) {
  showConfirmationDialog(
    'Move Orphaned Debug File to Trash',
    `Move this orphaned debug file to trash?\n\n${filename}`,
    async () => {
      try {
        const res = await fetch('/api/clean/orphaned-debug', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename })
        });
        const data = await res.json();
        if (data.success) {
          showSuccess('Orphaned debug file moved to trash');
          selectedOrphanedDebugFiles.value.delete(filename);
          loadData();
        } else {
          showError(data.message || 'Failed to move orphaned debug file to trash');
        }
      } catch (error) {
        showError('Error: ' + error.message);
      }
    }
  );
}

async function cleanSelectedOrphanedDebugFiles() {
  if (selectedOrphanedDebugFiles.value.size === 0) {
    showError('No orphaned debug files selected');
    return;
  }

  showConfirmationDialog(
    'Move Selected Orphaned Debug Files to Trash',
    `Move ${selectedOrphanedDebugFiles.value.size} orphaned debug file(s) to trash?`,
    async () => {
      try {
        const res = await fetch('/api/clean/orphaned-debug-files', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filenames: Array.from(selectedOrphanedDebugFiles.value) })
        });
        const data = await res.json();
        if (data.success) {
          showSuccess(`Moved ${data.results.filter(r => r.success).length} orphaned debug file(s) to trash`);
          selectedOrphanedDebugFiles.value.clear();
          loadData();
        } else {
          showError(data.message || 'Failed to move orphaned debug files to trash');
        }
      } catch (error) {
        showError('Error: ' + error.message);
      }
    }
  );
}

async function cleanTodosFile(filename) {
  showConfirmationDialog(
    'Move Todos File to Trash',
    `Move this todos file to trash?\n\n${filename}`,
    async () => {
      try {
        const res = await fetch('/api/clean/todo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename })
        });
        const data = await res.json();
        if (data.success) {
          showSuccess('Todos file moved to trash');
          selectedTodos.value.delete(filename);
          loadData();
        } else {
          showError(data.message || 'Failed to move todos file to trash');
        }
      } catch (error) {
        showError('Error: ' + error.message);
      }
    }
  );
}

async function cleanSelectedTodos() {
  if (selectedTodos.value.size === 0) {
    showError('No todos files selected');
    return;
  }

  showConfirmationDialog(
    'Move Selected Todos Files to Trash',
    `Move ${selectedTodos.value.size} todos file(s) to trash?`,
    async () => {
      try {
        const res = await fetch('/api/clean/todos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filenames: Array.from(selectedTodos.value) })
        });
        const data = await res.json();
        if (data.success) {
          showSuccess(`Moved ${data.results.filter(r => r.success).length} todos file(s) to trash`);
          selectedTodos.value.clear();
          loadData();
        } else {
          showError(data.message || 'Failed to move todos files to trash');
        }
      } catch (error) {
        showError('Error: ' + error.message);
      }
    }
  );
}

async function cleanOrphanedTodosFile(filename) {
  showConfirmationDialog(
    'Move Orphaned Todos File to Trash',
    `Move this orphaned todos file to trash?\n\n${filename}`,
    async () => {
      try {
        const res = await fetch('/api/clean/orphaned-todo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename })
        });
        const data = await res.json();
        if (data.success) {
          showSuccess('Orphaned todos file moved to trash');
          selectedOrphanedTodos.value.delete(filename);
          loadData();
        } else {
          showError(data.message || 'Failed to move orphaned todos file to trash');
        }
      } catch (error) {
        showError('Error: ' + error.message);
      }
    }
  );
}

async function cleanSelectedOrphanedTodos() {
  if (selectedOrphanedTodos.value.size === 0) {
    showError('No orphaned todos files selected');
    return;
  }

  showConfirmationDialog(
    'Move Selected Orphaned Todos Files to Trash',
    `Move ${selectedOrphanedTodos.value.size} orphaned todos file(s) to trash?`,
    async () => {
      try {
        const res = await fetch('/api/clean/orphaned-todos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filenames: Array.from(selectedOrphanedTodos.value) })
        });
        const data = await res.json();
        if (data.success) {
          showSuccess(`Moved ${data.results.filter(r => r.success).length} orphaned todos file(s) to trash`);
          selectedOrphanedTodos.value.clear();
          loadData();
        } else {
          showError(data.message || 'Failed to move orphaned todos files to trash');
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

function refreshPage() {
  location.reload();
}

async function openDirectory(dirPath) {
  try {
    const response = await fetch('/api/open/directory', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ path: dirPath })
    });

    const data = await response.json();
    if (!data.success) {
      showError(data.message || 'Failed to open directory');
    }
  } catch (error) {
    showError(`Error opening directory: ${error.message}`);
  }
}

// Lifecycle
onMounted(() => {
  // Initialize directory paths using tilde expansion
  claudeDir = '~/.claude'.replace('~', window.location.hostname === 'localhost' ? `/Users/${navigator.userAgent}` : '~');
  ccCleanerDir = '~/.cc-cleaner'.replace('~', window.location.hostname === 'localhost' ? `/Users/${navigator.userAgent}` : '~');

  // For browser, we can't get home directory, so we'll pass tilde paths and let backend handle it
  claudeDir = '~/.claude';
  ccCleanerDir = '~/.cc-cleaner';

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
  display: flex;
  flex-direction: column;
  padding-top: 80px;
}

.header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #333;
  padding: 20px;
  gap: 20px;
  flex-shrink: 0;
  background: #0a0a0a;
  height: 80px;
  box-sizing: border-box;
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
  margin: 0;
}

.logo-title {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  transition: opacity 0.2s ease;
}

.logo-title:hover {
  opacity: 0.7;
}

.logo-title:active {
  opacity: 0.5;
}

.logo {
  width: 36px;
  height: 36px;
  object-fit: contain;
  flex-shrink: 0;
}

.stats {
  display: flex;
  gap: 30px;
  font-size: 14px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-label {
  color: #999;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  text-align: center;
}

.stat-value {
  font-size: 18px;
  font-weight: 600;
  color: #4a9eff;
  margin-top: 5px;
  text-align: center;
}

.main-container {
  display: flex;
  flex: 1;
  min-height: 0;
  margin-left: 220px;
}

.sidebar {
  position: fixed;
  left: 0;
  top: 80px;
  width: 220px;
  height: calc(100vh - 80px);
  border-right: 1px solid #333;
  overflow-y: auto;
  flex-shrink: 0;
  background: #0a0a0a;
  display: flex;
  flex-direction: column;
}

.sidebar-footer {
  padding: 16px;
  border-top: 1px solid #333;
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: auto;
  flex-shrink: 0;
}

.github-icon {
  width: 28px;
  height: 28px;
  opacity: 0.7;
  transition: opacity 0.2s;
  cursor: pointer;
}

.github-icon:hover {
  opacity: 1;
}

.folder-buttons-section {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid #333;
  flex-shrink: 0;
}

.folder-button {
  background: none;
  border: none;
  cursor: pointer;
  padding: 6px 10px;
  display: flex;
  align-items: center;
  gap: 4px;
  color: #e0e0e0;
  font-size: 13px;
  border-radius: 4px;
  opacity: 0.7;
  transition: opacity 0.2s, background-color 0.2s;
  flex: 1;
  justify-content: center;
}

.folder-button:hover {
  opacity: 1;
  background-color: rgba(255, 255, 255, 0.05);
}

.folder-button:active {
  opacity: 0.9;
}

.folder-label {
  font-family: monospace;
  font-size: 12px;
}

.content-area {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
}

.tabs {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 0;
}

.tab-button {
  padding: 12px 16px;
  background: none;
  border: none;
  border-left: 3px solid transparent;
  color: #999;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.2s;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 6px;
  justify-content: space-between;
  width: 100%;
}

.tab-button:hover {
  color: #e0e0e0;
  background: #1a1a1a;
}

.tab-button.active {
  color: #4a9eff;
  border-left-color: #4a9eff;
  background: #1a1a1a;
}

.tab-label {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.tab-label-bold {
  font-weight: 700;
}

.tab-label-normal {
  font-weight: 400;
  font-size: 11px;
  line-height: 1.2;
}

.tab-info {
  display: flex;
  gap: 6px;
  font-size: 12px;
  align-items: center;
}

.tab-count {
  display: inline-block;
  background: #333;
  color: #999;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 11px;
  font-weight: 600;
}

.tab-count-highlight {
  background: #ff6b6b;
  color: #fff;
}

.tab-button.active .tab-count {
  background: #4a9eff;
  color: #000;
}

.tab-button.active .tab-count-highlight {
  background: #ff6b6b;
  color: #fff;
}

.tab-selected {
  color: #6dd86d;
  font-size: 11px;
  font-weight: 600;
}

.tab-content {
  width: 100%;
  margin-bottom: 40px;
}

.project-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 1400px;
  margin-left: auto;
  margin-right: auto;
}

.project-item {
  background: #1a1a1a;
  border: 1px solid #333;
  border-radius: 6px;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
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
  flex-shrink: 0;
}

.checkbox {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
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

button.danger:disabled {
  background: #888888;
  border-color: #888888;
  cursor: not-allowed;
  opacity: 0.6;
}

.bulk-actions {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  padding: 12px;
  background: #1a1a1a;
  border-radius: 6px;
  border: 1px solid #333;
  max-width: 1400px;
  margin-left: auto;
  margin-right: auto;
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
  margin-top: auto;
  max-width: 1400px;
  margin-left: auto;
  margin-right: auto;
  flex-shrink: 0;
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
