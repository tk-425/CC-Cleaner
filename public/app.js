// State
let state = {
  jsonProjects: [],
  sessions: [],
  orphaned: [],
  selectedSessions: new Set(),
  selectedOrphaned: new Set(),
  stats: {}
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  loadData();
  setupEventListeners();
});

// Tab Management
function initTabs() {
  document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.getAttribute('data-tab');
      switchTab(tabName);
    });
  });
}

function switchTab(tabName) {
  // Hide all tabs
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.remove('active');
  });
  document.querySelectorAll('.tab-button').forEach(btn => {
    btn.classList.remove('active');
  });

  // Show selected tab
  document.getElementById(tabName).classList.add('active');
  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

  // Reload data for the tab
  if (tabName === 'json-projects') {
    renderJsonProjects();
  } else if (tabName === 'sessions') {
    renderSessions();
  } else if (tabName === 'orphaned') {
    renderOrphaned();
  }
}

// Data Loading
async function loadData() {
  try {
    const [jsonRes, sessionsRes, orphanedRes, statsRes] = await Promise.all([
      fetch('/api/projects/json'),
      fetch('/api/projects/sessions'),
      fetch('/api/projects/orphaned'),
      fetch('/api/stats')
    ]);

    state.jsonProjects = await jsonRes.json();
    state.sessions = await sessionsRes.json();
    state.orphaned = await orphanedRes.json();
    state.stats = await statsRes.json();

    updateStats();
    renderJsonProjects();
  } catch (error) {
    showError('Failed to load data: ' + error.message);
  }
}

// Update Statistics
function updateStats() {
  document.getElementById('stat-projects').textContent = state.stats.totalProjects || 0;
  document.getElementById('stat-size').textContent = state.stats.formatBytes || '0 B';
  document.getElementById('stat-orphaned').textContent = state.stats.orphanedCount || 0;
}

// Render Functions
function renderJsonProjects() {
  const container = document.getElementById('json-projects-content');

  if (state.jsonProjects.length === 0) {
    container.innerHTML = '<div class="empty-state"><h3>No projects found</h3></div>';
    return;
  }

  const html = state.jsonProjects.map((project, idx) => {
    const projectName = project.path.split('/').pop();
    const statusClass = project.exists ? 'status-exists' : 'status-missing';
    const statusText = project.exists ? 'Project Exists' : 'Project Missing';
    const lastCost = project.config?.lastCost ? `$${project.config.lastCost.toFixed(4)}` : 'N/A';
    const lastDuration = project.config?.lastDuration ? formatDuration(project.config.lastDuration) : 'N/A';

    return `
      <div class="project-item">
        <div class="project-info">
          <div class="project-name">${escapeHtml(projectName)}</div>
          <div class="project-path">${escapeHtml(project.path)}</div>
          <div class="project-meta">
            <span class="status-badge ${statusClass}">${statusText}</span>
            <span>Last Cost: ${lastCost}</span>
            <span>Duration: ${lastDuration}</span>
          </div>
        </div>
        <div class="project-actions">
          <button onclick="removeProject('${escapeAttr(project.path)}')">Remove from Config</button>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = html;
}

function renderSessions() {
  const container = document.getElementById('sessions-content');

  if (state.sessions.length === 0) {
    container.innerHTML = '<div class="empty-state"><h3>No session data found</h3></div>';
    return;
  }

  const html = state.sessions.map((session) => {
    const size = formatBytes(session.size);
    const checked = state.selectedSessions.has(session.dir) ? 'checked' : '';

    return `
      <div class="project-item">
        <div class="project-info">
          <div class="project-name">${escapeHtml(session.dir)}</div>
          <div class="project-path">${escapeHtml(session.actualPath)}</div>
          <div class="project-meta">
            <span class="size-indicator">Size: ${size}</span>
            <span>Files/Dirs: ${session.files}</span>
          </div>
        </div>
        <div class="project-actions">
          <input type="checkbox" class="checkbox session-checkbox" data-dir="${escapeAttr(session.dir)}" ${checked}>
          <button onclick="cleanSession('${escapeAttr(session.dir)}')">Clean</button>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = html;

  // Add event listeners to checkboxes
  document.querySelectorAll('.session-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', (e) => {
      if (e.target.checked) {
        state.selectedSessions.add(e.target.dataset.dir);
      } else {
        state.selectedSessions.delete(e.target.dataset.dir);
      }
      updateSelectAllCheckbox('sessions');
    });
  });

  updateSelectAllCheckbox('sessions');
}

