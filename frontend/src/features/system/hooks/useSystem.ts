import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { API_ENDPOINTS } from '@/lib/api/endpoints';
import type { SystemResources, SystemInfo } from '@/types';

export const useSystemResources = () => {
  return useQuery({
    queryKey: ['system', 'resources'],
    queryFn: async () => {
      const { data } = await apiClient.get<SystemResources>(
        API_ENDPOINTS.SYSTEM.RESOURCES
      );
      return data;
    },
    refetchInterval: 5000, // Refresh every 5 seconds
  });
};

export const useSystemInfo = () => {
  return useQuery({
    queryKey: ['system', 'info'],
    queryFn: async () => {
      const { data } = await apiClient.get<SystemInfo>(
        API_ENDPOINTS.SYSTEM.INFO
      );
      return data;
    },
  });
};