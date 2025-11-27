import { AlertCircle, RefreshCw } from 'lucide-react';
import { ServiceCard } from '@/components/services/ServiceCard';
import { Button } from '@/components/ui/button';
import { useServices, useServiceControl } from '@/features/services/hooks/useServices';
import type { ServiceAction } from '@/types';

export default function Services() {
  const { data: services, isLoading, error, refetch } = useServices();
  const serviceControl = useServiceControl();

  if (isLoading) {
    return null; // Let router's Suspense handle loading
  }

  const handleServiceAction = async (service: string, action: ServiceAction) => {
    try {
      await serviceControl.mutateAsync({ service, action });
    } catch (err) {
      console.error('Service action failed:', err);
      // In a real app, we'd show a toast notification here
    }
  };

  const servicesArray = Array.isArray(services) ? services : [];

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <p className="text-sm text-destructive">
              Error loading services: {error instanceof Error ? error.message : 'Unknown error'}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </Button>
        </div>
      )}

      {/* Services Grid */}
      {servicesArray.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {servicesArray.map((service) => (
            <ServiceCard
              key={service.name}
              service={service}
              onAction={handleServiceAction}
            />
          ))}
        </div>
      ) : !error ? (
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No services available</p>
        </div>
      ) : null}
    </div>
  );
}