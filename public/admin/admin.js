/**
 * GeoStealth Admin Panel — Controller
 */

const API_URL = '';
let ADMIN_KEY = '';

const $ = (s) => document.querySelector(s);

// ─── Login ───────────────────────────────────────────────────────────────────
$('#btnLogin').addEventListener('click', async () => {
    const user = $('#adminUsername').value;
    const pass = $('#adminPassword').value;
    ADMIN_KEY = `${user}:${pass}`;

    if (!user || !pass) {
        $('#loginError').textContent = 'Fill in all fields';
        return;
    }

    try {
        $('#btnLogin').textContent = 'Connecting...';
        const res = await api('/api/stats');
        if (res.error) throw new Error(res.error);

        // Save credentials
        localStorage.setItem('gs_admin_key', ADMIN_KEY);

        $('#loginScreen').style.display = 'none';
        $('#dashboard').style.display = 'block';
        renderStats(res);
        loadKeys();
        loadLogs();
    } catch (e) {
        $('#loginError').textContent = e.message || 'Connection failed';
        $('#btnLogin').textContent = 'Connect';
    }
});

// Auto-login from saved
(function autoLogin() {
    const savedKey = localStorage.getItem('gs_admin_key');
    if (savedKey) {
        const parts = savedKey.split(':');
        if (parts.length === 2) {
            $('#adminUsername').value = parts[0];
            $('#adminPassword').value = parts[1];
        } else {
            $('#adminUsername').value = savedKey; // legacy fallback
        }
    }
})();

$('#btnLogout').addEventListener('click', () => {
    localStorage.removeItem('gs_admin_key');
    location.reload();
});

// ─── Stats ───────────────────────────────────────────────────────────────────
function renderStats(data) {
    $('#statTotal').textContent = data.totalKeys || 0;
    $('#statActive').textContent = data.activeKeys || 0;
    $('#statDevices').textContent = data.totalDevices || 0;
    $('#statExpired').textContent = data.expiredKeys || 0;
}

// ─── Keys ────────────────────────────────────────────────────────────────────
async function loadKeys() {
    const data = await api('/api/keys');
    if (data.error) return;

    const tbody = $('#keysBody');
    tbody.innerHTML = '';

    const keys = data.keys || [];
    $('#emptyState').style.display = keys.length ? 'none' : 'block';
    $('table').style.display = keys.length ? '' : 'none';

    for (const k of keys) {
        const tr = document.createElement('tr');
        const isExpired = k.expiresAt && new Date(k.expiresAt) < new Date();
        const statusClass = isExpired ? 'status-expired' : (k.active ? 'status-active' : 'status-disabled');
        const statusText = isExpired ? 'Expired' : (k.active ? 'Active' : 'Disabled');

        tr.innerHTML = `
      <td>
        <div class="key-cell" title="Click to copy" onclick="copyKey('${k.license}')">
          📋 ${k.license}
        </div>
      </td>
      <td>${k.label || '—'}</td>
      <td>
        <span class="device-badge">
          ${k.deviceCount || 0} / ${k.maxDevices}
        </span>
      </td>
      <td>${formatDate(k.createdAt)}</td>
      <td>${k.expiresAt ? formatDate(k.expiresAt) : 'Never'}</td>
      <td><span class="${statusClass}">${statusText}</span></td>
      <td>
        <button class="btn btn-ghost btn-sm" onclick="toggleKey('${k.license}')">${k.active ? 'Disable' : 'Enable'}</button>
        <button class="btn btn-danger btn-sm" onclick="deleteKey('${k.license}')">Delete</button>
      </td>
    `;
        tbody.appendChild(tr);
    }

    // Also refresh stats
    const stats = await api('/api/stats');
    if (!stats.error) renderStats(stats);
}

// ─── Logs ────────────────────────────────────────────────────────────────────
async function loadLogs() {
    const data = await api('/api/visits');
    if (data.error) return;

    const tbody = $('#logsBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const logs = data.logs || [];
    $('#logsEmptyState').style.display = logs.length ? 'none' : 'block';
    $('#logsTable').style.display = logs.length ? '' : 'none';

    for (const l of logs) {
        const tr = document.createElement('tr');
        const timeStr = new Date(l.time).toLocaleString();
        tr.innerHTML = `
            <td>${timeStr}</td>
            <td><strong>${l.label || '—'}</strong><br><small style="color:var(--text-muted)">${l.license.substring(0, 16)}...</small></td>
            <td><span class="device-badge" title="${l.device}">${l.device.substring(0, 8)}...</span></td>
            <td style="font-family: monospace; color: var(--primary);">${l.domain}</td>
        `;
        tbody.appendChild(tr);
    }
}

// ─── Create Key ──────────────────────────────────────────────────────────────
$('#btnCreate').addEventListener('click', () => {
    $('#createForm').style.display = $('#createForm').style.display === 'none' ? 'block' : 'none';
});

$('#btnCancelCreate').addEventListener('click', () => {
    $('#createForm').style.display = 'none';
});

$('#btnConfirmCreate').addEventListener('click', async () => {
    const label = $('#newLabel').value;
    const maxDevices = parseInt($('#newMaxDevices').value) || 3;
    const durationDays = parseInt($('#newDuration').value);

    $('#btnConfirmCreate').textContent = 'Creating...';

    const res = await api('/api/keys', 'POST', { label, maxDevices, durationDays });
    if (res.success) {
        showToast(`Key created: ${res.key.license}`);
        copyKey(res.key.license);
        $('#createForm').style.display = 'none';
        $('#newLabel').value = '';
        loadKeys();
    }

    $('#btnConfirmCreate').textContent = 'Generate';
});

// ─── Toggle/Delete ───────────────────────────────────────────────────────────
window.toggleKey = async function (license) {
    await api('/api/toggle', 'POST', { licenseKey: license });
    loadKeys();
};

window.deleteKey = async function (license) {
    if (!confirm(`Delete key ${license}?`)) return;
    await api('/api/keys', 'DELETE', { licenseKey: license });
    loadKeys();
};

// ─── Refresh ─────────────────────────────────────────────────────────────────
$('#btnRefresh').addEventListener('click', loadKeys);

if ($('#btnRefreshLogs')) {
    $('#btnRefreshLogs').addEventListener('click', loadLogs);
}

// ─── Copy ────────────────────────────────────────────────────────────────────
window.copyKey = function (key) {
    navigator.clipboard.writeText(key);
    showToast('Copied to clipboard!');
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
async function api(path, method = 'GET', body = null) {
    try {
        const opts = {
            method,
            headers: {
                'Content-Type': 'application/json',
                'X-Admin-Key': ADMIN_KEY,
            },
        };
        if (body) opts.body = JSON.stringify(body);

        const res = await fetch(API_URL + path, opts);
        return await res.json();
    } catch (e) {
        return { error: e.message };
    }
}

function formatDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function showToast(msg) {
    let toast = document.querySelector('.copy-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'copy-toast';
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
}
