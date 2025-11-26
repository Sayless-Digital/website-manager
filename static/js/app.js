// Global state
let sites = [];
let services = {};
let currentSite = null;
let currentTab = 'overview';
let currentFilePath = '';

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    loadDashboard();
    loadServices();
    loadSites();
    loadResources();
    
    // Auto-refresh every 30 seconds
    setInterval(() => {
        if (document.getElementById('dashboard').classList.contains('active')) {
            loadDashboard();
        }
        loadServices();
        loadSites();
        if (document.getElementById('resources').classList.contains('active')) {
            loadResources();
        }
    }, 30000);
    
    // Auto-refresh resources every 5 seconds when on resources page
    setInterval(() => {
        if (document.getElementById('resources').classList.contains('active')) {
            loadResources();
        }
    }, 5000);
});

// ==================== NAVIGATION ====================

function showSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Show selected section
    document.getElementById(sectionId).classList.add('active');
    
    // Update sidebar active state
    document.querySelectorAll('.sidebar-menu a').forEach(link => {
        link.classList.remove('active');
    });
    document.querySelector(`[data-section="${sectionId}"]`).classList.add('active');
    
    // Update page title
    const titles = {
        'dashboard': 'Dashboard',
        'sites': 'Websites',
        'services': 'Services',
        'resources': 'System Resources',
        'cron': 'Cron Jobs'
    };
    document.getElementById('pageTitle').textContent = titles[sectionId] || 'Dashboard';
    
    // Load section-specific data
    if (sectionId === 'resources') {
        loadResources();
    } else if (sectionId === 'cron') {
        loadCronJobs();
    }
}

// ==================== DASHBOARD ====================

