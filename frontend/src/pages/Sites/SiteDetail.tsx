import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ExternalLink, Database, HardDrive, Server, Globe, FolderOpen, Download, Settings } from 'lucide-react';
import { useSites } from '@/features/sites/hooks/useSites';
import { formatBytes } from '@/lib/utils/format';

export default function SiteDetail() {
  const { domain } = useParams<{ domain: string }>();
  const { data: sites, isLoading } = useSites();
  
  const site = sites?.find(s => s.domain === domain);

  if (isLoading) {
    return null; // Let router's Suspense handle loading
  }

  if (!site) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground">Site not found</p>
        </CardContent>
      </Card>
    );
  }

  const totalDatabaseSizeBytes =
    site.databases?.reduce((acc, db) => {
      if (typeof db.size_mb === 'number') {
        return acc + db.size_mb * 1024 * 1024;
      }
      return acc;
    }, 0) ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{site.domain}</h1>
          <p className="text-sm text-muted-foreground">{site.path}</p>
        </div>
        <Button asChild>
          <a href={`http://${site.domain}`} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-2 h-4 w-4" />
            Visit Site
          </a>
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Badge variant={site.status === 'active' ? 'default' : 'secondary'}>
              {site.status}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Disk Usage</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatBytes(site.disk_usage || 0)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Databases</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{site.databases?.length || 0}</div>
            {totalDatabaseSizeBytes > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {formatBytes(totalDatabaseSizeBytes)}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* WordPress Info */}
      {site.wordpress_detected && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              WordPress Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Detected:</span>
              <span className="font-medium">Yes</span>
            </div>
            {site.wordpress_version && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Version:</span>
                <span className="font-medium">{site.wordpress_version}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Databases */}
      {site.databases && site.databases.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Databases</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {site.databases.map((db) => (
                <div
                  key={db.name}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div>
                    <p className="font-mono text-sm font-medium">{db.name}</p>
                    {db.user && (
                      <p className="text-xs text-muted-foreground">User: {db.user}</p>
                    )}
                  </div>
                  {typeof db.size_mb === 'number' && (
                    <div className="text-right">
                      <p className="font-semibold">{db.size_mb.toFixed(2)} MB</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Site Details */}
      <Card>
        <CardHeader>
          <CardTitle>Site Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Domain:</span>
            <span className="font-medium">{site.domain}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Path:</span>
            <span className="font-mono text-sm">{site.path}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Status:</span>
            <Badge variant={site.status === 'active' ? 'default' : 'secondary'}>
              {site.status}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Management Tools */}
      <Card>
        <CardHeader>
          <CardTitle>Management Tools</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <Button asChild variant="outline" className="h-auto flex-col gap-2 py-4">
              <Link to={`/sites/${site.domain}/files`}>
                <FolderOpen className="h-5 w-5" />
                <span>File Manager</span>
              </Link>
            </Button>
            
            {site.databases && site.databases.length > 0 && (
              <Button asChild variant="outline" className="h-auto flex-col gap-2 py-4">
                <Link to={`/sites/${site.domain}/database`}>
                  <Database className="h-5 w-5" />
                  <span>Database</span>
                </Link>
              </Button>
            )}
            
            {site.databases && site.databases.length > 0 && (
              <Button asChild variant="outline" className="h-auto flex-col gap-2 py-4">
                <Link to={`/sites/${site.domain}/backups`}>
                  <Download className="h-5 w-5" />
                  <span>Backups</span>
                </Link>
              </Button>
            )}
            
            {site.wordpress_detected && (
              <Button asChild variant="outline" className="h-auto flex-col gap-2 py-4">
                <Link to={`/sites/${site.domain}/wordpress`}>
                  <Settings className="h-5 w-5" />
                  <span>WordPress</span>
                </Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}