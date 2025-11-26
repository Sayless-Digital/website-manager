import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Play, Square, RotateCw, Power, Loader2 } from 'lucide-react';
import type { Service, ServiceAction } from '@/types';
import { useState } from 'react';

interface ServiceCardProps {
  service: Service;
  onAction: (service: string, action: ServiceAction) => Promise<void>;
}

export function ServiceCard({ service, onAction }: ServiceCardProps) {
  const [loadingAction, setLoadingAction] = useState<ServiceAction | null>(null);

  const handleAction = async (action: ServiceAction) => {
    setLoadingAction(action);
    try {
      await onAction(service.name, action);
    } finally {
      setLoadingAction(null);
    }
  };

  const isRunning = service.status === 'running';

  return (
    <Card className="h-full transition-shadow hover:shadow-lg">
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-lg font-semibold">{service.display_name}</CardTitle>
            <p className="text-sm text-muted-foreground">{service.name}</p>
          </div>
          <Badge
            variant={isRunning ? 'default' : 'destructive'}
            className="flex items-center gap-1.5 shrink-0"
          >
            <div
              className={`h-2 w-2 rounded-full ${
                isRunning ? 'bg-green-500 animate-pulse' : 'bg-red-500'
              }`}
            />
            {service.status}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {service.description && (
          <p className="text-sm text-muted-foreground">{service.description}</p>
        )}

        <div className="grid grid-cols-2 gap-2">
          {!isRunning && (
            <Button
              size="sm"
              variant="default"
              onClick={() => handleAction('start')}
              disabled={!!loadingAction}
              className="col-span-2"
            >
              {loadingAction === 'start' ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Start
            </Button>
          )}
          {isRunning && (
            <>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => handleAction('stop')}
                disabled={!!loadingAction}
              >
                {loadingAction === 'stop' ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Square className="h-4 w-4 mr-2" />
                )}
                Stop
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleAction('restart')}
                disabled={!!loadingAction}
              >
                {loadingAction === 'restart' ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <RotateCw className="h-4 w-4 mr-2" />
                )}
                Restart
              </Button>
            </>
          )}
        </div>

        <div className="pt-2 border-t">
          <Button
            size="sm"
            variant="ghost"
            className="w-full"
            onClick={() => handleAction(service.enabled ? 'disable' : 'enable')}
            disabled={!!loadingAction}
          >
            {loadingAction === 'enable' || loadingAction === 'disable' ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Power className="h-4 w-4 mr-2" />
            )}
            {service.enabled ? 'Disable Auto-Start' : 'Enable Auto-Start'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}