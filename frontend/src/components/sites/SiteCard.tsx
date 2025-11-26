import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Database, HardDrive, ExternalLink, Settings, Server } from 'lucide-react';
import { formatBytes } from '@/lib/utils/format';
import type { Site } from '@/types';
import { Link } from 'react-router-dom';

interface SiteCardProps {
  site: Site;
}

export function SiteCard({ site }: SiteCardProps) {
  const diskUsagePercent =
    site.disk_usage && site.size_mb
      ? Math.min((site.disk_usage / (1024 * 1024 * 1024)) * 100, 100)
      : 0;

  const databaseCount = site.databases?.length || 0;
  const hasDatabases = Boolean(site.databases && site.databases.length > 0);
  const totalDatabaseSizeBytes =
    site.databases?.reduce((acc, db) => {
      if (typeof db.size_mb === 'number') {
        return acc + db.size_mb * 1024 * 1024;
      }
      return acc;
    }, 0) ?? 0;

  const hasDatabaseSizeData = site.databases?.some(db => typeof db.size_mb === 'number') ?? false;
  const formattedDatabaseSize =
    hasDatabaseSizeData ? formatBytes(totalDatabaseSizeBytes) : 'No DB size data';

  return (
    <Card className="h-full transition-shadow hover:shadow-lg">
      <CardHeader className="space-y-2">
        <CardTitle className="text-lg font-semibold truncate">
          {site.domain}
        </CardTitle>

        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {site.wordpress_detected && (
            <span className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1">
              <Server className="h-3.5 w-3.5" />
              WordPress
              {site.wordpress_version && (
                <span className="text-xs">v{site.wordpress_version}</span>
              )}
            </span>
          )}
          <Badge
            variant={site.status === 'active' ? 'default' : 'secondary'}
            className="shrink-0"
          >
            {site.status}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="rounded-lg border p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <HardDrive className="h-4 w-4" />
              Disk Usage
            </div>
            <p className="text-sm font-semibold">{formatBytes(site.disk_usage || 0)}</p>
          </div>
        </div>

        {hasDatabases && (
          <div className="rounded-lg border">
            <div className="flex items-center justify-between border-b px-3 py-2">
              <span className="text-sm font-medium">Databases</span>
              <Badge variant="outline">{databaseCount}</Badge>
            </div>
            <div className="divide-y">
              {site.databases!.slice(0, 3).map((db) => (
                <div key={db.name} className="flex items-center justify-between px-3 py-2">
                  <span className="font-mono text-sm text-muted-foreground truncate">{db.name}</span>
                  {typeof db.size_mb === 'number' && (
                    <span className="text-sm font-medium">
                      {db.size_mb.toFixed(1)} MB
                    </span>
                  )}
                </div>
              ))}
              {databaseCount > 3 && (
                <div className="px-3 py-2 text-sm text-muted-foreground">
                  +{databaseCount - 3} more
                </div>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href={`http://${site.domain}`} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              Visit
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to={`/sites/${site.domain}`}>
              <Settings className="mr-2 h-4 w-4" />
              Manage
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}