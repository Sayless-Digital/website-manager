import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Calendar, User, AlertCircle } from 'lucide-react';
import { useCronJobs } from '@/features/cron/hooks/useCronJobs';
import { formatDate } from '@/lib/utils/format';

export default function CronJobs() {
  const { data: cronJobs, isLoading, error } = useCronJobs();

  if (isLoading) {
    return null; // Let router's Suspense handle loading
  }

  const cronArray = Array.isArray(cronJobs) ? cronJobs : [];
  const activeJobs = cronArray.filter(job => job.enabled).length;

  return (
    <div className="space-y-6">

      {/* Cron Jobs List */}
      {cronArray.length > 0 ? (
        <div className="space-y-4">
          {cronArray.map((job, index) => (
            <Card key={index}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg flex items-center gap-2">
                      {job.command}
                      <Badge variant={job.enabled ? 'default' : 'secondary'}>
                        {job.enabled ? 'Active' : 'Inactive'}
                      </Badge>
                    </CardTitle>
                    {job.comment && (
                      <p className="text-sm text-muted-foreground">{job.comment}</p>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-3">
                  {/* Schedule */}
                  <div className="flex items-start gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Schedule</p>
                      <p className="text-sm text-muted-foreground font-mono">{job.schedule}</p>
                    </div>
                  </div>

                  {/* User */}
                  {job.user && (
                    <div className="flex items-start gap-2">
                      <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">User</p>
                        <p className="text-sm text-muted-foreground">{job.user}</p>
                      </div>
                    </div>
                  )}

                  {/* Last Run */}
                  {job.last_run && (
                    <div className="flex items-start gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">Last Run</p>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(job.last_run)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Full Command */}
                <div className="mt-4 pt-4 border-t">
                  <p className="text-xs text-muted-foreground mb-1">Full Command:</p>
                  <code className="text-xs bg-secondary px-2 py-1 rounded block break-all">
                    {job.schedule} {job.command}
                  </code>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No cron jobs found</p>
          <p className="text-sm text-muted-foreground mt-2">
            Cron jobs will appear here once they are configured
          </p>
        </div>
      )}
    </div>
  );
}