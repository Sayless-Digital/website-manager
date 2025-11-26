import { useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Folder, RefreshCw, Home, Upload, 
  Plus, Search, Download, Trash2, Save, X, ChevronRight,
  FileCode, FileImage, FileText, FileArchive, File, Globe
} from 'lucide-react';
import { useFiles, useFileContent, useSaveFile, useCreateFolder, useDeleteFile, useUploadFile, useDownloadFile, type FileInfo } from '@/features/sites/hooks/useFiles';
import { useSites } from '@/features/sites/hooks/useSites';
import { showNotification } from '@/lib/notifications';
import { cn } from '@/lib/utils/cn';
import { formatBytes } from '@/lib/utils/format';

// Types for our editor tabs
interface EditorTab {
  id: string;
  name: string;
  path: string;
  content: string;
  originalContent: string;
  isDirty: boolean;
  loading: boolean;
}

export default function FileManager() {
  const { domain } = useParams<{ domain: string }>();
  const [currentPath, setCurrentPath] = useState('/');
  const [activeTab, setActiveTab] = useState('browser');
  const [openFiles, setOpenFiles] = useState<EditorTab[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [newFileName, setNewFileName] = useState('');
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [showNewFileInput, setShowNewFileInput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Hooks
  const { data: sites } = useSites();
  const site = sites?.find(s => s.domain === domain);
  const { data: files, isLoading, refetch } = useFiles(domain!, currentPath);
  const getFileContent = useFileContent(domain!);
  const saveFile = useSaveFile(domain!);
  const createFolder = useCreateFolder(domain!);
  const deleteFile = useDeleteFile(domain!);
  const uploadFile = useUploadFile(domain!);
  const downloadFile = useDownloadFile();

  // Handle opening a file
  const handleOpenFile = async (file: FileInfo) => {
    if (file.type === 'dir') {
      setCurrentPath(file.path);
      setSearchQuery('');
      return;
    }

    // Check if file is already open
    const existingTab = openFiles.find(tab => tab.path === file.path);
    if (existingTab) {
      setActiveTab(existingTab.id);
      return;
    }

    // Create new tab placeholder
    const newTabId = `file-${Date.now()}`;
    const newTab: EditorTab = {
      id: newTabId,
      name: file.name,
      path: file.path,
      content: '',
      originalContent: '',
      isDirty: false,
      loading: true,
    };

    setOpenFiles([...openFiles, newTab]);
    setActiveTab(newTabId);

    try {
      const data = await getFileContent.mutateAsync(file.path);
      setOpenFiles(prev => prev.map(tab => {
        if (tab.id === newTabId) {
          return {
            ...tab,
            content: data.content,
            originalContent: data.content,
            loading: false
          };
        }
        return tab;
      }));
    } catch (error) {
      showNotification('error', 'Failed to load file content');
      handleCloseTab(newTabId);
    }
  };

  // Handle closing a tab
  const handleCloseTab = (tabId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const tab = openFiles.find(t => t.id === tabId);
    if (tab?.isDirty) {
      if (!confirm(`Save changes to ${tab.name} before closing?`)) {
        return;
      }
    }
    
    const newOpenFiles = openFiles.filter(t => t.id !== tabId);
    setOpenFiles(newOpenFiles);
    
    if (activeTab === tabId) {
      setActiveTab(newOpenFiles.length > 0 ? newOpenFiles[newOpenFiles.length - 1].id : 'browser');
    }
  };

  // Handle saving a file
  const handleSaveFile = async (tabId: string) => {
    const tab = openFiles.find(t => t.id === tabId);
    if (!tab) return;

    try {
      await saveFile.mutateAsync({ path: tab.path, content: tab.content });
      setOpenFiles(prev => prev.map(t => {
        if (t.id === tabId) {
          return { ...t, originalContent: t.content, isDirty: false };
        }
        return t;
      }));
      showNotification('success', 'File saved successfully');
    } catch (error) {
      showNotification('error', 'Failed to save file');
    }
  };

  // Handle file content change
  const handleContentChange = (tabId: string, newContent: string) => {
    setOpenFiles(prev => prev.map(tab => {
      if (tab.id === tabId) {
        return {
          ...tab,
          content: newContent,
          isDirty: newContent !== tab.originalContent
        };
      }
      return tab;
    }));
  };

  // Handle create folder
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    try {
      await createFolder.mutateAsync({ path: currentPath, name: newFolderName });
      setShowNewFolderInput(false);
      setNewFolderName('');
      showNotification('success', 'Folder created');
      refetch();
    } catch (error) {
      showNotification('error', 'Failed to create folder');
    }
  };

  // Handle create file
  const handleCreateFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim()) return;

    try {
      const filePath = currentPath === '/' ? `/${newFileName}` : `${currentPath}/${newFileName}`;
      await saveFile.mutateAsync({ path: filePath, content: '' });
      setShowNewFileInput(false);
      setNewFileName('');
      showNotification('success', 'File created');
      refetch();
      // Open the new file
      const newFile: FileInfo = {
        name: newFileName,
        path: filePath,
        type: 'file',
        size: 0,
        permissions: '',
        modified: new Date().toISOString()
      };
      handleOpenFile(newFile);
    } catch (error) {
      showNotification('error', 'Failed to create file');
    }
  };

  // Handle delete
  const handleDelete = async (path: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    try {
      await deleteFile.mutateAsync(path);
      showNotification('success', 'Item deleted');
      
      // Close tab if deleted file was open
      const openTab = openFiles.find(t => t.path === path);
      if (openTab) {
        handleCloseTab(openTab.id);
      }
      refetch();
    } catch (error) {
      showNotification('error', 'Failed to delete item');
    }
  };

  // Handle upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      try {
        await uploadFile.mutateAsync({ path: currentPath, file });
        showNotification('success', 'File uploaded successfully');
        refetch();
    } catch (error) {
        showNotification('error', 'Failed to upload file');
      }
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Helper to get file icon
  const getFileIcon = (file: FileInfo) => {
    if (file.type === 'dir') return <Folder className="h-5 w-5 text-primary" />;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext || '')) return <FileImage className="h-5 w-5 text-purple-500 dark:text-purple-400" />;
    if (['js', 'jsx', 'ts', 'tsx', 'css', 'html', 'php', 'json', 'py'].includes(ext || '')) return <FileCode className="h-5 w-5 text-yellow-500 dark:text-yellow-400" />;
    if (['zip', 'tar', 'gz', 'rar'].includes(ext || '')) return <FileArchive className="h-5 w-5 text-red-500 dark:text-red-400" />;
    return <FileText className="h-5 w-5 text-muted-foreground" />;
  };

  // Format file size
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Filter files
  const filteredFiles = files?.filter(f => 
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  // Show editor if file is open, otherwise show browser
  if (activeTab !== 'browser' && openFiles.find(t => t.id === activeTab)) {
    const tab = openFiles.find(t => t.id === activeTab);
    if (!tab) return null;

    return (
      <div className="h-[calc(100vh-100px)] flex flex-col">
        <div className="border-b px-4 bg-muted/30 flex items-center">
          <div className="flex items-center h-10">
            <button
              onClick={() => setActiveTab('browser')}
              className={cn(
                "flex items-center gap-2 h-10 px-4 rounded-none border-b-2 transition-colors",
                activeTab === 'browser' 
                  ? "bg-background border-primary" 
                  : "border-transparent hover:bg-muted/50"
              )}
            >
              <Folder className="h-4 w-4" />
              Browser
            </button>
            {openFiles.map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={cn(
                  "flex items-center gap-2 h-10 px-4 rounded-none border-b-2 transition-colors group",
                  activeTab === t.id 
                    ? "bg-background border-primary" 
                    : "border-transparent hover:bg-muted/50"
                )}
              >
                <span className="max-w-[150px] truncate">{t.name}</span>
                {t.isDirty && <span className="h-2 w-2 rounded-full bg-yellow-500" />}
                <div 
                  role="button"
                  onClick={(e) => handleCloseTab(t.id, e)}
                  className="opacity-0 group-hover:opacity-100 hover:bg-muted rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </div>
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 flex flex-col">
          <div className="p-2 border-b bg-card flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground px-2">{tab.path}</span>
              {tab.isDirty && (
                <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Unsaved Changes</Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="default" 
                size="sm"
                onClick={() => handleSaveFile(tab.id)}
                disabled={!tab.isDirty}
              >
                <Save className="h-4 w-4 mr-2" />
                Save
              </Button>
            </div>
          </div>
          <div className="flex-1 relative">
            {tab.loading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-background/50">
                <RefreshCw className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <textarea
                className="w-full h-full p-4 font-mono text-sm resize-none bg-background focus:outline-none"
                value={tab.content}
                onChange={(e) => handleContentChange(tab.id, e.target.value)}
                spellCheck={false}
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tab Bar */}
      <div className="flex items-center gap-2 border-b pb-2">
        <button
          onClick={() => setActiveTab('browser')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg transition-colors",
            activeTab === 'browser' 
              ? "bg-primary text-primary-foreground" 
              : "hover:bg-muted"
          )}
        >
          <Folder className="h-4 w-4" />
          Browser
        </button>
        {openFiles.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg transition-colors group",
              activeTab === t.id 
                ? "bg-primary text-primary-foreground" 
                : "hover:bg-muted"
            )}
          >
            <span className="max-w-[150px] truncate">{t.name}</span>
            {t.isDirty && <span className="h-2 w-2 rounded-full bg-yellow-500" />}
            <div 
              role="button"
              onClick={(e) => handleCloseTab(t.id, e)}
              className="opacity-0 group-hover:opacity-100 hover:bg-muted rounded-full p-0.5"
            >
              <X className="h-3 w-3" />
            </div>
          </button>
        ))}
        <button
          onClick={() => {
            // Create a new empty file tab
            const newTabId = `file-${Date.now()}`;
            const newTab: EditorTab = {
              id: newTabId,
              name: 'untitled',
              path: currentPath === '/' ? '/untitled' : `${currentPath}/untitled`,
              content: '',
              originalContent: '',
              isDirty: false,
              loading: false,
            };
            setOpenFiles([...openFiles, newTab]);
            setActiveTab(newTabId);
          }}
          className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
          title="New Tab"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Top Control Bar */}
      <div className="flex items-center gap-4">
              {/* Search - Left */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search files and folders..." 
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                        </div>

              {/* Buttons - Middle */}
              <div className="flex items-center gap-2">
                {showNewFolderInput ? (
                  <form onSubmit={handleCreateFolder} className="flex gap-2">
                        <Input
                          placeholder="Folder name"
                      className="h-9 w-[150px]"
                          value={newFolderName}
                          onChange={(e) => setNewFolderName(e.target.value)}
                          autoFocus
                        />
                    <Button type="submit" size="sm" className="h-9">Create</Button>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm" 
                      className="h-9"
                      onClick={() => { setShowNewFolderInput(false); setNewFolderName(''); }}
                    >
                      <X className="h-4 w-4" />
                          </Button>
                  </form>
                ) : showNewFileInput ? (
                  <form onSubmit={handleCreateFile} className="flex gap-2">
                        <Input
                      placeholder="File name" 
                      className="h-9 w-[150px]"
                          value={newFileName}
                          onChange={(e) => setNewFileName(e.target.value)}
                          autoFocus
                        />
                    <Button type="submit" size="sm" className="h-9">Create</Button>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm" 
                      className="h-9"
                      onClick={() => { setShowNewFileInput(false); setNewFileName(''); }}
                    >
                      <X className="h-4 w-4" />
                        </Button>
                  </form>
                    ) : (
                      <>
                    <Button variant="outline" size="sm" onClick={() => setShowNewFolderInput(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      New Folder
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setShowNewFileInput(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      New File
                    </Button>
                    <div className="relative">
                      <input
                        type="file"
                        className="hidden"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                      />
                      <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Files
                      </Button>
                    </div>
                  </>
                )}
              </div>

        {/* Storage - Right */}
        <div className="px-3 py-1.5 rounded-lg border shrink-0">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Storage:</span>
            <span className="font-medium">{formatBytes(site?.disk_usage || 0)}</span>
          </div>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <button 
          onClick={() => setCurrentPath('/')}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card border hover:bg-accent transition-colors"
        >
          <Globe className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{domain}</span>
                </button>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                <button
          onClick={() => setCurrentPath('/')}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card border hover:bg-accent transition-colors"
        >
          <Folder className="h-4 w-4 text-primary" />
          <span className="font-medium">public_html</span>
                </button>
        {currentPath.split('/').filter(Boolean).map((part, i, arr) => (
          <>
            <ChevronRight key={`chevron-${i}`} className="h-4 w-4 text-muted-foreground" />
                <button
              key={`button-${i}`}
              onClick={() => {
                const newPath = '/' + arr.slice(0, i + 1).join('/');
                setCurrentPath(newPath);
              }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card border hover:bg-accent transition-colors"
            >
              <Folder className="h-4 w-4 text-primary" />
              <span className="font-medium">{part}</span>
                </button>
              </>
        ))}
      </div>

      {/* File List */}
      <div className="border rounded-lg overflow-hidden">
        <div className="h-[65vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left border-b sticky top-0 z-10">
              <tr>
                <th className="p-3 font-medium w-8 bg-muted">
                  <input type="checkbox" className="rounded" />
                </th>
                <th className="p-3 font-medium bg-muted">Name</th>
                <th className="p-3 font-medium bg-muted">Modified</th>
                <th className="p-3 font-medium bg-muted">Size</th>
              </tr>
            </thead>
            <tbody className="divide-y">
                    {currentPath !== '/' && (
                      <tr 
                        className="hover:bg-muted/50 cursor-pointer"
                        onClick={() => {
                          const parent = currentPath.split('/').slice(0, -1).join('/') || '/';
                          setCurrentPath(parent);
                        }}
                      >
                        <td className="p-3">
                          <input type="checkbox" className="rounded" onClick={(e) => e.stopPropagation()} />
                        </td>
                        <td className="p-3 flex items-center gap-2 font-medium">
                          <Folder className="h-5 w-5 text-primary" />
                          <span>..</span>
                        </td>
                        <td className="p-3 text-muted-foreground">-</td>
                        <td className="p-3 text-muted-foreground">-</td>
                      </tr>
                    )}
                    
                    {filteredFiles.map((file) => (
                      <tr 
                        key={file.path} 
                        className="hover:bg-muted/50 cursor-pointer"
                        onClick={() => handleOpenFile(file)}
                      >
                        <td className="p-3" onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" className="rounded" />
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            {getFileIcon(file)}
                            <span className="font-medium text-foreground">
                              {file.name}
                            </span>
                          </div>
                        </td>
                        <td className="p-3 text-muted-foreground text-sm">
                          {new Date(file.modified).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                        </td>
                        <td className="p-3 text-muted-foreground text-sm">
                          {file.type === 'dir' ? '-' : formatSize(file.size)}
                        </td>
                      </tr>
                    ))}
                    {filteredFiles.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-muted-foreground">
                          {files?.length === 0 ? 'Empty folder' : 'No files found'}
                        </td>
                      </tr>
                    )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
