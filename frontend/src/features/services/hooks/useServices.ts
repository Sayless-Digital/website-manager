import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { API_ENDPOINTS } from '@/lib/api/endpoints';
import type { Service, ServiceAction, ServiceControlResponse } from '@/types';

export const useServices = () => {
  return useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      const { data } = await apiClient.get<Record<string, Omit<Service, 'name'> & { name: string }>>(
        API_ENDPOINTS.SERVICES.LIST
      );
      
      // Transform object to array
      if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
        return Object.entries(data).map(([key, value]) => ({
          name: key,
          display_name: value.name || key,
          status: value.status,
          enabled: value.enabled,
          active: value.active,
        })) as Service[];
      }
      
      // If it's already an array, return as is
      return Array.isArray(data) ? data : [];
    },
    refetchInterval: 5000, // Refresh every 5 seconds
  });
};

export const useServiceControl = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      service,
      action,
    }: {
      service: string;
      action: ServiceAction;
    }) => {
      const { data } = await apiClient.post<ServiceControlResponse>(
        API_ENDPOINTS.SERVICES.CONTROL(service, action)
      );
      return data;
    },
    onSuccess: () => {
      // Invalidate services query to refresh the list
      queryClient.invalidateQueries({ queryKey: ['services'] });
    },
  });
};