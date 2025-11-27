import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { API_ENDPOINTS } from '@/lib/api/endpoints';

export interface CloudflareZoneSummary {
  id: string;
  name: string;
  status: string;
}

export const useMailCloudflareZones = (enabled = true) => {
  return useQuery({
    queryKey: ['mail', 'cloudflare', 'zones'],
    queryFn: async () => {
      const { data } = await apiClient.get<CloudflareZoneSummary[]>(API_ENDPOINTS.MAIL.CF_ZONES);
      return data;
    },
    enabled,
  });
};

export const useImportCloudflareZone = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { zoneId: string; name: string; auto_dns_enabled?: boolean }) => {
      const { data } = await apiClient.post(API_ENDPOINTS.MAIL.CF_IMPORT(payload.zoneId), {
        name: payload.name,
        auto_dns_enabled: payload.auto_dns_enabled,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mail', 'domains'] });
    },
  });
};


