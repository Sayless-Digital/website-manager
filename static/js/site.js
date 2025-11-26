// Site-specific page JavaScript
const currentDomain = window.currentDomain || '';

// Global state
let currentTab = 'overview';
let currentFilePath = '';
let siteData = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    loadSiteData();
    showSiteTab('overview');
    
    // Auto-refresh every 30 seconds
    setInterval(() => {
        if (currentTab === 'overview') {
            loadSiteData();
        }
    }, 30000);
});

// ==================== TAB NAVIGATION ====================

function showSiteTab(tabName) {
    currentTab = tabName;
    
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    const activeBtn = document.querySelector(`[data-tab="${tabName}"]`);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
    
    // Load tab content
    const siteContent = document.getElementById('siteContent');
    if (!siteContent) return;
    
    showLoading(siteContent);
    
    switch(tabName) {
        case 'overview':
            loadOverviewTab();
            break;
        case 'files':
            loadFilesTab();
            break;
        case 'database':
            loadDatabaseTab();
            break;
        case 'logs':
            loadLogsTab();
            break;
        case 'wordpress':
            loadWordPressTab();
            break;
    }
}

// ==================== OVERVIEW TAB ====================

async function loadSiteData() {
    try {
        const response = await fetch(`/api/sites`);
        const sites = await response.json();
        siteData = sites.find(s => s.domain === currentDomain);
    } catch (error) {
        console.error('Error loading site data:', error);
    }
}

async function loadOverviewTab() {
    const siteContent = document.getElementById('siteContent');
    if (!siteContent) return;
    
    if (!siteData) {
        await loadSiteData();
    }
    
    let status = { local_accessible: false, public_accessible: false };
    try {
        status = await apiCall(`/api/site/${currentDomain}/status`);
    } catch (error) {
        console.error('Error loading site status:', error);
    }
    
    let dbInfo = null;
    if (siteData?.db_name) {
        try {
            dbInfo = await apiCall(`/api/site/${currentDomain}/database/info`);
        } catch (error) {
            console.error('Error loading database info:', error);
        }
    }
    
    let wpInfo = null;
    try {
        wpInfo = await apiCall(`/api/site/${currentDomain}/wordpress/info`);
    } catch (error) {
        console.error('Error loading WordPress info:', error);
    }
    
    siteContent.innerHTML = `
        <div class="site-page-section">
            <h3><i class="fas fa-info-circle"></i> Site Information</h3>
            <table class="info-table">
                <tr><td>Domain</td><td><strong>${siteData?.domain || currentDomain}</strong></td></tr>
                <tr><td>Path</td><td><code style="font-size: 12px;">${siteData?.path || 'N/A'}</code></td></tr>
                <tr><td>Public HTML</td><td><code style="font-size: 12px;">${siteData?.public_html || 'N/A'}</code></td></tr>
                <tr><td>Apache Config</td><td>${siteData?.apache_config ? `<code>${siteData.apache_config}</code>` : 'Not found'}</td></tr>
                <tr><td>Apache Enabled</td><td>${siteData?.apache_enabled ? '<span class="badge badge-success">Yes</span>' : '<span class="badge badge-danger">No</span>'}</td></tr>
                ${siteData?.size_mb ? `<tr><td>Size</td><td>${siteData.size_mb} MB</td></tr>` : ''}
            </table>
        </div>
        
        <div class="site-page-section">
            <h3><i class="fas fa-signal"></i> Status</h3>
            <table class="info-table">
                <tr><td>Local Access</td><td>${status.local_accessible ? '<span class="badge badge-success">Accessible</span>' : '<span class="badge badge-danger">Not Accessible</span>'}</td></tr>
                <tr><td>Public Access</td><td>${status.public_accessible ? '<span class="badge badge-success">Accessible</span>' : '<span class="badge badge-danger">Not Accessible</span>'}</td></tr>
            </table>
        </div>
        
        ${dbInfo ? `
        <div class="site-page-section">
            <h3><i class="fas fa-database"></i> Database Information</h3>
            <table class="info-table">
                <tr><td>Database Name</td><td>${dbInfo.db_name}</td></tr>
                <tr><td>Database User</td><td>${dbInfo.db_user}</td></tr>
                <tr><td>Database Host</td><td>${dbInfo.db_host}</td></tr>
                <tr><td>Table Count</td><td>${dbInfo.table_count}</td></tr>
                <tr><td>Database Size</td><td>${dbInfo.size_mb} MB</td></tr>
                <tr><td>Connection Status</td><td>${dbInfo.connected ? '<span class="badge badge-success">Connected</span>' : '<span class="badge badge-danger">Not Connected</span>'}</td></tr>
            </table>
        </div>
        ` : ''}
        
        ${wpInfo?.version ? `
        <div class="site-page-section">
            <h3><i class="fab fa-wordpress"></i> WordPress Information</h3>
            <table class="info-table">
                ${wpInfo.version ? `<tr><td>Version</td><td>${wpInfo.version}</td></tr>` : ''}
                ${wpInfo.home_url ? `<tr><td>Home URL</td><td>${wpInfo.home_url}</td></tr>` : ''}
                ${wpInfo.site_url ? `<tr><td>Site URL</td><td>${wpInfo.site_url}</td></tr>` : ''}
                ${wpInfo.plugin_count !== undefined ? `<tr><td>Plugins</td><td>${wpInfo.plugin_count}</td></tr>` : ''}
                ${wpInfo.theme_count !== undefined ? `<tr><td>Themes</td><td>${wpInfo.theme_count}</td></tr>` : ''}
            </table>
        </div>
        ` : ''}
    `;
}

