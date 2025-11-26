import { Globe, Database, HardDrive, Cpu, Activity, AlertCircle } from 'lucide-react';
import { StatCard } from '@/components/dashboard/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useSites } from '@/features/sites/hooks/useSites';
import { useServices } from '@/features/services/hooks/useServices';
import { useSystemResources } from '@/features/system/hooks/useSystem';
import { formatBytes } from '@/lib/utils/format';
import { Link } from 'react-router-dom';
import type { Site } from '@/types';

export default function Dashboard() {
  const { data: sites, isLoading: sitesLoading } = useSites();
  const { data: services, isLoading: servicesLoading } = useServices();
  const { data: resources, isLoading: resourcesLoading } = useSystemResources();

  if (sitesLoading || servicesLoading || resourcesLoading) {
    return null; // Let router's Suspense handle loading
  }

  if (sitesLoading || servicesLoading || resourcesLoading) {
    return null; // Let router's Suspense handle loading
  }

  const calculateDatabaseSizeBytes = (databases?: Site['databases']) => {
    if (!databases) return 0;
    return databases.reduce((acc, db) => {
      if (typeof db.size_mb === 'number' && db.size_mb > 0) {
        return acc + db.size_mb * 1024 * 1024;
      }
      return acc;
    }, 0);
  };

  // Calculate statistics
  const sitesArray = Array.isArray(sites) ? sites : [];
  const servicesArray = Array.isArray(services) ? services : [];
  
  const totalSites = sitesArray.length;
  const totalDatabaseSizeBytes = sitesArray.reduce(
    (acc, site) => acc + calculateDatabaseSizeBytes(site.databases),
    0
  );
  const formattedTotalDatabaseSize =
    totalDatabaseSizeBytes > 0 ? formatBytes(totalDatabaseSizeBytes) : 'No DB size data';
  const diskUsagePercent = resources?.disk?.percent || 0;
  const memoryUsagePercent = resources?.memory?.percent || 0;

  // Get recent sites (last 5)
  const recentSites = sitesArray.slice(0, 5);

  // Check service statuses
  const runningServices = servicesArray.filter(s => s.status === 'running').length;
  const totalServices = servicesArray.length;

  return (
    <div className="space-y-6">

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Websites"
          value={totalSites}
          icon={Globe}
          description={`${formattedTotalDatabaseSize} in databases`}
        />
        <StatCard
          title="Services Running"
          value={`${runningServices}/${totalServices}`}
          icon={Activity}
          description={totalServices > 0 ? `${Math.round((runningServices / totalServices) * 100)}% operational` : 'No services'}
        />
        <StatCard
          title="Disk Usage"
          value={`${diskUsagePercent.toFixed(1)}%`}
          icon={HardDrive}
          description={resources?.disk ? `${formatBytes(resources.disk.used)} / ${formatBytes(resources.disk.total)}` : 'Loading...'}
        />
        <StatCard
          title="Memory Usage"
          value={`${memoryUsagePercent.toFixed(1)}%`}
          icon={Cpu}
          description={resources?.memory ? `${formatBytes(resources.memory.used)} / ${formatBytes(resources.memory.total)}` : 'Loading...'}
        />
      </div>

      {/* Recent Sites and Services */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Recent Sites */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Sites</CardTitle>
          </CardHeader>
          <CardContent>
            {recentSites.length > 0 ? (
              <div className="space-y-3">
                {recentSites.map((site) => (
                  <div key={site.domain} className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Link
                        to={`/sites/${site.domain}`}
                        className="font-medium hover:underline"
                      >
                        {site.domain}
                      </Link>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Database className="h-3 w-3" />
                        {(() => {
                          const dbSizeBytes = calculateDatabaseSizeBytes(site.databases);
                          return dbSizeBytes > 0 ? formatBytes(dbSizeBytes) : 'No DB size data';
                        })()}
                        <HardDrive className="h-3 w-3 ml-2" />
                        {formatBytes(site.disk_usage)}
                      </div>
                    </div>
                    <Badge variant={site.status === 'active' ? 'default' : 'secondary'}>
                      {site.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No sites available</p>
            )}
          </CardContent>
        </Card>

        {/* Services Status */}
        <Card>
          <CardHeader>
            <CardTitle>Services Status</CardTitle>
          </CardHeader>
          <CardContent>
            {servicesArray.length > 0 ? (
              <div className="space-y-3">
                {servicesArray.map((service) => (
                  <div key={service.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className={`h-2 w-2 rounded-full ${
                          service.status === 'running' ? 'bg-green-500' : 'bg-red-500'
                        }`}
                      />
                      <span className="font-medium">{service.display_name}</span>
                    </div>
                    <Badge
                      variant={service.status === 'running' ? 'default' : 'destructive'}
                    >
                      {service.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No services available</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* System Alerts */}
      {(diskUsagePercent > 80 || memoryUsagePercent > 80) && (
        <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
              <div className="space-y-1">
                <p className="font-medium text-yellow-900 dark:text-yellow-100">
                  Resource Usage Warning
                </p>
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  {diskUsagePercent > 80 && `Disk usage is at ${diskUsagePercent}%. `}
                  {memoryUsagePercent > 80 && `Memory usage is at ${memoryUsagePercent}%. `}
                  Consider freeing up resources.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
