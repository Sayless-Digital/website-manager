import { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Database, RefreshCw, Plus, Save, X, Play,
  FileCode, ChevronRight, Globe, Folder, User, Server, HardDrive
} from 'lucide-react';
import {
  useDatabaseInfo,
  useDatabaseTables,
  useDatabaseQuery,
  useTableData,
} from '@/features/sites/hooks/useDatabase';
import { useSites } from '@/features/sites/hooks/useSites';
import { showNotification } from '@/lib/notifications';
import { cn } from '@/lib/utils/cn';
import { formatBytes } from '@/lib/utils/format';

// Types for query tabs
interface QueryTab {
  id: string;
  name: string;
  query: string;
  originalQuery: string;
  isDirty: boolean;
  result: any | null;
  loading: boolean;
}

// Types for browser tabs
interface BrowserTab {
  id: string;
  name: string;
  database: string;
  tableName?: string;
}

export default function DatabaseManager() {
  const { domain } = useParams<{ domain: string }>();
  const [browserTabs, setBrowserTabs] = useState<BrowserTab[]>([{
    id: 'browser-0',
    name: 'Database',
    database: ''
  }]);
  const [activeTab, setActiveTab] = useState('browser-0');
  const [openQueries, setOpenQueries] = useState<QueryTab[]>([]);
  const [currentLine, setCurrentLine] = useState(1);
  const [scrollTop, setScrollTop] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  // Hooks
  const queryClient = useQueryClient();
  const { data: sites } = useSites();
  const site = sites?.find(s => s.domain === domain);
  const { data: dbInfo, isLoading: dbInfoLoading } = useDatabaseInfo(domain || '');
  const { data: tablesData } = useDatabaseTables(domain || '');
  const queryMutation = useDatabaseQuery();

  // Get current database
  const currentBrowserTab = browserTabs.find(t => t.id === activeTab) || browserTabs[0];
  
  // Get table data if viewing a table
  const { data: tableData, isLoading: tableDataLoading } = useTableData(
    domain || '', 
    currentBrowserTab?.tableName || '', 
    1, 
    100
  );

  // Handle creating a new query
  const handleNewQuery = (initialQuery?: string, tableName?: string) => {
    const newTabId = `query-${Date.now()}`;
    const defaultQuery = `-- Database Information Query
-- Shows table count and database size

SELECT 
    COUNT(*) as table_count,
    ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) as total_size_mb,
    ROUND(SUM(data_length) / 1024 / 1024, 2) as data_size_mb,
    ROUND(SUM(index_length) / 1024 / 1024, 2) as index_size_mb
FROM information_schema.tables 
WHERE table_schema = DATABASE()`;
    const query = initialQuery || defaultQuery;
    const name = tableName ? `Query: ${tableName}` : `Query ${openQueries.length + 1}`;
    const newTab: QueryTab = {
      id: newTabId,
      name,
      query,
      originalQuery: query,
      isDirty: false,
      result: null,
      loading: false
    };
    setOpenQueries([...openQueries, newTab]);
    setActiveTab(newTabId);
  };

  // Handle opening a table in a new browser tab
  const handleOpenTable = (tableName: string) => {
    const newTabId = `browser-${Date.now()}`;
    const newTab: BrowserTab = {
      id: newTabId,
      name: tableName,
      database: '',
      tableName: tableName
    };
    setBrowserTabs([...browserTabs, newTab]);
    setActiveTab(newTabId);
  };

  // Handle closing a query tab
  const handleCloseTab = (tabId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const tab = openQueries.find(t => t.id === tabId);
    if (tab?.isDirty) {
      if (!confirm(`Discard changes to ${tab.name}?`)) {
        return;
      }
    }
    
    const newOpenQueries = openQueries.filter(t => t.id !== tabId);
    setOpenQueries(newOpenQueries);
    
    if (activeTab === tabId) {
      setActiveTab(newOpenQueries.length > 0 ? newOpenQueries[newOpenQueries.length - 1].id : 'browser-0');
    }
  };

  // Handle query content change
  const handleQueryChange = (tabId: string, newQuery: string) => {
    setOpenQueries(prev => prev.map(tab => {
      if (tab.id === tabId) {
        return {
          ...tab,
          query: newQuery,
          isDirty: newQuery !== tab.originalQuery
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
    setCurrentLine(lineNumber);
  };

  // Handle executing query
  const handleExecuteQuery = async (tabId: string) => {
    const tab = openQueries.find(t => t.id === tabId);
    if (!tab || !domain) return;

    setOpenQueries(prev => prev.map(t => 
      t.id === tabId ? { ...t, loading: true } : t
    ));

    try {
      const response = await queryMutation.mutateAsync({ 
        domain, 
        query: tab.query 
      });
      
      // Transform query results to match expected format
      let result;
      if (response.results && Array.isArray(response.results) && response.results.length > 0) {
        // Extract columns from first row keys
        const columns = Object.keys(response.results[0]);
        result = {
          columns,
          rows: response.results,
          row_count: response.row_count || response.results.length
        };
      } else if (response.error) {
        result = {
          error: response.error,
          columns: [],
          rows: []
        };
      } else {
        result = {
          columns: [],
          rows: [],
          row_count: 0
        };
      }
      
      setOpenQueries(prev => prev.map(t => {
        if (t.id === tabId) {
          return { 
            ...t, 
            result, 
            loading: false,
            originalQuery: t.query,
            isDirty: false
          };
        }
        return t;
      }));
      showNotification('success', 'Query executed successfully');
    } catch (error: any) {
      const errorResult = { 
        error: error.response?.data?.error || 'Query failed',
        columns: [],
        rows: []
      };
      setOpenQueries(prev => prev.map(t => 
        t.id === tabId ? { ...t, result: errorResult, loading: false } : t
      ));
      showNotification('error', 'Query execution failed');
    }
  };

  // Handle refresh
  const handleRefresh = () => {
    if (!domain) return;
    queryClient.invalidateQueries({ queryKey: ['database-info', domain] });
    queryClient.invalidateQueries({ queryKey: ['database-tables', domain] });
    queryClient.invalidateQueries({ queryKey: ['table-data', domain] });
  };

  // Show query editor if query is open
  const isQueryTab = openQueries.find(t => t.id === activeTab);
  
  if (isQueryTab) {
    const tab = openQueries.find(t => t.id === activeTab);
    if (!tab) return null;

    const queryText = typeof tab.query === 'string' ? tab.query : '';
    const totalLines = queryText.split('\n').length;
    const lines = queryText.split('\n');

    return (
      <div className="h-[calc(100vh-8rem)] flex flex-col gap-6 min-h-0">
        {/* Tab Bar */}
        <div className="flex items-center gap-1">
          {browserTabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg transition-colors",
                activeTab === t.id 
                  ? "bg-amber-50 border-amber-200 text-foreground" 
                  : "bg-background border-border hover:bg-muted/50"
              )}
            >
              <Database className="h-3.5 w-3.5" />
              <span className="max-w-[150px] truncate">{t.name}</span>
            </button>
          ))}
          {openQueries.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              onMouseDown={(e) => {
                if (e.button === 1) {
                  e.preventDefault();
                  handleCloseTab(t.id);
                }
              }}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg transition-colors",
                activeTab === t.id 
                  ? "bg-amber-50 border-amber-200 text-foreground" 
                  : "bg-background border-border hover:bg-muted/50"
              )}
            >
              <FileCode className="h-3.5 w-3.5" />
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
            onClick={handleNewQuery}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border rounded-lg bg-background hover:bg-muted/50 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            New Query
          </button>
        </div>

        {/* Query Editor Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Editing: {tab.name}</h2>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleCloseTab(tab.id)}
            >
              Close
            </Button>
            <Button 
              variant="default" 
              size="sm"
              onClick={() => handleExecuteQuery(tab.id)}
              disabled={tab.loading || !(typeof tab.query === 'string' ? tab.query.trim() : '')}
            >
              {tab.loading ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Execute
            </Button>
          </div>
        </div>

        {/* Query Editor */}
        <div className="border rounded-lg overflow-hidden">
          <div className="h-[30vh] relative flex">
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
                value={typeof tab.query === 'string' ? tab.query : ''}
                onChange={(e) => {
                  handleQueryChange(tab.id, e.target.value);
                  handleCursorChange(e);
                }}
                onSelect={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  const cursorPos = target.selectionStart;
                  const textBeforeCursor = target.value.substring(0, cursorPos);
                  const lineNumber = textBeforeCursor.split('\n').length;
                  setCurrentLine(lineNumber);
                }}
                onKeyUp={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  const cursorPos = target.selectionStart;
                  const textBeforeCursor = target.value.substring(0, cursorPos);
                  const lineNumber = textBeforeCursor.split('\n').length;
                  setCurrentLine(lineNumber);
                }}
                onClick={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  const cursorPos = target.selectionStart;
                  const textBeforeCursor = target.value.substring(0, cursorPos);
                  const lineNumber = textBeforeCursor.split('\n').length;
                  setCurrentLine(lineNumber);
                }}
                onScroll={(e) => {
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
          </div>
          {/* Editor Footer */}
          <div className="border-t px-4 py-2 flex items-center text-xs text-muted-foreground bg-muted/30">
            <span>Line {currentLine}</span>
            <div className="flex-1"></div>
            <span className="flex-1 text-center">{totalLines} lines</span>
            <div className="flex-1 flex items-center justify-end">
              <span>{typeof tab.query === 'string' ? tab.query.length : 0} characters</span>
            </div>
          </div>
        </div>

        {/* Query Results */}
        {tab.result && (
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-muted/30 px-4 py-2 border-b">
              <h3 className="font-semibold text-sm">Results</h3>
            </div>
            {tab.result.error ? (
              <div className="p-4 bg-destructive/10 text-destructive">
                <p className="font-semibold">Error:</p>
                <p className="text-sm mt-1">{tab.result.error}</p>
              </div>
            ) : (
              <div className="h-[30vh] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted text-left border-b sticky top-0 z-10">
                    <tr>
                      {tab.result.columns?.map((col: string, i: number) => (
                        <th key={i} className="p-3 font-medium bg-muted">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {tab.result.rows?.map((row: any, i: number) => (
                      <tr key={i} className="hover:bg-muted/50">
                        {tab.result.columns?.map((col: string, j: number) => (
                          <td key={j} className="p-3">{String(row[col] ?? '')}</td>
                        ))}
                      </tr>
                    ))}
                    {(!tab.result.rows || tab.result.rows.length === 0) && (
                      <tr>
                        <td colSpan={tab.result.columns?.length || 1} className="p-8 text-center text-muted-foreground">
                          No results
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
            <div className="border-t px-4 py-2 flex items-center text-xs text-muted-foreground bg-muted/30">
              <span>{tab.result.rows?.length || 0} rows returned</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Browser view
  const isTableTab = currentBrowserTab?.tableName;
  
  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col gap-6 min-h-0">
      {/* Tab Bar */}
      <div className="flex items-center gap-1">
        {browserTabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            onMouseDown={(e) => {
              if (e.button === 1 && browserTabs.length > 1) {
                e.preventDefault();
                setBrowserTabs(prev => prev.filter(tab => tab.id !== t.id));
                if (activeTab === t.id) {
                  const remaining = browserTabs.filter(tab => tab.id !== t.id);
                  setActiveTab(remaining.length > 0 ? remaining[0].id : (openQueries.length > 0 ? openQueries[0].id : 'browser-0'));
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
            <Database className="h-3.5 w-3.5" />
            <span className="max-w-[150px] truncate">{t.name}</span>
            {browserTabs.length > 1 && (
              <div 
                role="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setBrowserTabs(prev => prev.filter(tab => tab.id !== t.id));
                  if (activeTab === t.id) {
                    const remaining = browserTabs.filter(tab => tab.id !== t.id);
                    setActiveTab(remaining.length > 0 ? remaining[0].id : (openQueries.length > 0 ? openQueries[0].id : 'browser-0'));
                  }
                }}
                className="hover:bg-muted rounded p-0.5 ml-1"
              >
                <X className="h-3 w-3" />
              </div>
            )}
          </button>
        ))}
        {openQueries.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            onMouseDown={(e) => {
              if (e.button === 1) {
                e.preventDefault();
                handleCloseTab(t.id);
              }
            }}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg transition-colors",
              activeTab === t.id 
                ? "bg-amber-50 border-amber-200 text-foreground" 
                : "bg-background border-border hover:bg-muted/50"
            )}
          >
            <FileCode className="h-3.5 w-3.5" />
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
          onClick={handleNewQuery}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border rounded-lg bg-background hover:bg-muted/50 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          New Query
        </button>
      </div>

      {/* Top Control Bar with Breadcrumb */}
      <div className="flex items-center gap-4">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm flex-1">
          <button 
            onClick={() => {
              const mainTab = browserTabs.find(t => !t.tableName) || browserTabs[0];
              setActiveTab(mainTab.id);
            }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card border hover:bg-accent transition-colors"
          >
            <Globe className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{domain}</span>
          </button>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <button 
            onClick={() => {
              const mainTab = browserTabs.find(t => !t.tableName) || browserTabs[0];
              setActiveTab(mainTab.id);
            }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card border hover:bg-accent transition-colors"
          >
            <Database className="h-4 w-4 text-primary" />
            <span className="font-medium">Database</span>
          </button>
          {isTableTab && (
            <>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card border">
                <Database className="h-4 w-4 text-primary" />
                <span className="font-medium">{currentBrowserTab.tableName}</span>
              </div>
            </>
          )}
        </div>
        
        <Button variant="outline" size="sm" onClick={handleRefresh}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Database Info Cards */}
      {!isTableTab && (
      <div className="grid grid-cols-4 gap-4">
        <div className="px-4 py-3 rounded-lg border bg-card">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Database className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Database Name</p>
              <p className="text-sm font-medium">{site?.db_name || 'N/A'}</p>
            </div>
          </div>
        </div>
        
        <div className="px-4 py-3 rounded-lg border bg-card">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <User className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Database User</p>
              <p className="text-sm font-medium">{site?.db_user || 'N/A'}</p>
            </div>
          </div>
        </div>
        
        <div className="px-4 py-3 rounded-lg border bg-card">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <Server className="h-4 w-4 text-green-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Database Host</p>
              <p className="text-sm font-medium">{site?.db_host || 'localhost'}</p>
            </div>
          </div>
        </div>
        
        <div className="px-4 py-3 rounded-lg border bg-card">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <HardDrive className="h-4 w-4 text-purple-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Database Size</p>
              <p className="text-sm font-medium">
                {dbInfo?.size_mb ? `${Number(dbInfo.size_mb).toFixed(2)} MB` : 'N/A'}
              </p>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Table Data View or Tables List */}
      {isTableTab ? (
        <div className="border rounded-lg overflow-hidden flex-shrink-0" style={{ height: '70vh' }}>
          <div className="bg-muted/30 px-4 py-2 border-b">
            <h3 className="font-semibold text-sm">Table: {currentBrowserTab.tableName}</h3>
          </div>
          {tableDataLoading ? (
            <div className="flex items-center justify-center h-full">
              <RefreshCw className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : tableData ? (
            <>
              <div className="h-[calc(70vh-3.5rem)] overflow-y-auto overflow-x-auto">
                <table className="w-full text-sm min-w-full">
                  <thead className="bg-muted text-left border-b sticky top-0 z-10">
                    <tr>
                      {tableData.columns?.map((col: string, i: number) => (
                        <th key={i} className="p-3 font-medium bg-muted">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {tableData.rows?.map((row: any, i: number) => (
                      <tr key={i} className="hover:bg-muted/50">
                        {tableData.columns?.map((col: string, j: number) => (
                          <td key={j} className="p-3">{String(row[col] ?? '')}</td>
                        ))}
                      </tr>
                    ))}
                    {(!tableData.rows || tableData.rows.length === 0) && (
                      <tr>
                        <td colSpan={tableData.columns?.length || 1} className="p-8 text-center text-muted-foreground">
                          No data
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="border-t px-4 py-2 flex items-center text-xs text-muted-foreground bg-muted/30">
                <span>{tableData.rows?.length || 0} rows shown {tableData.total_rows ? `of ${tableData.total_rows}` : ''}</span>
              </div>
            </>
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              Failed to load table data
            </div>
          )}
        </div>
      ) : (
        tablesData?.tables && tablesData.tables.length > 0 && (
          <div className="border rounded-lg overflow-hidden flex-shrink-0" style={{ height: '55vh' }}>
            <div className="h-full overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left border-b sticky top-0 z-10">
                  <tr>
                    <th className="p-3 font-medium bg-muted">Table Name</th>
                    <th className="p-3 font-medium bg-muted">Rows</th>
                    <th className="p-3 font-medium bg-muted">Size</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {tablesData.tables.map((table) => (
                    <tr 
                      key={table.name} 
                      className="hover:bg-muted/50 cursor-pointer"
                      onClick={() => handleOpenTable(table.name)}
                    >
                      <td className="p-3 font-medium">{table.name}</td>
                      <td className="p-3 text-muted-foreground">{table.rows.toLocaleString()}</td>
                      <td className="p-3 text-muted-foreground">{formatBytes(table.size_mb * 1024 * 1024)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}
    </div>
  );
}