function renderOrphaned() {
  const container = document.getElementById('orphaned-content');

  if (state.orphaned.length === 0) {
    container.innerHTML = '<div class="empty-state"><h3>No orphaned projects found</h3><p>Great! Your projects are clean.</p></div>';
    return;
  }

  const html = state.orphaned.map((orphan) => {
    const size = formatBytes(orphan.size);
    const checked = state.selectedOrphaned.has(orphan.dir) ? 'checked' : '';

    return `
      <div class="project-item">
        <div class="project-info">
          <div class="project-name">${escapeHtml(orphan.dir)}</div>
          <div class="project-path">${escapeHtml(orphan.actualPath)}</div>
          <div class="project-meta">
            <span class="status-badge status-orphaned">Orphaned</span>
            <span class="size-indicator">Size: ${size}</span>
            <span>Files/Dirs: ${orphan.files}</span>
          </div>
        </div>
        <div class="project-actions">
          <input type="checkbox" class="checkbox orphaned-checkbox" data-dir="${escapeAttr(orphan.dir)}" ${checked}>
          <button class="danger" onclick="deleteOrphaned('${escapeAttr(orphan.dir)}')">Delete</button>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = html;

  // Add event listeners to checkboxes
  document.querySelectorAll('.orphaned-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', (e) => {
      if (e.target.checked) {
        state.selectedOrphaned.add(e.target.dataset.dir);
      } else {
        state.selectedOrphaned.delete(e.target.dataset.dir);
      }
      updateSelectAllCheckbox('orphaned');
    });
  });

  updateSelectAllCheckbox('orphaned');
}

// Helper Functions
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function formatDuration(ms) {
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

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function escapeAttr(text) {
  return text.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function updateSelectAllCheckbox(type) {
  const selectAllId = type === 'sessions' ? 'select-all-sessions' : 'select-all-orphaned';
  const selectAllCheckbox = document.getElementById(selectAllId);
  const checkboxes = type === 'sessions'
    ? document.querySelectorAll('.session-checkbox')
    : document.querySelectorAll('.orphaned-checkbox');

  const allChecked = checkboxes.length > 0 && Array.from(checkboxes).every(cb => cb.checked);
  selectAllCheckbox.checked = allChecked;
}

// Actions
function showConfirmation(title, message, callback) {
  const dialog = document.getElementById('confirmation-dialog');
  document.getElementById('dialog-title').textContent = title;
  document.getElementById('dialog-message').textContent = message;
  dialog.classList.add('show');

  const confirmBtn = document.getElementById('dialog-confirm');
  const cancelBtn = document.getElementById('dialog-cancel');

  const cleanup = () => {
    dialog.classList.remove('show');
    confirmBtn.removeEventListener('click', confirm);
    cancelBtn.removeEventListener('click', cancel);
  };

  const confirm = () => {
    cleanup();
    callback();
  };

  const cancel = () => {
    cleanup();
  };

  confirmBtn.addEventListener('click', confirm);
  cancelBtn.addEventListener('click', cancel);
}

async function cleanSession(dir) {
  showConfirmation(
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
          showSuccess('Session moved to trash');
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
  if (state.selectedSessions.size === 0) {
    showError('No sessions selected');
    return;
  }

  showConfirmation(
    'Move Sessions to Trash',
    `Move ${state.selectedSessions.size} session(s) to trash?`,
    async () => {
      try {
        const res = await fetch('/api/clean/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dirs: Array.from(state.selectedSessions) })
        });
        const data = await res.json();
        if (data.success) {
          showSuccess(`Moved ${data.results.filter(r => r.success).length} session(s) to trash`);
          state.selectedSessions.clear();
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
  showConfirmation(
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
          showSuccess('Orphaned project moved to trash');
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
  if (state.selectedOrphaned.size === 0) {
    showError('No orphaned projects selected');
    return;
  }

  showConfirmation(
    'Move Selected Orphaned Projects to Trash',
    `Move ${state.selectedOrphaned.size} orphaned project(s) to trash?`,
    async () => {
      try {
        const res = await fetch('/api/clean/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dirs: Array.from(state.selectedOrphaned) })
        });
        const data = await res.json();
        if (data.success) {
          showSuccess(`Moved ${data.results.filter(r => r.success).length} orphaned project(s) to trash`);
          state.selectedOrphaned.clear();
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
  showConfirmation(
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
          showSuccess('Project removed from configuration');
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

function showSuccess(message) {
  const el = document.getElementById('success-message');
  el.textContent = message;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 4000);
}

function showError(message) {
  const el = document.getElementById('error-message');
  el.textContent = message;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 4000);
}

function setupEventListeners() {
  document.getElementById('select-all-sessions').addEventListener('change', (e) => {
    const checkboxes = document.querySelectorAll('.session-checkbox');
    checkboxes.forEach(cb => {
      cb.checked = e.target.checked;
      if (e.target.checked) {
        state.selectedSessions.add(cb.dataset.dir);
      } else {
        state.selectedSessions.delete(cb.dataset.dir);
      }
    });
  });

  document.getElementById('select-all-orphaned').addEventListener('change', (e) => {
    const checkboxes = document.querySelectorAll('.orphaned-checkbox');
    checkboxes.forEach(cb => {
      cb.checked = e.target.checked;
      if (e.target.checked) {
        state.selectedOrphaned.add(cb.dataset.dir);
      } else {
        state.selectedOrphaned.delete(cb.dataset.dir);
      }
    });
  });

  document.getElementById('clean-selected-btn').addEventListener('click', cleanSelectedSessions);
  document.getElementById('delete-orphaned-btn').addEventListener('click', deleteSelectedOrphaned);
}
