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
  const runningCount = servicesArray.filter(s => s.status === 'running').length;
  const totalCount = servicesArray.length;

  return (
    <div className="space-y-6">

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
      ) : (
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No services available</p>
        </div>
      )}
    </div>
  );
}