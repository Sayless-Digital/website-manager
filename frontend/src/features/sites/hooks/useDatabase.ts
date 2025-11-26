import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { API_ENDPOINTS } from '@/lib/api/endpoints';

export interface DatabaseInfo {
  name: string;
  size_mb: number;
  table_count: number;
  connected: boolean;
}

export interface DatabaseTable {
  name: string;
  rows: number;
  size_mb: number;
}

export interface TableData {
  columns: string[];
  rows: any[][];
  total_rows: number;
}

export const useDatabaseInfo = (domain: string) => {
  return useQuery({
    queryKey: ['sites', domain, 'database', 'info'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ databases: DatabaseInfo[] }>(
        API_ENDPOINTS.SITES.DATABASE(domain)
      );
      return data;
    },
    enabled: !!domain,
  });
};

export const useDatabaseTables = (domain: string) => {
  return useQuery({
    queryKey: ['sites', domain, 'database', 'tables'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ tables: DatabaseTable[] }>(
        API_ENDPOINTS.SITES.DATABASE_TABLES(domain)
      );
      return data;
    },
    enabled: !!domain,
  });
};

export const useTableData = (domain: string, tableName: string, page: number = 1, limit: number = 100) => {
  return useQuery({
    queryKey: ['sites', domain, 'database', 'table', tableName, page, limit],
    queryFn: async () => {
      const { data } = await apiClient.get<TableData>(
        `${API_ENDPOINTS.SITES.DATABASE_TABLE_DATA(domain, tableName)}?page=${page}&limit=${limit}`
      );
      return data;
    },
    enabled: !!domain && !!tableName,
  });
};

export const useDatabaseBackup = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (domain: string) => {
      const response = await apiClient.post(API_ENDPOINTS.SITES.DATABASE_BACKUP(domain), {}, {
        responseType: 'blob',
      });
      return response;
    },
    onSuccess: (_, domain) => {
      queryClient.invalidateQueries({ queryKey: ['sites', domain, 'database'] });
    },
  });
};

export const useDatabaseQuery = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ domain, query }: { domain: string; query: string }) => {
      const { data } = await apiClient.post(API_ENDPOINTS.SITES.DATABASE_QUERY(domain), { query });
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['sites', variables.domain, 'database'] });
    },
  });
};

