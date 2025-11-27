import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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

export interface CreateCronJobData {
  schedule: string;
  command: string;
  comment?: string;
  enabled?: boolean;
}

export const useCreateCronJob = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateCronJobData) => {
      const { data: response } = await apiClient.post(API_ENDPOINTS.CRON.CREATE, data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cron', 'jobs'] });
    },
  });
};

export const useDeleteCronJob = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (rawLine: string) => {
      const { data } = await apiClient.post(API_ENDPOINTS.CRON.DELETE, { raw_line: rawLine });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cron', 'jobs'] });
    },
  });
};

export const useToggleCronJob = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ rawLine, enabled }: { rawLine: string; enabled: boolean }) => {
      const { data } = await apiClient.post(API_ENDPOINTS.CRON.TOGGLE, { raw_line: rawLine, enabled });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cron', 'jobs'] });
    },
  });
};