async function loadDashboard() {
    await loadSites();
    await loadServices();
    
    // Update stats
    document.getElementById('totalSites').textContent = sites.length;
    document.getElementById('totalDatabases').textContent = sites.filter(s => s.db_name).length;
    
    // Load resources for disk/memory
    try {
        const response = await fetch('/api/system/resources');
        const resources = await response.json();
        document.getElementById('diskUsage').textContent = `${resources.disk.percent.toFixed(1)}%`;
        document.getElementById('memoryUsage').textContent = `${resources.memory.percent.toFixed(1)}%`;
    } catch (error) {
        console.error('Error loading resources:', error);
    }
    
    // Render recent sites
    const recentSites = document.getElementById('recentSites');
    recentSites.innerHTML = '';
    sites.slice(0, 5).forEach(site => {
        const item = document.createElement('div');
        item.className = 'site-list-item';
        item.style.cssText = 'padding: 12px; border-bottom: 1px solid var(--border-color); cursor: pointer;';
        item.onclick = () => showSiteDetails(site.domain);
        item.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-weight: 500;">${site.domain}</span>
                <span class="badge ${site.apache_enabled ? 'badge-success' : 'badge-danger'}">${site.apache_enabled ? 'Active' : 'Inactive'}</span>
            </div>
        `;
        recentSites.appendChild(item);
    });
    
    // Render service status
    const serviceStatus = document.getElementById('serviceStatus');
    serviceStatus.innerHTML = '';
    for (const [serviceId, service] of Object.entries(services)) {
        const item = document.createElement('div');
        item.style.cssText = 'padding: 12px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;';
        item.innerHTML = `
            <span>${service.name}</span>
            <span class="badge ${service.active ? 'badge-success' : 'badge-danger'}">${service.active ? 'Running' : 'Stopped'}</span>
        `;
        serviceStatus.appendChild(item);
    }
}

// ==================== SERVICES ====================

async function loadServices() {
    const grid = document.getElementById('servicesGrid');
    if (grid) {
        showLoading(grid);
    }
    
    try {
        services = await apiCall('/api/services');
        renderServices();
    } catch (error) {
        console.error('Error loading services:', error);
        showToast(error.message || 'Error loading services', 'error');
        if (grid) {
            grid.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 40px;">Failed to load services.</p>';
        }
    }
}

function renderServices() {
    const grid = document.getElementById('servicesGrid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    for (const [serviceId, service] of Object.entries(services)) {
        const card = document.createElement('div');
        card.className = 'service-card';
        
        const statusClass = service.active ? 'running' : 'stopped';
        const statusText = service.active ? 'Running' : 'Stopped';
        
        card.innerHTML = `
            <div class="service-header">
                <div class="service-name">${service.name}</div>
                <span class="service-status status-${statusClass}">
                    <span class="status-indicator ${statusClass}"></span>
                    ${statusText}
                </span>
            </div>
            <div class="service-actions">
                ${service.active 
                    ? `<button class="btn btn-danger btn-sm" onclick="controlService('${serviceId}', 'stop')">
                        <i class="fas fa-stop"></i> Stop
                       </button>
                       <button class="btn btn-warning btn-sm" onclick="controlService('${serviceId}', 'restart')">
                        <i class="fas fa-redo"></i> Restart
                       </button>`
                    : `<button class="btn btn-success btn-sm" onclick="controlService('${serviceId}', 'start')">
                        <i class="fas fa-play"></i> Start
                       </button>`
                }
                ${service.enabled
                    ? `<button class="btn btn-warning btn-sm" onclick="controlService('${serviceId}', 'disable')">
                        <i class="fas fa-ban"></i> Disable
                       </button>`
                    : `<button class="btn btn-success btn-sm" onclick="controlService('${serviceId}', 'enable')">
                        <i class="fas fa-check"></i> Enable
                       </button>`
                }
                <button class="btn btn-primary btn-sm" onclick="showServiceLogs('${serviceId}')">
                    <i class="fas fa-file-alt"></i> Logs
                </button>
            </div>
        `;
        
        grid.appendChild(card);
    }
}

async function controlService(serviceId, action) {
    if (!confirm(`Are you sure you want to ${action} ${services[serviceId].name}?`)) {
        return;
    }
    
    const button = event.target.closest('button');
    const originalContent = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<span class="loading"></span> Processing...';
    
    try {
        const result = await apiCall(`/api/service/${serviceId}/${action}`, {
            method: 'POST'
        });
        
        if (result.success) {
            showToast(result.message, 'success');
            await loadServices();
        } else {
            showToast(result.error || 'Operation failed', 'error');
            button.innerHTML = originalContent;
            button.disabled = false;
        }
    } catch (error) {
        console.error('Error controlling service:', error);
        showToast(error.message || 'Error controlling service', 'error');
        button.innerHTML = originalContent;
        button.disabled = false;
    }
}

// ==================== SITES ====================

async function loadSites() {
    const grid = document.getElementById('sitesGrid');
    if (grid) {
        showLoading(grid);
    }
    
    try {
        sites = await apiCall('/api/sites');
        renderSites();
    } catch (error) {
        console.error('Error loading sites:', error);
        showToast(error.message || 'Error loading sites', 'error');
        if (grid) {
            grid.innerHTML = '<p style="text-align: center; color: var(--text-secondary); grid-column: 1/-1; padding: 40px;">Failed to load sites. Please try again.</p>';
        }
    }
}

function renderSites() {
    const grid = document.getElementById('sitesGrid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    if (sites.length === 0) {
        grid.innerHTML = '<p style="text-align: center; color: var(--text-secondary); grid-column: 1/-1;">No sites detected</p>';
        return;
    }
    
    sites.forEach(site => {
        const card = document.createElement('div');
        card.className = 'site-card';
        card.onclick = () => window.location.href = `/site/${site.domain}`;
        
        card.innerHTML = `
            <div class="site-header">
                <div>
                    <div class="site-domain">${site.domain}</div>
                    <div class="site-badges">
                        ${site.apache_enabled 
                            ? '<span class="badge badge-success">Apache Enabled</span>' 
                            : '<span class="badge badge-danger">Apache Disabled</span>'
                        }
                        ${site.db_name 
                            ? '<span class="badge badge-info">Database</span>' 
                            : ''
                        }
                        ${site.size_mb ? `<span class="badge badge-info">${site.size_mb} MB</span>` : ''}
                    </div>
                </div>
            </div>
            <div class="site-info">
                <div class="site-info-item">
                    <span>Path:</span>
                    <span style="font-family: monospace; font-size: 11px;">${site.path}</span>
                </div>
                ${site.db_name ? `
                    <div class="site-info-item">
                        <span>Database:</span>
                        <span>${site.db_name}</span>
                    </div>
                ` : ''}
            </div>
            <div class="site-actions">
                <a href="/site/${site.domain}" class="btn btn-primary btn-sm" onclick="event.stopPropagation()">
                    <i class="fas fa-cog"></i> Manage
                </a>
            </div>
        `;
        
        grid.appendChild(card);
    });
}

function filterSites() {
    const search = document.getElementById('siteSearch').value.toLowerCase();
    document.querySelectorAll('.site-card').forEach(card => {
        const domain = card.querySelector('.site-domain').textContent.toLowerCase();
        card.style.display = domain.includes(search) ? 'block' : 'none';
    });
}

// ==================== SITE DETAILS MODAL ====================

async function showSiteDetails(domain) {
    currentSite = sites.find(s => s.domain === domain);
    if (!currentSite) return;
    
    document.getElementById('modalTitle').textContent = `Site: ${domain}`;
    currentTab = 'overview';
    openModal();
    showSiteTab('overview');
}

function showSiteTab(tabName) {
    currentTab = tabName;
    
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    // Load tab content
    const modalBody = document.getElementById('modalBody');
    
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

async function loadOverviewTab() {
    const site = currentSite;
    let status = { local_accessible: false, public_accessible: false };
    try {
        const response = await fetch(`/api/site/${site.domain}/status`);
        status = await response.json();
    } catch (error) {
        console.error('Error loading site status:', error);
    }
    
    let dbInfo = null;
    if (site.db_name) {
        try {
            const response = await fetch(`/api/site/${site.domain}/database/info`);
            if (response.ok) {
                dbInfo = await response.json();
            }
        } catch (error) {
            console.error('Error loading database info:', error);
        }
    }
    
    const modalBody = document.getElementById('modalBody');
    modalBody.innerHTML = `
        <div class="modal-section">
            <h3><i class="fas fa-info-circle"></i> Site Information</h3>
            <table class="info-table">
                <tr><td>Domain</td><td>${site.domain}</td></tr>
                <tr><td>Path</td><td><code>${site.path}</code></td></tr>
                <tr><td>Public HTML</td><td><code>${site.public_html}</code></td></tr>
                <tr><td>Apache Config</td><td>${site.apache_config || 'Not found'}</td></tr>
                <tr><td>Apache Enabled</td><td>${site.apache_enabled ? '<span class="badge badge-success">Yes</span>' : '<span class="badge badge-danger">No</span>'}</td></tr>
                ${site.size_mb ? `<tr><td>Size</td><td>${site.size_mb} MB</td></tr>` : ''}
            </table>
        </div>
        <div class="modal-section">
            <h3><i class="fas fa-signal"></i> Status</h3>
            <table class="info-table">
                <tr><td>Local Access</td><td>${status.local_accessible ? '<span class="badge badge-success">Accessible</span>' : '<span class="badge badge-danger">Not Accessible</span>'}</td></tr>
                <tr><td>Public Access</td><td>${status.public_accessible ? '<span class="badge badge-success">Accessible</span>' : '<span class="badge badge-danger">Not Accessible</span>'}</td></tr>
            </table>
        </div>
        ${dbInfo ? `
        <div class="modal-section">
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
    `;
}

async function loadFilesTab() {
    currentFilePath = '';
    const modalBody = document.getElementById('modalBody');
    modalBody.innerHTML = `
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
    browseFiles('');
}

async function browseFiles(path) {
    currentFilePath = path;
    try {
        const response = await fetch(`/api/site/${currentSite.domain}/files?path=${encodeURIComponent(path)}`);
        const result = await response.json();
        
        if (result.error) {
            showToast(result.error, 'error');
            return;
        }
        
        const fileList = document.getElementById('fileList');
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
                <div class="file-name">..</div>
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
            item.innerHTML = `
                <div class="file-icon"><i class="fas ${icon}"></i></div>
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
        showToast('Error loading files', 'error');
    }
}

function refreshFiles() {
    browseFiles(currentFilePath);
}

async function openFile(path) {
    try {
        const response = await fetch(`/api/site/${currentSite.domain}/files/read?path=${encodeURIComponent(path)}`);
        const result = await response.json();
        
        if (result.error) {
            showToast(result.error, 'error');
            return;
        }
        
        const modalBody = document.getElementById('modalBody');
        modalBody.innerHTML = `
            <div class="modal-section">
                <h3><i class="fas fa-file"></i> ${path.split('/').pop()}</h3>
                <textarea class="code-editor" id="fileEditor">${result.content}</textarea>
                <div style="margin-top: 12px; display: flex; gap: 8px;">
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
        showToast('Error opening file', 'error');
    }
}

async function saveFile(path) {
    const content = document.getElementById('fileEditor').value;
    try {
        const response = await fetch(`/api/site/${currentSite.domain}/files/write`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path, content })
        });
        const result = await response.json();
        
        if (result.success) {
            showToast('File saved', 'success');
        } else {
            showToast(result.error || 'Error saving file', 'error');
        }
    } catch (error) {
        console.error('Error saving file:', error);
        showToast('Error saving file', 'error');
    }
}

async function downloadFile(path) {
    window.open(`/api/site/${currentSite.domain}/files/download?path=${encodeURIComponent(path)}`, '_blank');
}

async function deleteFile(path, type) {
    if (!confirm(`Are you sure you want to delete this ${type}?`)) return;
    
    try {
        const response = await fetch(`/api/site/${currentSite.domain}/files/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path })
        });
        const result = await response.json();
        
        if (result.success) {
            showToast('Deleted', 'success');
            refreshFiles();
        } else {
            showToast(result.error || 'Error deleting', 'error');
        }
    } catch (error) {
        console.error('Error deleting file:', error);
        showToast('Error deleting file', 'error');
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
        
        try {
            const response = await fetch(`/api/site/${currentSite.domain}/files/upload`, {
                method: 'POST',
                body: formData
            });
            const result = await response.json();
            
            if (result.success) {
                showToast('File uploaded', 'success');
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
    const site = currentSite;
    if (!site.db_name) {
        document.getElementById('modalBody').innerHTML = '<p>No database configured for this site.</p>';
        return;
    }
    
    const modalBody = document.getElementById('modalBody');
    modalBody.innerHTML = `
        <div class="modal-section">
            <h3><i class="fas fa-database"></i> Database: ${site.db_name}</h3>
            <div style="margin-bottom: 16px;">
                <button class="btn btn-primary" onclick="loadDatabaseTables()">
                    <i class="fas fa-sync-alt"></i> Refresh Tables
                </button>
                <button class="btn btn-success" onclick="backupDatabase('${site.domain}')">
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
    try {
        const response = await fetch(`/api/site/${currentSite.domain}/database/tables`);
        const result = await response.json();
        
        if (result.error) {
            showToast(result.error, 'error');
            return;
        }
        
        const content = document.getElementById('databaseContent');
        if (result.tables.length === 0) {
            content.innerHTML = '<p>No tables found.</p>';
            return;
        }
        
        let html = '<table class="db-table"><thead><tr><th>Table Name</th><th>Rows</th><th>Size (MB)</th><th>Engine</th><th>Actions</th></tr></thead><tbody>';
        result.tables.forEach(table => {
            html += `
                <tr>
                    <td>${table.name}</td>
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
        html += '</tbody></table>';
        content.innerHTML = html;
    } catch (error) {
        console.error('Error loading tables:', error);
        showToast('Error loading tables', 'error');
    }
}

async function viewTableData(tableName) {
    try {
        const response = await fetch(`/api/site/${currentSite.domain}/database/table/${tableName}?page=1&per_page=50`);
        const result = await response.json();
        
        if (result.error) {
            showToast(result.error, 'error');
            return;
        }
        
        const content = document.getElementById('databaseContent');
        let html = `
            <div style="margin-bottom: 16px;">
                <button class="btn btn-primary" onclick="loadDatabaseTables()">
                    <i class="fas fa-arrow-left"></i> Back to Tables
                </button>
            </div>
            <h4>Table: ${tableName} (${result.total} rows)</h4>
            <div class="db-table-container">
                <table class="db-table">
                    <thead><tr>${result.columns.map(col => `<th>${col}</th>`).join('')}</tr></thead>
                    <tbody>
        `;
        
        result.rows.forEach(row => {
            html += '<tr>';
            result.columns.forEach(col => {
                let value = row[col];
                if (value === null) value = '<em>NULL</em>';
                else if (typeof value === 'string' && value.length > 50) value = value.substring(0, 50) + '...';
                html += `<td>${value}</td>`;
            });
            html += '</tr>';
        });
        
        html += '</tbody></table></div>';
        content.innerHTML = html;
    } catch (error) {
        console.error('Error loading table data:', error);
        showToast('Error loading table data', 'error');
    }
}

async function backupDatabase(domain) {
    if (!confirm(`Create a backup of the database for ${domain}?`)) return;
    
    try {
        const response = await fetch(`/api/site/${domain}/database/backup`, { method: 'POST' });
        const result = await response.json();
        
        if (result.success) {
            showToast(`Backup created: ${result.backup_file}`, 'success');
        } else {
            showToast(result.error || 'Backup failed', 'error');
        }
    } catch (error) {
        console.error('Error creating backup:', error);
        showToast('Error creating backup', 'error');
    }
}

// ==================== LOGS TAB ====================

async function loadLogsTab() {
    const modalBody = document.getElementById('modalBody');
    modalBody.innerHTML = `
        <div class="modal-section">
            <h3><i class="fas fa-file-alt"></i> Logs</h3>
            <div style="display: flex; gap: 8px; margin-bottom: 12px;">
                <button class="btn btn-primary" onclick="showSiteLogs('${currentSite.domain}', 'error')">
                    <i class="fas fa-exclamation-triangle"></i> Error Log
                </button>
                <button class="btn btn-primary" onclick="showSiteLogs('${currentSite.domain}', 'access')">
                    <i class="fas fa-list"></i> Access Log
                </button>
            </div>
            <div id="logContainer" class="log-container" style="display: none;"></div>
        </div>
    `;
}

async function showSiteLogs(domain, logType) {
    try {
        const response = await fetch(`/api/site/${domain}/logs/${logType}?lines=200`);
        const result = await response.json();
        
        const logContainer = document.getElementById('logContainer');
        logContainer.style.display = 'block';
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
        showToast('Error loading logs', 'error');
    }
}

// ==================== WORDPRESS TAB ====================

async function loadWordPressTab() {
    try {
        const response = await fetch(`/api/site/${currentSite.domain}/wordpress/info`);
        const result = await response.json();
        
        const modalBody = document.getElementById('modalBody');
        modalBody.innerHTML = `
            <div class="modal-section">
                <h3><i class="fab fa-wordpress"></i> WordPress Information</h3>
                <table class="info-table">
                    ${result.version ? `<tr><td>Version</td><td>${result.version}</td></tr>` : ''}
                    ${result.home_url ? `<tr><td>Home URL</td><td>${result.home_url}</td></tr>` : ''}
                    ${result.site_url ? `<tr><td>Site URL</td><td>${result.site_url}</td></tr>` : ''}
                    ${result.plugin_count !== undefined ? `<tr><td>Plugins</td><td>${result.plugin_count}</td></tr>` : ''}
                    ${result.theme_count !== undefined ? `<tr><td>Themes</td><td>${result.theme_count}</td></tr>` : ''}
                </table>
            </div>
        `;
    } catch (error) {
        console.error('Error loading WordPress info:', error);
        document.getElementById('modalBody').innerHTML = '<p>Error loading WordPress information.</p>';
    }
}

// ==================== RESOURCES ====================

async function loadResources() {
    try {
        const response = await fetch('/api/system/resources');
        const resources = await response.json();
        
        // Update CPU
        document.getElementById('cpuPercent').textContent = `${resources.cpu.percent.toFixed(1)}%`;
        document.getElementById('cpuFill').style.width = `${resources.cpu.percent}%`;
        document.getElementById('cpuCores').textContent = resources.cpu.count;
        
        // Update Memory
        document.getElementById('memoryPercent').textContent = `${resources.memory.percent.toFixed(1)}%`;
        document.getElementById('memoryFill').style.width = `${resources.memory.percent}%`;
        document.getElementById('memoryUsed').textContent = `${resources.memory.used_gb} GB`;
        document.getElementById('memoryTotal').textContent = `${resources.memory.total_gb} GB`;
        
        // Update Disk
        document.getElementById('diskPercent').textContent = `${resources.disk.percent.toFixed(1)}%`;
        document.getElementById('diskFill').style.width = `${resources.disk.percent}%`;
        document.getElementById('diskUsed').textContent = `${resources.disk.used_gb} GB`;
        document.getElementById('diskTotal').textContent = `${resources.disk.total_gb} GB`;
        
        // Update system info
        const systemInfo = document.getElementById('systemInfo');
        const infoResponse = await fetch('/api/system/info');
        const info = await infoResponse.json();
        
        systemInfo.innerHTML = `
            <li><span>Uptime:</span><span>${info.uptime || 'N/A'}</span></li>
            <li><span>Load Average (1min):</span><span>${info.load_average ? info.load_average['1min'].toFixed(2) : 'N/A'}</span></li>
            <li><span>Processes:</span><span>${resources.processes}</span></li>
        `;
    } catch (error) {
        console.error('Error loading resources:', error);
    }
}

// ==================== CRON JOBS ====================

async function loadCronJobs() {
    try {
        const response = await fetch('/api/cron/list');
        const result = await response.json();
        
        const cronList = document.getElementById('cronList');
        if (!cronList) return;
        
        if (result.jobs && result.jobs.length > 0) {
            cronList.innerHTML = result.jobs.map(job => `
                <div style="background: var(--card-bg); padding: 16px; border-radius: 8px; margin-bottom: 12px; border: 1px solid var(--border-color);">
                    <code style="font-family: monospace; font-size: 13px;">${job}</code>
                </div>
            `).join('');
        } else {
            cronList.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">No cron jobs found.</p>';
        }
    } catch (error) {
        console.error('Error loading cron jobs:', error);
    }
}

// ==================== SERVICE LOGS ====================

async function showServiceLogs(serviceId) {
    try {
        const response = await fetch(`/api/service/${serviceId}/logs?lines=200`);
        const result = await response.json();
        
        document.getElementById('modalTitle').textContent = `Logs: ${services[serviceId].name}`;
        const modalBody = document.getElementById('modalBody');
        
        modalBody.innerHTML = `
            <div class="modal-section">
                <h3><i class="fas fa-file-alt"></i> Service Logs</h3>
                <div class="log-container" id="serviceLogContainer"></div>
            </div>
        `;
        
        const logContainer = document.getElementById('serviceLogContainer');
        
        if (result.lines && result.lines.length > 0) {
            result.lines.forEach(line => {
                if (!line.trim()) return;
                const logLine = document.createElement('div');
                logLine.className = 'log-line';
                
                if (line.toLowerCase().includes('error')) {
                    logLine.className += ' error';
                } else if (line.toLowerCase().includes('warning')) {
                    logLine.className += ' warning';
                }
                
                logLine.textContent = line;
                logContainer.appendChild(logLine);
            });
        } else {
            logContainer.textContent = 'No log entries found';
        }
        
        logContainer.scrollTop = logContainer.scrollHeight;
        openModal();
    } catch (error) {
        console.error('Error loading service logs:', error);
        showToast('Error loading service logs', 'error');
    }
}

// ==================== UTILITIES ====================

function closeModal() {
    const modal = document.getElementById('siteModal');
    modal.classList.remove('show');
    setTimeout(() => {
        modal.style.display = 'none';
    }, 300);
    currentSite = null;
}

function openModal() {
    const modal = document.getElementById('siteModal');
    modal.style.display = 'flex';
    setTimeout(() => {
        modal.classList.add('show');
    }, 10);
}

window.onclick = function(event) {
    const modal = document.getElementById('siteModal');
    if (event.target == modal) {
        closeModal();
    }
}

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeModal();
    }
});

function refreshAll() {
    loadDashboard();
    loadServices();
    loadSites();
    showToast('Refreshed', 'success');
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

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function showLoading(element) {
    if (element) {
        element.innerHTML = '<div class="skeleton" style="height: 200px;"></div>';
    }
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

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
