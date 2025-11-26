import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { API_ENDPOINTS } from '@/lib/api/endpoints';

export interface WordPressInfo {
  version?: string;
  site_url?: string;
  home_url?: string;
  admin_email?: string;
  db_name?: string;
  db_user?: string;
  db_host?: string;
  table_prefix?: string;
  debug_mode?: boolean;
}

export interface DNSStatus {
  record: {
    type: string;
    content: string;
    proxied: boolean;
  } | null;
  resolves_to: string[];
  tunnel_status?: {
    configured: boolean;
    ingress_found: boolean;
  };
}

export const useWordPressInfo = (domain: string) => {
  return useQuery({
    queryKey: ['wordpress', domain],
    queryFn: async () => {
      const { data } = await apiClient.get<WordPressInfo>(API_ENDPOINTS.SITES.WORDPRESS_INFO(domain));
      return data;
    },
    enabled: !!domain,
  });
};

export const useCheckDNS = (domain: string) => {
  return useQuery({
    queryKey: ['wordpress', 'dns', domain],
    queryFn: async () => {
      const { data } = await apiClient.get<DNSStatus>(API_ENDPOINTS.SITES.WORDPRESS_CHECK_DNS(domain));
      return data;
    },
    enabled: false, // Only run when manually triggered
    retry: false
  });
};

export const useChangeDomain = (domain: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (targetDomain: string) => {
      const { data } = await apiClient.post(API_ENDPOINTS.SITES.WORDPRESS_CHANGE_DOMAIN(domain), {
        new_domain: targetDomain
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wordpress', domain] });
      queryClient.invalidateQueries({ queryKey: ['sites'] });
    },
  });
};
