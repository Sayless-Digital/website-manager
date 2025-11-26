import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { API_ENDPOINTS } from '@/lib/api/endpoints';
import type { Site } from '@/types';

export const useSites = () => {
  return useQuery({
    queryKey: ['sites'],
    queryFn: async () => {
      const { data } = await apiClient.get<Site[]>(
        API_ENDPOINTS.SITES.LIST
      );
      
      // Enhance site data with computed fields
      return data.map(site => ({
        ...site,
        status: (site.status || (site.apache_enabled === true ? 'active' : 'inactive')) as 'active' | 'inactive',
        disk_usage: site.disk_usage || (site.size_mb * 1024 * 1024),
        databases: site.databases || (site.db_name ? [{ name: site.db_name }] : []),
        wordpress_detected: site.wordpress_detected ?? false,
      }));
    },
  });
};

export const useSite = (domain: string) => {
  return useQuery({
    queryKey: ['site', domain],
    queryFn: async () => {
      const { data } = await apiClient.get<Site>(
        API_ENDPOINTS.SITES.GET(domain)
      );
      return data;
    },
    enabled: !!domain,
  });
};