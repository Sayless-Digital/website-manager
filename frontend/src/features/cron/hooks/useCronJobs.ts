import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { API_ENDPOINTS } from '@/lib/api/endpoints';
import type { CronJob } from '@/types';

export const useCronJobs = () => {
  return useQuery({
    queryKey: ['cron', 'jobs'],
    queryFn: async () => {
      const { data } = await apiClient.get<CronJob[]>(
        API_ENDPOINTS.CRON.LIST
      );
      return data;
    },
  });
};