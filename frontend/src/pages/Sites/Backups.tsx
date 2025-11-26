import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Download, Database, Trash2, RefreshCw, FileArchive, Clock, FolderOpen, Archive, Save } from 'lucide-react';
import { useBackups, useCreateBackup, useRestoreBackup, useDeleteBackup, useBackupSettings, type BackupFile } from '@/features/sites/hooks/useBackups';
import { apiClient } from '@/lib/api/client';
import { showNotification } from '@/lib/notifications';
import { API_ENDPOINTS } from '@/lib/api/endpoints';

export default function Backups() {
  const { domain } = useParams<{ domain: string }>();
  const [activeTab, setActiveTab] = useState('database');

  // Hooks
  const dbBackups = useBackups(domain!, 'database');
  const fileBackups = useBackups(domain!, 'files');
  const createBackup = useCreateBackup(domain!);
  const restoreBackup = useRestoreBackup(domain!);
  const deleteBackup = useDeleteBackup(domain!);
  const settings = useBackupSettings(domain!);

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

  const handleCreateBackup = (type: 'database' | 'files') => {
    createBackup.mutate(type, {
      onSuccess: () => showNotification('success', `${type === 'database' ? 'Database' : 'File'} backup started`),
      onError: () => showNotification('error', 'Backup failed to start')
    });
  };

  const handleRestore = (file: BackupFile) => {
    if (!confirm(`Are you sure you want to restore ${file.name}? This will overwrite current data.`)) return;
    
    restoreBackup.mutate({ filename: file.name, type: file.type }, {
      onSuccess: () => showNotification('success', 'Restoration completed successfully'),
      onError: () => showNotification('error', 'Restoration failed')
    });
  };

  const handleDelete = (file: BackupFile) => {
    if (!confirm(`Delete backup ${file.name}?`)) return;
    
    deleteBackup.mutate({ filename: file.name, type: file.type }, {
      onSuccess: () => showNotification('success', 'Backup deleted'),
      onError: () => showNotification('error', 'Failed to delete backup')
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

  // Render backup table
  const BackupTable = ({ data, type }: { data?: BackupFile[], type: 'database' | 'files' }) => (
    <div className="rounded-md border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr>
            <th className="p-3 text-left font-medium">Filename</th>
            <th className="p-3 text-left font-medium">Date</th>
            <th className="p-3 text-left font-medium">Size</th>
            <th className="p-3 text-left font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {data?.map((file) => (
            <tr key={file.name} className="hover:bg-muted/50">
              <td className="p-3 font-mono flex items-center gap-2">
                {type === 'database' ? <Database className="h-4 w-4 text-blue-500" /> : <FileArchive className="h-4 w-4 text-yellow-600" />}
                {file.name}
              </td>
              <td className="p-3">{new Date(file.date).toLocaleString()}</td>
              <td className="p-3 font-mono">{formatSize(file.size)}</td>
              <td className="p-3 flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => downloadBackup({...file, type})}>
                  <Download className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleRestore({...file, type})}>
                  <RefreshCw className="h-4 w-4 text-green-600" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete({...file, type})}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </td>
            </tr>
          ))}
          {(!data || data.length === 0) && (
            <tr>
              <td colSpan={4} className="p-8 text-center text-muted-foreground">
                No {type} backups found
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to={`/sites/${domain}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">Backup Manager</h1>
            <span className="text-muted-foreground px-2 py-1 bg-muted rounded text-sm">{domain}</span>
          </div>
        </div>
      </div>

      {/* Folder Structure Info */}
      <Card className="bg-muted/30 border-dashed">
        <CardContent className="p-4 flex items-start gap-4">
          <FolderOpen className="h-5 w-5 text-muted-foreground mt-1" />
          <div className="space-y-1 text-sm">
            <p className="font-medium text-foreground">Backup Storage Locations</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1 text-muted-foreground">
              <p>Database: <code className="bg-background px-1 rounded">/Documents/Storage/Websites/{domain}/backups/db/</code></p>
              <p>Files: <code className="bg-background px-1 rounded">/Documents/Storage/Websites/{domain}/backups/files/</code></p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="database" className="flex gap-2">
            <Database className="h-4 w-4" /> Database
          </TabsTrigger>
          <TabsTrigger value="files" className="flex gap-2">
            <Archive className="h-4 w-4" /> Files
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex gap-2">
            <Clock className="h-4 w-4" /> Auto-Backup
          </TabsTrigger>
        </TabsList>

        {/* Database Tab */}
        <TabsContent value="database" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => handleCreateBackup('database')} disabled={createBackup.isPending}>
              <Database className="h-4 w-4 mr-2" />
              Create Database Backup
            </Button>
          </div>
          <BackupTable data={dbBackups.data?.map(f => ({...f, type: 'database'}))} type="database" />
        </TabsContent>

        {/* Files Tab */}
        <TabsContent value="files" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => handleCreateBackup('files')} disabled={createBackup.isPending}>
              <Archive className="h-4 w-4 mr-2" />
              Create File Backup (public_html)
            </Button>
          </div>
          <BackupTable data={fileBackups.data?.map(f => ({...f, type: 'files'}))} type="files" />
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Automated Backup Schedule</CardTitle>
              <CardDescription>Configure automatic backups for this website.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 max-w-2xl">
              <div className="flex items-center justify-between p-4 border rounded-lg bg-card">
                <div className="space-y-0.5">
                  <label className="text-base font-medium">Enable Auto-Backups</label>
                  <p className="text-sm text-muted-foreground">Run backups automatically based on schedule</p>
                </div>
                <Switch 
                  checked={settingsForm.enabled}
                  onCheckedChange={(c) => setSettingsForm(s => ({...s, enabled: c}))}
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
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

                <div className="space-y-2">
                  <label className="text-sm font-medium">Retention (copies)</label>
                  <Input 
                    type="number" 
                    min="1" 
                    max="30"
                    value={settingsForm.retention} 
                    onChange={(e) => setSettingsForm(s => ({...s, retention: parseInt(e.target.value) || 5}))}
                    disabled={!settingsForm.enabled}
                  />
                  <p className="text-xs text-muted-foreground">Oldest backups are deleted when limit is reached.</p>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <label className="text-sm font-medium">What to backup?</label>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <Switch 
                      id="inc-db"
                      checked={settingsForm.include_db}
                      onCheckedChange={(c) => setSettingsForm(s => ({...s, include_db: c}))}
                      disabled={!settingsForm.enabled}
                    />
                    <label htmlFor="inc-db" className="text-sm">Database</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch 
                      id="inc-files"
                      checked={settingsForm.include_files}
                      onCheckedChange={(c) => setSettingsForm(s => ({...s, include_files: c}))}
                      disabled={!settingsForm.enabled}
                    />
                    <label htmlFor="inc-files" className="text-sm">Files</label>
                  </div>
                </div>
              </div>

              <Button 
                className="mt-4" 
                onClick={() => settings.saveSettings.mutate(settingsForm)}
                disabled={settings.saveSettings.isPending}
              >
                {settings.saveSettings.isPending ? (
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
