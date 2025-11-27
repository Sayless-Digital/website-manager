import { useState, useRef, useEffect } from 'react';
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

// Types for browser tabs
interface BrowserTab {
  id: string;
  name: string;
  currentPath: string;
  searchQuery: string;
}

export default function FileManager() {
  const { domain } = useParams<{ domain: string }>();
  const [browserTabs, setBrowserTabs] = useState<BrowserTab[]>([{
    id: 'browser-0',
    name: 'Files',
    currentPath: '/',
    searchQuery: ''
  }]);
  const [activeTab, setActiveTab] = useState('browser-0');
  const [openFiles, setOpenFiles] = useState<EditorTab[]>([]);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFileName, setNewFileName] = useState('');
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [showNewFileInput, setShowNewFileInput] = useState(false);
  const [currentLine, setCurrentLine] = useState(1);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; file: FileInfo | null }>({ x: 0, y: 0, file: null });
  const [searchFocused, setSearchFocused] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Get current browser tab
  const currentBrowserTab = browserTabs.find(t => t.id === activeTab) || browserTabs[0];
  const currentPath = currentBrowserTab.currentPath;
  const searchQuery = currentBrowserTab.searchQuery;

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

  // Update current browser tab path
  const setCurrentPath = (path: string) => {
    setBrowserTabs(prev => prev.map(tab => {
      if (tab.id === activeTab) {
        const folderName = path === '/' ? 'Files' : path.split('/').filter(Boolean).pop() || 'Files';
        return { ...tab, currentPath: path, name: folderName };
      }
      return tab;
    }));
  };

  // Update current browser tab search query
  const setSearchQuery = (query: string) => {
    setBrowserTabs(prev => prev.map(tab => 
      tab.id === activeTab ? { ...tab, searchQuery: query } : tab
    ));
  };

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

  // Handle cursor position change
  const handleCursorChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const textarea = e.target;
    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = textarea.value.substring(0, cursorPos);
    const lineNumber = textBeforeCursor.split('\n').length;
    setCursorPosition(cursorPos);
    setCurrentLine(lineNumber);
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

  // Handle context menu
  const handleContextMenu = (e: React.MouseEvent, file: FileInfo) => {
    e.preventDefault();
    
    // Get viewport dimensions
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Context menu dimensions (approximate)
    const menuWidth = 180;
    const menuHeight = file.type === 'file' ? 240 : 200; // More items for files
    
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

  // Handle opening file in new tab
  const handleOpenInNewTab = async (file: FileInfo) => {
    if (file.type === 'dir') {
      const newTabId = `browser-${Date.now()}`;
      const newTab: BrowserTab = {
        id: newTabId,
        name: file.name,
        currentPath: file.path,
        searchQuery: ''
      };
      setBrowserTabs([...browserTabs, newTab]);
      setActiveTab(newTabId);
    } else {
      await handleOpenFile(file);
    }
    setContextMenu({ x: 0, y: 0, file: null });
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
  const isEditorTab = openFiles.find(t => t.id === activeTab);
  const isBrowserTab = browserTabs.find(t => t.id === activeTab);
  
  if (isEditorTab) {
    const tab = openFiles.find(t => t.id === activeTab);
    if (!tab) return null;

    const totalLines = tab.content.split('\n').length;
    const totalChars = tab.content.length;
    const lines = tab.content.split('\n');

    return (
      <div className="h-[calc(100vh-8rem)] flex flex-col gap-6 overflow-hidden">
        {/* Tab Bar */}
        <div className="flex items-center gap-1">
          {browserTabs.map(t => {
            const folderName = t.currentPath === '/' ? 'Files' : t.currentPath.split('/').filter(Boolean).pop() || 'Files';
            return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              onMouseDown={(e) => {
                if (e.button === 1 && browserTabs.length > 1) { // Middle mouse button
                  e.preventDefault();
                  setBrowserTabs(prev => prev.filter(tab => tab.id !== t.id));
                  if (activeTab === t.id) {
                    const remaining = browserTabs.filter(tab => tab.id !== t.id);
                    setActiveTab(remaining.length > 0 ? remaining[0].id : (openFiles.length > 0 ? openFiles[0].id : 'browser-0'));
                  }
                }
              }}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg transition-colors group",
                activeTab === t.id 
                  ? "bg-amber-50 border-amber-200 text-foreground" 
                  : "bg-background border-border hover:bg-muted/50"
              )}
            >
              <Folder className="h-3.5 w-3.5" />
              <span className="max-w-[150px] truncate">{folderName}</span>
              {browserTabs.length > 1 && (
                <div 
                  role="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setBrowserTabs(prev => prev.filter(tab => tab.id !== t.id));
                    if (activeTab === t.id) {
                      const remaining = browserTabs.filter(tab => tab.id !== t.id);
                      setActiveTab(remaining.length > 0 ? remaining[0].id : (openFiles.length > 0 ? openFiles[0].id : 'browser-0'));
                    }
                  }}
                  className="hover:bg-muted rounded p-0.5 ml-1"
                >
                  <X className="h-3 w-3" />
                </div>
             )}
           </button>
           );
           })}
         {openFiles.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              onMouseDown={(e) => {
                if (e.button === 1) { // Middle mouse button
                  e.preventDefault();
                  handleCloseTab(t.id);
                }
              }}
               className={cn(
                 "flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg transition-colors group",
                 activeTab === t.id 
                   ? "bg-amber-50 border-amber-200 text-foreground" 
                   : "bg-background border-border hover:bg-muted/50"
               )}
             >
               <File className="h-3.5 w-3.5" />
              <span className="max-w-[150px] truncate">{t.name}</span>
              {t.isDirty && <span className="h-1.5 w-1.5 rounded-full bg-yellow-500" />}
              <div 
                role="button"
                onClick={(e) => handleCloseTab(t.id, e)}
                className="hover:bg-muted rounded p-0.5 ml-1"
              >
                <X className="h-3 w-3" />
              </div>
            </button>
          ))}
          <button
            onClick={() => {
              const newTabId = `browser-${Date.now()}`;
              const newTab: BrowserTab = {
                id: newTabId,
                name: `Files ${browserTabs.length + 1}`,
                currentPath: '/',
                searchQuery: ''
              };
              setBrowserTabs([...browserTabs, newTab]);
              setActiveTab(newTabId);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border rounded-lg bg-background hover:bg-muted/50 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            New Tab
          </button>
        </div>

        {/* Editor Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Editing: {tab.name}</h2>
          <div className="flex items-center gap-2 ml-auto">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleCloseTab(tab.id)}
              disabled={tab.loading}
            >
              Close
            </Button>
            <Button 
              variant="default" 
              size="sm"
              onClick={() => handleSaveFile(tab.id)}
              disabled={!tab.isDirty || tab.loading}
            >
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
          </div>
        </div>

        {/* Editor */}
        <div className="border rounded-lg overflow-hidden">
          <div className="h-[65vh] relative flex">
            {tab.loading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-background/50">
                <RefreshCw className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <>
                {/* Line Numbers */}
                <div
                  ref={lineNumbersRef}
                  className="bg-muted/30 border-r px-3 text-right text-xs text-muted-foreground font-mono select-none shrink-0 overflow-hidden relative"
                  style={{
                    width: `${String(totalLines).length * 0.6 + 1}rem`,
                    lineHeight: '1.25rem'
                  }}
                >
                  {Array.from({ length: totalLines }, (_, index) => (
                    <div
                      key={index + 1}
                      className={cn(
                        "relative leading-[1.25rem]",
                        index + 1 === currentLine && "text-primary font-semibold"
                      )}
                    >
                      {index + 1}
                    </div>
                  ))}
                </div>
                {/* Editor Content */}
                <div className="flex-1 relative overflow-hidden">
                  <div
                    className="absolute left-1 right-1 bg-primary/5 pointer-events-none transition-transform duration-75 z-10 rounded"
                    style={{
                      height: '1.25rem',
                      transform: `translateY(${(currentLine - 1) * 1.25 - scrollTop / 16}rem)`
                    }}
                  />
                  <textarea
                    ref={textareaRef}
                    className="absolute inset-0 w-full h-full px-4 pl-2 py-0 font-mono text-sm resize-none bg-transparent focus:outline-none overflow-y-auto overflow-x-auto relative z-20"
                    value={tab.content}
                    onChange={(e) => {
                      handleContentChange(tab.id, e.target.value);
                      handleCursorChange(e);
                    }}
                    onSelect={(e) => {
                      const target = e.target as HTMLTextAreaElement;
                      const cursorPos = target.selectionStart;
                      const textBeforeCursor = target.value.substring(0, cursorPos);
                      const lineNumber = textBeforeCursor.split('\n').length;
                      setCursorPosition(cursorPos);
                      setCurrentLine(lineNumber);
                    }}
                    onKeyUp={(e) => {
                      const target = e.target as HTMLTextAreaElement;
                      const cursorPos = target.selectionStart;
                      const textBeforeCursor = target.value.substring(0, cursorPos);
                      const lineNumber = textBeforeCursor.split('\n').length;
                      setCursorPosition(cursorPos);
                      setCurrentLine(lineNumber);
                    }}
                    onClick={(e) => {
                      const target = e.target as HTMLTextAreaElement;
                      const cursorPos = target.selectionStart;
                      const textBeforeCursor = target.value.substring(0, cursorPos);
                      const lineNumber = textBeforeCursor.split('\n').length;
                      setCursorPosition(cursorPos);
                      setCurrentLine(lineNumber);
                    }}
                    onScroll={(e) => {
                      // Sync line numbers scroll with textarea scroll and track scroll position
                      const scrollTop = e.currentTarget.scrollTop;
                      if (lineNumbersRef.current) {
                        lineNumbersRef.current.scrollTop = scrollTop;
                      }
                      setScrollTop(scrollTop);
                    }}
                    spellCheck={false}
                    style={{
                      lineHeight: '1.25rem',
                    }}
                  />
                </div>
              </>
            )}
          </div>
          {/* Editor Footer */}
          <div className="border-t px-4 py-2 flex items-center text-xs text-muted-foreground bg-muted/30">
            <span>Line {currentLine}</span>
            <div className="flex-1"></div>
            <span className="flex-1 text-center">{totalLines} lines</span>
            <div className="flex-1 flex items-center justify-end">
              <span>{totalChars} characters</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col gap-6 min-h-0">
      {/* Tab Bar */}
      <div className="flex items-center gap-1">
         {browserTabs.map(t => {
           const folderName = t.currentPath === '/' ? 'Files' : t.currentPath.split('/').filter(Boolean).pop() || 'Files';
           return (
           <button
             key={t.id}
             onClick={() => setActiveTab(t.id)}
             onMouseDown={(e) => {
               if (e.button === 1 && browserTabs.length > 1) { // Middle mouse button
                 e.preventDefault();
                 setBrowserTabs(prev => prev.filter(tab => tab.id !== t.id));
                 if (activeTab === t.id) {
                   const remaining = browserTabs.filter(tab => tab.id !== t.id);
                   setActiveTab(remaining.length > 0 ? remaining[0].id : (openFiles.length > 0 ? openFiles[0].id : 'browser-0'));
                 }
               }
             }}
             className={cn(
               "flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg transition-colors group",
               activeTab === t.id 
                 ? "bg-amber-50 border-amber-200 text-foreground" 
                 : "bg-background border-border hover:bg-muted/50"
             )}
           >
             <Folder className="h-3.5 w-3.5" />
             <span className="max-w-[150px] truncate">{folderName}</span>
            {browserTabs.length > 1 && (
              <div 
                role="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setBrowserTabs(prev => prev.filter(tab => tab.id !== t.id));
                  if (activeTab === t.id) {
                    const remaining = browserTabs.filter(tab => tab.id !== t.id);
                    setActiveTab(remaining.length > 0 ? remaining[0].id : (openFiles.length > 0 ? openFiles[0].id : 'browser-0'));
                  }
                }}
                className="hover:bg-muted rounded p-0.5 ml-1"
              >
                <X className="h-3 w-3" />
              </div>
            )}
          </button>
          );
          })}
        {openFiles.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            onMouseDown={(e) => {
              if (e.button === 1) { // Middle mouse button
                e.preventDefault();
                handleCloseTab(t.id);
              }
            }}
               className={cn(
                 "flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg transition-colors group",
                 activeTab === t.id 
                   ? "bg-amber-50 border-amber-200 text-foreground" 
                   : "bg-background border-border hover:bg-muted/50"
               )}
             >
               <File className="h-3.5 w-3.5" />
            <span className="max-w-[150px] truncate">{t.name}</span>
            {t.isDirty && <span className="h-1.5 w-1.5 rounded-full bg-yellow-500" />}
            <div 
              role="button"
              onClick={(e) => handleCloseTab(t.id, e)}
              className="hover:bg-muted rounded p-0.5 ml-1"
            >
              <X className="h-3 w-3" />
            </div>
          </button>
        ))}
        <button
          onClick={() => {
            const newTabId = `browser-${Date.now()}`;
            const newTab: BrowserTab = {
              id: newTabId,
              name: 'Files',
              currentPath: '/',
              searchQuery: ''
            };
            setBrowserTabs([...browserTabs, newTab]);
            setActiveTab(newTabId);
            refetch();
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border rounded-lg bg-background hover:bg-muted/50 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          New Tab
        </button>
      </div>

      {/* Top Control Bar */}
      <div className="flex items-center gap-4">
              {/* Search - Left */}
              <div className="relative flex-1 max-w-md">
                <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 transition-colors ${searchFocused ? "text-primary" : "text-muted-foreground"}`} />
                <Input
                  placeholder="Search files and folders..."
                  className="pl-10 h-8 focus-visible:ring-0"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                />
                        </div>

              {/* Buttons - Right */}
              <div className="flex items-center gap-2 ml-auto">
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
      <div className="border rounded-lg overflow-hidden flex-shrink-0" style={{ height: '60vh' }}>
        <div className="h-full overflow-y-auto">
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
                        onContextMenu={(e) => handleContextMenu(e, file)}
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

      {/* Context Menu */}
      {contextMenu.file && (
        <div
          ref={contextMenuRef}
          className="fixed bg-background border rounded-lg shadow-lg py-1 z-50 min-w-[180px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button
            onClick={() => {
              if (contextMenu.file) handleOpenFile(contextMenu.file);
              setContextMenu({ x: 0, y: 0, file: null });
            }}
            className="w-full px-4 py-2 text-left text-sm hover:bg-muted transition-colors flex items-center gap-2"
          >
            {contextMenu.file.type === 'dir' ? <Folder className="h-4 w-4" /> : <File className="h-4 w-4" />}
            Open
          </button>
          
          {contextMenu.file.type === 'file' && (
            <button
              onClick={() => {
                if (contextMenu.file) handleOpenFile(contextMenu.file);
                setContextMenu({ x: 0, y: 0, file: null });
              }}
              className="w-full px-4 py-2 text-left text-sm hover:bg-muted transition-colors flex items-center gap-2"
            >
              <FileCode className="h-4 w-4" />
              Edit
            </button>
          )}
          
          <button
            onClick={() => {
              if (contextMenu.file) handleOpenInNewTab(contextMenu.file);
            }}
            className="w-full px-4 py-2 text-left text-sm hover:bg-muted transition-colors flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Open in New Tab
          </button>
          
          <button
            onClick={() => {
              if (contextMenu.file) {
                handleDownloadFile.mutate(contextMenu.file.path);
              }
              setContextMenu({ x: 0, y: 0, file: null });
            }}
            className="w-full px-4 py-2 text-left text-sm hover:bg-muted transition-colors flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Download
          </button>
          
          <div className="border-t my-1"></div>
          
          <button
            onClick={() => {
              if (contextMenu.file) {
                handleDelete(contextMenu.file.path);
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
    </div>
  );
}