// ==================== FILES TAB ====================

async function loadFilesTab() {
    currentFilePath = '';
    const siteContent = document.getElementById('siteContent');
    if (!siteContent) return;
    
    siteContent.innerHTML = `
        <div class="file-manager">
            <div class="file-toolbar">
                <button class="btn btn-primary btn-sm" onclick="browseFiles('')">
                    <i class="fas fa-home"></i> Root
                </button>
                <button class="btn btn-primary btn-sm" onclick="refreshFiles()">
                    <i class="fas fa-sync-alt"></i> Refresh
                </button>
                <button class="btn btn-success btn-sm" onclick="showUploadDialog()">
                    <i class="fas fa-upload"></i> Upload
                </button>
                <button class="btn btn-primary btn-sm" onclick="createNewFile()">
                    <i class="fas fa-file"></i> New File
                </button>
                <button class="btn btn-primary btn-sm" onclick="createNewFolder()">
                    <i class="fas fa-folder"></i> New Folder
                </button>
            </div>
            <div class="file-list" id="fileList">
                <div style="text-align: center; padding: 20px; color: var(--text-secondary);">Loading...</div>
            </div>
        </div>
    `;
    await browseFiles('');
}

async function browseFiles(path) {
    currentFilePath = path;
    const fileList = document.getElementById('fileList');
    if (!fileList) return;
    
    fileList.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-secondary);">Loading...</div>';
    
    try {
        const result = await apiCall(`/api/site/${currentDomain}/files?path=${encodeURIComponent(path)}`);
        
        fileList.innerHTML = '';
        
        // Add parent directory if not at root
        if (path) {
            const parentItem = document.createElement('div');
            parentItem.className = 'file-item';
            parentItem.onclick = () => {
                const parentPath = path.split('/').slice(0, -1).join('/');
                browseFiles(parentPath);
            };
            parentItem.innerHTML = `
                <div class="file-icon"><i class="fas fa-arrow-up"></i></div>
                <div class="file-name"><strong>..</strong></div>
                <div class="file-size">-</div>
                <div class="file-actions"></div>
            `;
            fileList.appendChild(parentItem);
        }
        
        result.files.forEach(file => {
            const item = document.createElement('div');
            item.className = 'file-item';
            item.onclick = () => {
                if (file.type === 'directory') {
                    browseFiles(file.path);
                } else {
                    openFile(file.path);
                }
            };
            
            const icon = file.type === 'directory' ? 'fa-folder' : 'fa-file';
            const iconColor = file.type === 'directory' ? 'style="color: var(--warning-color);"' : '';
            item.innerHTML = `
                <div class="file-icon" ${iconColor}><i class="fas ${icon}"></i></div>
                <div class="file-name">${file.name}</div>
                <div class="file-size">${file.size_human}</div>
                <div class="file-actions" onclick="event.stopPropagation()">
                    ${file.type === 'file' ? `
                        <button class="btn btn-primary btn-sm" onclick="downloadFile('${file.path}')">
                            <i class="fas fa-download"></i>
                        </button>
                    ` : ''}
                    <button class="btn btn-danger btn-sm" onclick="deleteFile('${file.path}', '${file.type}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            fileList.appendChild(item);
        });
    } catch (error) {
        console.error('Error loading files:', error);
        showToast(error.message || 'Error loading files', 'error');
        fileList.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--danger-color);">Failed to load files.</div>';
    }
}

function refreshFiles() {
    browseFiles(currentFilePath);
}

async function openFile(path) {
    const siteContent = document.getElementById('siteContent');
    if (!siteContent) return;
    
    showLoading(siteContent);
    
    try {
        const result = await apiCall(`/api/site/${currentDomain}/files/read?path=${encodeURIComponent(path)}`);
        
        siteContent.innerHTML = `
            <div class="site-page-section">
                <h3><i class="fas fa-file"></i> ${path.split('/').pop()}</h3>
                <textarea class="code-editor" id="fileEditor" style="font-family: 'Courier New', monospace; font-size: 13px; line-height: 1.6;">${escapeHtml(result.content)}</textarea>
                <div style="margin-top: 16px; display: flex; gap: 8px;">
                    <button class="btn btn-success" onclick="saveFile('${path}')">
                        <i class="fas fa-save"></i> Save
                    </button>
                    <button class="btn btn-primary" onclick="loadFilesTab()">
                        <i class="fas fa-arrow-left"></i> Back
                    </button>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error opening file:', error);
        showToast(error.message || 'Error opening file', 'error');
        loadFilesTab();
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function saveFile(path) {
    const content = document.getElementById('fileEditor').value;
    const button = event.target;
    const originalContent = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<span class="loading"></span> Saving...';
    
    try {
        const result = await apiCall(`/api/site/${currentDomain}/files/write`, {
            method: 'POST',
            body: JSON.stringify({ path, content })
        });
        
        if (result.success) {
            showToast('File saved successfully', 'success');
        } else {
            showToast(result.error || 'Error saving file', 'error');
        }
    } catch (error) {
        console.error('Error saving file:', error);
        showToast(error.message || 'Error saving file', 'error');
    } finally {
        button.innerHTML = originalContent;
        button.disabled = false;
    }
}

async function downloadFile(path) {
    window.open(`/api/site/${currentDomain}/files/download?path=${encodeURIComponent(path)}`, '_blank');
}

async function deleteFile(path, type) {
    if (!confirm(`Are you sure you want to delete this ${type}? This action cannot be undone.`)) return;
    
    try {
        const result = await apiCall(`/api/site/${currentDomain}/files/delete`, {
            method: 'POST',
            body: JSON.stringify({ path })
        });
        
        if (result.success) {
            showToast('Deleted successfully', 'success');
            refreshFiles();
        } else {
            showToast(result.error || 'Error deleting', 'error');
        }
    } catch (error) {
        console.error('Error deleting file:', error);
        showToast(error.message || 'Error deleting file', 'error');
    }
}

function showUploadDialog() {
    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const formData = new FormData();
        formData.append('file', file);
        formData.append('path', currentFilePath);
        
        showToast('Uploading...', 'success');
        
        try {
            const response = await fetch(`/api/site/${currentDomain}/files/upload`, {
                method: 'POST',
                body: formData
            });
            const result = await response.json();
            
            if (result.success) {
                showToast('File uploaded successfully', 'success');
                refreshFiles();
            } else {
                showToast(result.error || 'Upload failed', 'error');
            }
        } catch (error) {
            console.error('Error uploading file:', error);
            showToast('Error uploading file', 'error');
        }
    };
    input.click();
}

function createNewFile() {
    const name = prompt('Enter file name:');
    if (!name) return;
    
    const path = currentFilePath ? `${currentFilePath}/${name}` : name;
    openFile(path);
}

function createNewFolder() {
    const name = prompt('Enter folder name:');
    if (!name) return;
    showToast('Folder creation not yet implemented', 'error');
}

// ==================== DATABASE TAB ====================

async function loadDatabaseTab() {
    const siteContent = document.getElementById('siteContent');
    if (!siteContent) return;
    
    if (!siteData?.db_name) {
        siteContent.innerHTML = '<div class="site-page-section"><p style="color: var(--text-secondary);">No database configured for this site.</p></div>';
        return;
    }
    
    siteContent.innerHTML = `
        <div class="site-page-section">
            <h3><i class="fas fa-database"></i> Database: ${siteData.db_name}</h3>
            <div style="margin-bottom: 16px; display: flex; gap: 8px; flex-wrap: wrap;">
                <button class="btn btn-primary" onclick="loadDatabaseTables()">
                    <i class="fas fa-sync-alt"></i> Refresh Tables
                </button>
                <button class="btn btn-success" onclick="backupDatabase()">
                    <i class="fas fa-download"></i> Backup Database
                </button>
            </div>
            <div id="databaseContent">
                <div style="text-align: center; padding: 20px; color: var(--text-secondary);">Loading...</div>
            </div>
        </div>
    `;
    
    await loadDatabaseTables();
}

async function loadDatabaseTables() {
    const content = document.getElementById('databaseContent');
    if (!content) return;
    
    showLoading(content);
    
    try {
        const result = await apiCall(`/api/site/${currentDomain}/database/tables`);
        
        if (result.tables.length === 0) {
            content.innerHTML = '<p style="color: var(--text-secondary);">No tables found.</p>';
            return;
        }
        
        let html = '<div class="db-table-container"><table class="db-table"><thead><tr><th>Table Name</th><th>Rows</th><th>Size (MB)</th><th>Engine</th><th>Actions</th></tr></thead><tbody>';
        result.tables.forEach(table => {
            html += `
                <tr>
                    <td><strong>${table.name}</strong></td>
                    <td>${table.rows.toLocaleString()}</td>
                    <td>${table.size_mb}</td>
                    <td>${table.engine}</td>
                    <td>
                        <button class="btn btn-primary btn-sm" onclick="viewTableData('${table.name}')">
                            <i class="fas fa-eye"></i> View
                        </button>
                    </td>
                </tr>
            `;
        });
        html += '</tbody></table></div>';
        content.innerHTML = html;
    } catch (error) {
        console.error('Error loading tables:', error);
        showToast(error.message || 'Error loading tables', 'error');
        content.innerHTML = '<p style="color: var(--danger-color);">Failed to load tables.</p>';
    }
}

async function viewTableData(tableName) {
    const content = document.getElementById('databaseContent');
    if (!content) return;
    
    showLoading(content);
    
    try {
        const result = await apiCall(`/api/site/${currentDomain}/database/table/${tableName}?page=1&per_page=50`);
        
        let html = `
            <div style="margin-bottom: 16px;">
                <button class="btn btn-primary" onclick="loadDatabaseTables()">
                    <i class="fas fa-arrow-left"></i> Back to Tables
                </button>
            </div>
            <h4 style="margin-bottom: 16px;">Table: <code>${tableName}</code> (${result.total.toLocaleString()} rows)</h4>
            <div class="db-table-container">
                <table class="db-table">
                    <thead><tr>${result.columns.map(col => `<th>${col}</th>`).join('')}</tr></thead>
                    <tbody>
        `;
        
        result.rows.forEach(row => {
            html += '<tr>';
            result.columns.forEach(col => {
                let value = row[col];
                if (value === null) value = '<em style="color: var(--text-tertiary);">NULL</em>';
                else if (typeof value === 'string' && value.length > 50) value = escapeHtml(value.substring(0, 50)) + '...';
                else value = escapeHtml(String(value));
                html += `<td>${value}</td>`;
            });
            html += '</tr>';
        });
        
        html += '</tbody></table></div>';
        content.innerHTML = html;
    } catch (error) {
        console.error('Error loading table data:', error);
        showToast(error.message || 'Error loading table data', 'error');
        loadDatabaseTables();
    }
}

async function backupDatabase() {
    if (!confirm(`Create a backup of the database for ${currentDomain}?`)) return;
    
    showToast('Creating backup...', 'success');
    
    try {
        const result = await apiCall(`/api/site/${currentDomain}/database/backup`, { method: 'POST' });
        
        if (result.success) {
            showToast(`Backup created: ${result.backup_file}`, 'success');
        } else {
            showToast(result.error || 'Backup failed', 'error');
        }
    } catch (error) {
        console.error('Error creating backup:', error);
        showToast(error.message || 'Error creating backup', 'error');
    }
}

// ==================== LOGS TAB ====================

async function loadLogsTab() {
    const siteContent = document.getElementById('siteContent');
    if (!siteContent) return;
    
    siteContent.innerHTML = `
        <div class="site-page-section">
            <h3><i class="fas fa-file-alt"></i> Logs</h3>
            <div style="display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap;">
                <button class="btn btn-primary" onclick="showSiteLogs('error')">
                    <i class="fas fa-exclamation-triangle"></i> Error Log
                </button>
                <button class="btn btn-primary" onclick="showSiteLogs('access')">
                    <i class="fas fa-list"></i> Access Log
                </button>
            </div>
            <div id="logContainer" class="log-container" style="display: none;"></div>
        </div>
    `;
}

async function showSiteLogs(logType) {
    const logContainer = document.getElementById('logContainer');
    if (!logContainer) return;
    
    logContainer.style.display = 'block';
    logContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-secondary);">Loading logs...</div>';
    
    try {
        const result = await apiCall(`/api/site/${currentDomain}/logs/${logType}?lines=200`);
        
        logContainer.innerHTML = '';
        
        if (result.lines && result.lines.length > 0) {
            result.lines.forEach(line => {
                if (!line.trim()) return;
                const logLine = document.createElement('div');
                logLine.className = 'log-line';
                
                if (line.toLowerCase().includes('error') || line.toLowerCase().includes('fatal')) {
                    logLine.className += ' error';
                } else if (line.toLowerCase().includes('warning') || line.toLowerCase().includes('warn')) {
                    logLine.className += ' warning';
                }
                
                logLine.textContent = line;
                logContainer.appendChild(logLine);
            });
        } else {
            logContainer.textContent = 'No log entries found';
        }
        
        logContainer.scrollTop = logContainer.scrollHeight;
    } catch (error) {
        console.error('Error loading logs:', error);
        showToast(error.message || 'Error loading logs', 'error');
        logContainer.innerHTML = '<div style="color: var(--danger-color);">Failed to load logs.</div>';
    }
}

// ==================== WORDPRESS TAB ====================

async function loadWordPressTab() {
    const siteContent = document.getElementById('siteContent');
    if (!siteContent) return;
    
    showLoading(siteContent);
    
    try {
        const result = await apiCall(`/api/site/${currentDomain}/wordpress/info`);
        
        siteContent.innerHTML = `
            <div class="site-page-section">
                <h3><i class="fab fa-wordpress"></i> WordPress Information</h3>
                <table class="info-table">
                    ${result.version ? `<tr><td>Version</td><td><strong>${result.version}</strong></td></tr>` : ''}
                    ${result.home_url ? `<tr><td>Home URL</td><td><a href="${result.home_url}" target="_blank">${result.home_url}</a></td></tr>` : ''}
                    ${result.site_url ? `<tr><td>Site URL</td><td><a href="${result.site_url}" target="_blank">${result.site_url}</a></td></tr>` : ''}
                    ${result.plugin_count !== undefined ? `<tr><td>Plugins</td><td>${result.plugin_count}</td></tr>` : ''}
                    ${result.theme_count !== undefined ? `<tr><td>Themes</td><td>${result.theme_count}</td></tr>` : ''}
                </table>
            </div>
        `;
    } catch (error) {
        console.error('Error loading WordPress info:', error);
        siteContent.innerHTML = '<div class="site-page-section"><p style="color: var(--danger-color);">Error loading WordPress information.</p></div>';
    }
}

// ==================== MOBILE MENU ====================

function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    sidebar.classList.toggle('open');
}

// Close sidebar when clicking outside on mobile
document.addEventListener('click', (e) => {
    const sidebar = document.querySelector('.sidebar');
    const toggle = document.querySelector('.mobile-menu-toggle');
    
    if (window.innerWidth <= 768 && sidebar && toggle) {
        if (!sidebar.contains(e.target) && !toggle.contains(e.target) && sidebar.classList.contains('open')) {
            sidebar.classList.remove('open');
        }
    }
});

// ==================== UTILITIES ====================

async function apiCall(url, options = {}) {
    try {
        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Request failed' }));
            throw new Error(error.error || `HTTP ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('API call error:', error);
        throw error;
    }
}

function showToast(message, type = 'success') {
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function showLoading(element) {
    if (element) {
        element.innerHTML = '<div class="skeleton" style="height: 200px; border-radius: var(--radius-md);"></div>';
    }
}

function refreshSiteData() {
    loadSiteData();
    showSiteTab(currentTab);
    showToast('Refreshed', 'success');
}

