import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  Download, Database, Trash2, RefreshCw, FileArchive, Clock,
  Globe, ChevronRight, Folder, Archive, Plus, Loader2, Save, HardDrive
} from 'lucide-react';
import { useBackups, useCreateBackup, useRestoreBackup, useDeleteBackup, useBackupSettings, useBackupStatus, useActiveBackups, type BackupFile } from '@/features/sites/hooks/useBackups';
import { apiClient } from '@/lib/api/client';
import { showNotification } from '@/lib/notifications';
import { API_ENDPOINTS } from '@/lib/api/endpoints';
import { cn } from '@/lib/utils/cn';


export default function Backups() {
  const { domain } = useParams<{ domain: string }>();
  const [activeTab, setActiveTab] = useState<'backups' | 'settings'>('backups');
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; backup: BackupFile | null }>({ show: false, backup: null });
  const [activeBackupId, setActiveBackupId] = useState<string | null>(() => {
    // Restore active backup ID from localStorage on mount
    const stored = localStorage.getItem(`backup_${domain}`);
    return stored || null;
  });
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; file: BackupFile | null }>({ x: 0, y: 0, file: null });
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Hooks
  const allBackups = useBackups(domain!); // Get all backups
  // Group backups by folder to show combined entries
  const groupedBackups = allBackups.data?.reduce((acc, backup) => {
    const folder = backup.folder || backup.name.split('/')[0];
    if (!acc[folder]) {
      acc[folder] = {
        folder,
        date: backup.date,
        database: null as BackupFile | null,
        files: null as BackupFile | null,
        type: 'both' as 'database' | 'files' | 'both',
        totalSize: 0
      };
    }
    if (backup.type === 'database') {
      acc[folder].database = backup;
      acc[folder].totalSize += backup.size;
      if (!acc[folder].files) acc[folder].type = 'database';
    } else if (backup.type === 'files') {
      acc[folder].files = backup;
      acc[folder].totalSize += backup.size;
      if (!acc[folder].database) acc[folder].type = 'files';
    } else if (backup.type === 'both') {
      acc[folder].type = 'both';
      acc[folder].totalSize = backup.size;
    }
    return acc;
  }, {} as Record<string, { folder: string; date: string; database: BackupFile | null; files: BackupFile | null; type: 'database' | 'files' | 'both'; totalSize: number }>);
  
  const unifiedBackups = groupedBackups ? Object.values(groupedBackups).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) : [];
  const createBackup = useCreateBackup(domain!);
  const restoreBackup = useRestoreBackup(domain!);
  const deleteBackup = useDeleteBackup(domain!);
  const settings = useBackupSettings(domain!);
  const activeBackups = useActiveBackups(domain!);
  const backupStatus = useBackupStatus(domain!, activeBackupId);

  // Automatically detect and set active backup from server
  useEffect(() => {
    if (activeBackups.data && activeBackups.data.length > 0) {
      // Get the most recent active backup
      const latestBackup = activeBackups.data[0];
      if (latestBackup.backup_id !== activeBackupId) {
        setActiveBackupId(latestBackup.backup_id);
        // Store in localStorage for persistence
        localStorage.setItem(`backup_${domain}`, latestBackup.backup_id);
      }
    } else if (activeBackups.data && activeBackups.data.length === 0 && activeBackupId) {
      // No active backups, clear the active backup ID if it exists
      // But only if the status shows it's completed/error
      if (backupStatus.data && backupStatus.data.status !== 'running') {
        setActiveBackupId(null);
        localStorage.removeItem(`backup_${domain}`);
      }
    }
  }, [activeBackups.data, activeBackupId, domain, backupStatus.data]);

  // Local state for settings form
  const [settingsForm, setSettingsForm] = useState({
    enabled: false,
    frequency: 'daily' as 'daily' | 'weekly' | 'monthly',
    time: '00:00',
    retention: 5,
    include_files: true,
    include_db: true
  });

  // Update form when data loads
  useEffect(() => {
    if (settings.data) {
      setSettingsForm({
        enabled: settings.data.enabled,
        frequency: settings.data.frequency,
        time: settings.data.time,
        retention: settings.data.retention,
        include_files: settings.data.include_files,
        include_db: settings.data.include_db
      });
    }
  }, [settings.data]);

  const handleCreateBackup = (type: 'database' | 'files' | 'both') => {
    createBackup.mutate(type, {
      onSuccess: (data) => {
        setActiveBackupId(data.backup_id);
        // Store in localStorage to persist across reloads
        localStorage.setItem(`backup_${domain}`, data.backup_id);
        showNotification('success', `${type === 'both' ? 'Full' : type === 'database' ? 'Database' : 'File'} backup started`);
      },
      onError: () => showNotification('error', 'Backup failed to start')
    });
  };

  // Check if backup completed or failed
  useEffect(() => {
    if (backupStatus.data) {
      const status = backupStatus.data.status;
      if (status === 'completed') {
        showNotification('success', 'Backup completed successfully');
        setActiveBackupId(null);
        localStorage.removeItem(`backup_${domain}`);
        allBackups.refetch();
      } else if (status === 'error') {
        showNotification('error', backupStatus.data.message || 'Backup failed');
        setActiveBackupId(null);
        localStorage.removeItem(`backup_${domain}`);
      }
    }
  }, [backupStatus.data, domain]);

  // Handle context menu
  const handleContextMenu = (e: React.MouseEvent, file: BackupFile) => {
    e.preventDefault();
    
    // Get viewport dimensions
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Context menu dimensions (approximate)
    const menuWidth = 180;
    const menuHeight = 200;
    
    // Calculate position, adjusting if it would go off-screen
    let x = e.clientX;
    let y = e.clientY;
    
    // Check right edge
    if (x + menuWidth > viewportWidth) {
      x = viewportWidth - menuWidth - 10;
    }
    
    // Check bottom edge
    if (y + menuHeight > viewportHeight) {
      y = viewportHeight - menuHeight - 10;
    }
    
    // Ensure menu doesn't go off top or left edges
    x = Math.max(10, x);
    y = Math.max(10, y);
    
    setContextMenu({ x, y, file });
  };

  // Close context menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu({ x: 0, y: 0, file: null });
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleRestore = (file: BackupFile) => {
    if (!confirm(`Are you sure you want to restore ${file.name}? This will overwrite current data.`)) return;
    
    // For 'both' type, restore database first, then files
    const restoreType = file.type === 'both' ? 'database' : file.type;
    restoreBackup.mutate({ filename: file.name, type: restoreType as 'database' | 'files' }, {
      onSuccess: () => {
        if (file.type === 'both') {
          // Restore files after database
          restoreBackup.mutate({ filename: file.name, type: 'files' }, {
            onSuccess: () => showNotification('success', 'Restoration completed successfully'),
            onError: () => showNotification('error', 'Files restoration failed')
          });
        } else {
          showNotification('success', 'Restoration completed successfully');
        }
      },
      onError: () => showNotification('error', 'Restoration failed')
    });
  };

  const handleDelete = (file: BackupFile) => {
    setDeleteConfirm({ show: true, backup: file });
  };

  const confirmDelete = () => {
    if (!deleteConfirm.backup) return;
    
    const backup = deleteConfirm.backup;
    const folder = backup.folder || backup.name.split('/')[0];
    
    deleteBackup.mutate({ folder }, {
      onSuccess: () => {
        showNotification('success', 'Backup deleted');
        setDeleteConfirm({ show: false, backup: null });
      },
      onError: () => {
        showNotification('error', 'Failed to delete backup');
        setDeleteConfirm({ show: false, backup: null });
      }
    });
  };

  const downloadBackup = async (file: BackupFile) => {
    try {
      const endpoint = file.type === 'database' 
        ? `${API_ENDPOINTS.SITES.DATABASE_BACKUPS(domain!)}/${file.name}/download`
        : `${API_ENDPOINTS.SITES.FILE_BACKUPS(domain!)}/${file.name}/download`;

      const response = await apiClient.get(endpoint, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', file.name);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      showNotification('error', 'Failed to download backup');
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Calculate total size of all backups
  const totalBackupSize = allBackups.data?.reduce((sum, backup) => sum + (backup.size || 0), 0) || 0;


  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col gap-6 min-h-0">
      {/* Tab Bar */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('backups')}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg transition-colors",
              activeTab === 'backups'
                ? "bg-amber-50 border-amber-200 text-foreground" 
                : "bg-background border-border hover:bg-muted/50"
            )}
          >
            <Archive className="h-3.5 w-3.5" />
            <span>Backups</span>
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg transition-colors",
              activeTab === 'settings'
                ? "bg-amber-50 border-amber-200 text-foreground" 
                : "bg-background border-border hover:bg-muted/50"
            )}
          >
            <Clock className="h-3.5 w-3.5" />
            <span>Auto-Backup</span>
          </button>
        </div>
        <div className="flex-1"></div>
        <div className="flex items-center gap-4">
          <Button onClick={() => handleCreateBackup('database')} disabled={createBackup.isPending || !!activeBackupId} variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Database
          </Button>
          <Button onClick={() => handleCreateBackup('files')} disabled={createBackup.isPending || !!activeBackupId} variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Files
          </Button>
          <Button onClick={() => handleCreateBackup('both')} disabled={createBackup.isPending || !!activeBackupId} variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Full Backup
          </Button>
          <div className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground border rounded-lg bg-card">
            <HardDrive className="h-4 w-4" />
            <span>Total: {formatSize(totalBackupSize)}</span>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => allBackups.refetch()}
            disabled={allBackups.isFetching}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", allBackups.isFetching && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card border hover:bg-accent transition-colors">
          <Globe className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{domain}</span>
        </button>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
        <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card border hover:bg-accent transition-colors">
          <Folder className="h-4 w-4 text-primary" />
          <span className="font-medium">Backups</span>
        </button>
      </div>

      {/* Content based on active tab */}
      {activeTab === 'backups' && (
        <div className="border rounded-lg overflow-hidden flex-shrink-0" style={{ height: '70vh' }}>
            <div className="h-full overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left border-b sticky top-0 z-10">
                  <tr>
                    <th className="p-3 font-medium bg-muted">Backup</th>
                    <th className="p-3 font-medium bg-muted">Type</th>
                    <th className="p-3 font-medium bg-muted">Date</th>
                    <th className="p-3 font-medium bg-muted">Size</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {/* Show active backup at the top if running */}
                  {activeBackupId && backupStatus.data && backupStatus.data.status === 'running' && (
                    <>
                      {backupStatus.data.type === 'database' || backupStatus.data.type === 'both' ? (
                        <tr className="bg-primary/5 border-l-2 border-l-primary">
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <Loader2 className="h-4 w-4 text-primary animate-spin" />
                              <Database className="h-4 w-4 text-blue-500" />
                              <span className="font-mono">Backing up database...</span>
                            </div>
                          </td>
                          <td className="p-3">
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 flex items-center gap-1.5">
                              <Database className="h-3.5 w-3.5 text-blue-500" />
                              Database
                            </Badge>
                          </td>
                          <td className="p-3 text-muted-foreground text-sm">
                            {new Date().toLocaleString()}
                          </td>
                          <td className="p-3 text-muted-foreground text-sm font-mono">
                            <span>{backupStatus.data.message}</span>
                          </td>
                        </tr>
                      ) : null}
                      {backupStatus.data.type === 'files' || backupStatus.data.type === 'both' ? (
                        <tr className="bg-primary/5 border-l-2 border-l-primary">
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <Loader2 className="h-4 w-4 text-primary animate-spin" />
                              <FileArchive className="h-4 w-4 text-yellow-600" />
                              <span className="font-mono">Backing up files...</span>
                            </div>
                          </td>
                          <td className="p-3">
                            <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 flex items-center gap-1.5">
                              <FileArchive className="h-3.5 w-3.5 text-yellow-600" />
                              Files
                            </Badge>
                          </td>
                          <td className="p-3 text-muted-foreground text-sm">
                            {new Date().toLocaleString()}
                          </td>
                          <td className="p-3 text-muted-foreground text-sm font-mono">
                            <span>{backupStatus.data.message}</span>
                          </td>
                        </tr>
                      ) : null}
                    </>
                  )}
                  {unifiedBackups.filter(backup => {
                    // Only show completed backups, not ones currently being created
                    if (activeBackupId && backupStatus.data?.status === 'running') {
                      const timestampMatch = activeBackupId.match(/_(\d{8}_\d{6})$/);
                      if (timestampMatch) {
                        const backupTimestamp = timestampMatch[1];
                        return backup.folder !== backupTimestamp;
                      }
                      const backupFolder = backupStatus.data.backup_folder?.split('/').pop();
                      return backup.folder !== backupFolder;
                    }
                    return true;
                  }).map((backup) => {
                    // Determine which backup file to use for context menu (prefer database if both exist)
                    const backupFile: BackupFile = backup.database || backup.files || {
                      name: backup.folder,
                      date: backup.date,
                      size: backup.totalSize,
                      path: '',
                      type: backup.type,
                      folder: backup.folder
                    };
                    
                    return (
                      <tr 
                        key={backup.folder} 
                        className="hover:bg-muted/50 cursor-pointer"
                        onContextMenu={(e) => handleContextMenu(e, backupFile)}
                      >
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            {backup.type === 'both' ? (
                              <Archive className="h-4 w-4 text-primary" />
                            ) : backup.type === 'database' ? (
                              <Database className="h-4 w-4 text-blue-500" />
                            ) : (
                              <FileArchive className="h-4 w-4 text-yellow-600" />
                            )}
                            <span className="font-mono">{backup.folder}</span>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            {backup.type === 'both' && (
                              <>
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 flex items-center gap-1.5">
                                  <Database className="h-3.5 w-3.5 text-blue-500" />
                                  Database
                                </Badge>
                                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 flex items-center gap-1.5">
                                  <FileArchive className="h-3.5 w-3.5 text-yellow-600" />
                                  Files
                                </Badge>
                              </>
                            )}
                            {backup.type === 'database' && (
                              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 flex items-center gap-1.5">
                                <Database className="h-3.5 w-3.5 text-blue-500" />
                                Database
                              </Badge>
                            )}
                            {backup.type === 'files' && (
                              <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 flex items-center gap-1.5">
                                <FileArchive className="h-3.5 w-3.5 text-yellow-600" />
                                Files
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-muted-foreground text-sm">
                          {new Date(backup.date).toLocaleString()}
                        </td>
                        <td className="p-3 text-muted-foreground text-sm font-mono">
                          {formatSize(backup.totalSize)}
                        </td>
                      </tr>
                    );
                  })}
                  {unifiedBackups.filter(backup => {
                    if (activeBackupId && backupStatus.data?.status === 'running') {
                      const timestampMatch = activeBackupId.match(/_(\d{8}_\d{6})$/);
                      if (timestampMatch) {
                        const backupTimestamp = timestampMatch[1];
                        return backup.folder !== backupTimestamp;
                      }
                      const backupFolder = backupStatus.data.backup_folder?.split('/').pop();
                      return backup.folder !== backupFolder;
                    }
                    return true;
                  }).length === 0 && !(activeBackupId && backupStatus.data?.status === 'running') && (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-muted-foreground">
                        No backups found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
      )}

      {activeTab === 'settings' && (
        <div className="border rounded-lg overflow-hidden flex-shrink-0 flex flex-col" style={{ height: '70vh' }}>
          <div className="bg-muted/30 px-4 py-3 border-b flex items-center justify-between flex-shrink-0">
            <h3 className="font-semibold text-sm">Automated Backup Schedule</h3>
            <Button 
              onClick={() => settings.saveSettings.mutate(settingsForm, {
                onSuccess: () => {
                  showNotification('success', 'Settings saved successfully');
                },
                onError: () => {
                  showNotification('error', 'Failed to save settings');
                }
              })}
              disabled={settings.saveSettings.isPending || !settingsForm.enabled}
              size="sm"
            >
              {settings.saveSettings.isPending ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Settings
            </Button>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="p-6 space-y-6 max-w-3xl pb-8">
              {/* Enable Toggle */}
              <div className="flex items-center justify-between p-5 border rounded-lg bg-card">
                <div className="space-y-1">
                  <label className="text-base font-semibold">Enable Auto-Backups</label>
                  <p className="text-sm text-muted-foreground">Run backups automatically based on schedule</p>
                </div>
                <Switch 
                  checked={settingsForm.enabled}
                  onCheckedChange={(c) => setSettingsForm(s => ({...s, enabled: c}))}
                />
              </div>

              {/* Schedule Settings */}
              <div className="p-5 border rounded-lg bg-card space-y-6">
                <h4 className="text-sm font-semibold text-foreground">Schedule</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Frequency</label>
                    <Select 
                      value={settingsForm.frequency} 
                      onValueChange={(v: 'daily' | 'weekly' | 'monthly') => setSettingsForm(s => ({...s, frequency: v}))}
                      disabled={!settingsForm.enabled}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Time (UTC)</label>
                    <Input 
                      type="time" 
                      value={settingsForm.time} 
                      onChange={(e) => setSettingsForm(s => ({...s, time: e.target.value}))}
                      disabled={!settingsForm.enabled}
                    />
                  </div>
                </div>
              </div>

              {/* Retention Settings */}
              <div className="p-5 border rounded-lg bg-card space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Retention Policy</label>
                  <Input 
                    type="number" 
                    min="1" 
                    max="30"
                    value={settingsForm.retention} 
                    onChange={(e) => setSettingsForm(s => ({...s, retention: parseInt(e.target.value) || 5}))}
                    disabled={!settingsForm.enabled}
                    className="max-w-[200px]"
                  />
                  <p className="text-xs text-muted-foreground">Keep the most recent backups. Oldest backups are automatically deleted when limit is reached.</p>
                </div>
              </div>

              {/* Backup Content */}
              <div className="p-5 border rounded-lg bg-card space-y-4">
                <label className="text-sm font-semibold">What to backup?</label>
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <Switch 
                      id="inc-db"
                      checked={settingsForm.include_db}
                      onCheckedChange={(c) => setSettingsForm(s => ({...s, include_db: c}))}
                      disabled={!settingsForm.enabled}
                    />
                    <label htmlFor="inc-db" className="text-sm font-medium cursor-pointer">Database</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch 
                      id="inc-files"
                      checked={settingsForm.include_files}
                      onCheckedChange={(c) => setSettingsForm(s => ({...s, include_files: c}))}
                      disabled={!settingsForm.enabled}
                    />
                    <label htmlFor="inc-files" className="text-sm font-medium cursor-pointer">Files</label>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu.file && (
        <div
          ref={contextMenuRef}
          className="fixed bg-background border rounded-lg shadow-lg py-1 z-50 min-w-[180px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button
            onClick={() => {
              if (contextMenu.file) {
                downloadBackup(contextMenu.file);
                setContextMenu({ x: 0, y: 0, file: null });
              }
            }}
            className="w-full px-4 py-2 text-left text-sm hover:bg-muted transition-colors flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Download
          </button>
          
          <button
            onClick={() => {
              if (contextMenu.file) {
                handleRestore(contextMenu.file);
                setContextMenu({ x: 0, y: 0, file: null });
              }
            }}
            className="w-full px-4 py-2 text-left text-sm hover:bg-muted transition-colors flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4 text-green-600" />
            Restore
          </button>
          
          <div className="border-t my-1"></div>
          
          <button
            onClick={() => {
              if (contextMenu.file) {
                handleDelete(contextMenu.file);
                setContextMenu({ x: 0, y: 0, file: null });
              }
            }}
            className="w-full px-4 py-2 text-left text-sm hover:bg-destructive/10 text-destructive transition-colors flex items-center gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirm.show && deleteConfirm.backup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setDeleteConfirm({ show: false, backup: null })}>
          <div className="bg-card border border-border rounded-lg p-6 max-w-md w-full mx-4 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-2">Delete Backup</h3>
            <p className="text-muted-foreground mb-6">
              Are you sure you want to delete backup <span className="font-mono font-semibold">{deleteConfirm.backup.folder || deleteConfirm.backup.name}</span>? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setDeleteConfirm({ show: false, backup: null })}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDelete}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
