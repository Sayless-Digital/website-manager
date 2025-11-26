import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Database, Download, Search, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  useDatabaseInfo,
  useDatabaseTables,
  useTableData,
  useDatabaseBackup,
  useDatabaseQuery,
} from '@/features/sites/hooks/useDatabase';
import { formatBytes } from '@/lib/utils/format';

export default function DatabaseManager() {
  const { domain } = useParams<{ domain: string }>();
  const { data: dbInfo, isLoading: dbInfoLoading } = useDatabaseInfo(domain || '');
  const { data: tablesData, isLoading: tablesLoading } = useDatabaseTables(domain || '');
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const { data: tableData, isLoading: tableDataLoading } = useTableData(
    domain || '',
    selectedTable || '',
    page,
    100
  );
  const backupMutation = useDatabaseBackup();
  const queryMutation = useDatabaseQuery();
  const [customQuery, setCustomQuery] = useState('');
  const [queryResult, setQueryResult] = useState<any>(null);

  const handleBackup = async () => {
    if (!domain) return;
    try {
      const response = await backupMutation.mutateAsync(domain);
      const blob = new Blob([response.data], { type: 'application/gzip' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${domain}-${new Date().toISOString().split('T')[0]}.sql.gz`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Backup failed:', error);
    }
  };

  const handleQuery = async () => {
    if (!domain || !customQuery.trim()) return;
    try {
      const result = await queryMutation.mutateAsync({ domain, query: customQuery });
      setQueryResult(result);
    } catch (error: any) {
      setQueryResult({ error: error.response?.data?.error || 'Query failed' });
    }
  };

  if (dbInfoLoading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">Loading database information...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Link to={`/sites/${domain}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          <h1 className="text-2xl font-bold">Database Manager</h1>
        </div>
      </div>

      {dbInfo?.databases && dbInfo.databases.length > 0 ? (
        <div className="space-y-4">
          {dbInfo.databases.map((db) => (
            <Card key={db.name}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    {db.name}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant={db.connected ? 'default' : 'secondary'}>
                      {db.connected ? 'Connected' : 'Disconnected'}
                    </Badge>
                    <Button onClick={handleBackup} size="sm" variant="outline" disabled={backupMutation.isPending}>
                      <Download className="h-4 w-4 mr-2" />
                      Backup
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Size</p>
                    <p className="text-lg font-semibold">{formatBytes(db.size_mb * 1024 * 1024)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Tables</p>
                    <p className="text-lg font-semibold">{db.table_count}</p>
                  </div>
                </div>

                {tablesLoading ? (
                  <p className="text-muted-foreground">Loading tables...</p>
                ) : tablesData?.tables ? (
                  <div className="space-y-2">
                    <h3 className="font-semibold mb-2">Tables</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {tablesData.tables.map((table) => (
                        <div
                          key={table.name}
                          className={`p-3 border rounded-lg cursor-pointer hover:bg-accent ${
                            selectedTable === table.name ? 'border-primary' : ''
                          }`}
                          onClick={() => setSelectedTable(table.name)}
                        >
                          <div className="flex items-center justify-between">
                            <p className="font-medium">{table.name}</p>
                            <Badge variant="outline">{table.rows} rows</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatBytes(table.size_mb * 1024 * 1024)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {selectedTable && (
                  <div className="mt-4 border-t pt-4">
                    <h3 className="font-semibold mb-2">Table Data: {selectedTable}</h3>
                    {tableDataLoading ? (
                      <p className="text-muted-foreground">Loading data...</p>
                    ) : tableData ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              {tableData.columns.map((col) => (
                                <th key={col} className="text-left p-2">{col}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {tableData.rows.map((row, i) => (
                              <tr key={i} className="border-b">
                                {row.map((cell: any, j: number) => (
                                  <td key={j} className="p-2">{String(cell ?? '')}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <div className="flex items-center justify-between mt-2">
                          <p className="text-sm text-muted-foreground">
                            Showing {tableData.rows.length} of {tableData.total_rows} rows
                          </p>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setPage(p => Math.max(1, p - 1))}
                              disabled={page === 1}
                            >
                              Previous
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setPage(p => p + 1)}
                              disabled={tableData.rows.length < 100}
                            >
                              Next
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}

                <div className="mt-4 border-t pt-4">
                  <h3 className="font-semibold mb-2">Custom Query</h3>
                  <div className="space-y-2">
                    <Input
                      value={customQuery}
                      onChange={(e) => setCustomQuery(e.target.value)}
                      placeholder="SELECT * FROM wp_posts LIMIT 10;"
                      className="font-mono"
                    />
                    <Button onClick={handleQuery} disabled={queryMutation.isPending || !customQuery.trim()}>
                      <Search className="h-4 w-4 mr-2" />
                      Execute Query
                    </Button>
                    {queryResult && (
                      <div className="mt-2 p-3 bg-muted rounded-lg">
                        <pre className="text-sm overflow-auto">
                          {JSON.stringify(queryResult, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">No database information available</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

