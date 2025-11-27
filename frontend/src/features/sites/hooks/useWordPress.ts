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

export interface WordPressPlugin {
  name: string;
  status: string;
  update: string;
  version: string;
  title: string;
  author?: string;
}

export interface WordPressTheme {
  name: string;
  status: string;
  update: string;
  version: string;
  title: string;
  author?: string;
}

export const useWordPressPlugins = (domain: string) => {
  const queryClient = useQueryClient();
  
  const query = useQuery({
    queryKey: ['wordpress-plugins', domain],
    queryFn: async () => {
      try {
        const response = await apiClient.get<WordPressPlugin[] | { error: string }>(API_ENDPOINTS.SITES.WORDPRESS_PLUGINS(domain));
        if (response.data && 'error' in response.data) {
          throw new Error(response.data.error);
        }
        return response.data as WordPressPlugin[];
      } catch (error: any) {
        console.error('Error fetching plugins:', error);
        // Return error object so UI can display it
        return { error: error.response?.data?.error || error.message || 'Failed to load plugins' } as any;
      }
    },
    enabled: !!domain,
    retry: false,
  });

  const togglePlugin = useMutation({
    mutationFn: async ({ plugin, action }: { plugin: string; action: 'activate' | 'deactivate' }) => {
      const { data } = await apiClient.post(API_ENDPOINTS.SITES.WORDPRESS_PLUGIN_ACTION(domain, plugin, action));
      return data;
    },
    onMutate: async ({ plugin, action }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['wordpress-plugins', domain] });
      
      // Snapshot the previous value
      const previousPlugins = queryClient.getQueryData<WordPressPlugin[]>(['wordpress-plugins', domain]);
      
      // Optimistically update to the new value
      if (previousPlugins) {
        queryClient.setQueryData<WordPressPlugin[]>(['wordpress-plugins', domain], (old) => {
          if (!old) return old;
          return old.map(p => 
            p.name === plugin 
              ? { ...p, status: action === 'activate' ? 'active' : 'inactive' }
              : p
          );
        });
      }
      
      return { previousPlugins };
    },
    onError: (_err, _variables, context) => {
      // Rollback to previous value on error
      if (context?.previousPlugins) {
        queryClient.setQueryData(['wordpress-plugins', domain], context.previousPlugins);
      }
    },
    onSuccess: () => {
      // Invalidate and immediately refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['wordpress-plugins', domain] });
    },
  });

  return { ...query, togglePlugin };
};

export const useWordPressThemes = (domain: string) => {
  const queryClient = useQueryClient();
  
  const query = useQuery({
    queryKey: ['wordpress-themes', domain],
    queryFn: async () => {
      const { data } = await apiClient.get<WordPressTheme[]>(API_ENDPOINTS.SITES.WORDPRESS_THEMES(domain));
      return data;
    },
    enabled: !!domain,
  });

  const activateTheme = useMutation({
    mutationFn: async (theme: string) => {
      const { data } = await apiClient.post(API_ENDPOINTS.SITES.WORDPRESS_THEME_ACTIVATE(domain, theme));
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wordpress-themes', domain] });
    },
  });

  return { ...query, activateTheme };
};
