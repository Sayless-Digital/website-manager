import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { API_ENDPOINTS } from '@/lib/api/endpoints';

export interface BackupFile {
  name: string;
  size: number;
  date: string;
  path: string;
  type: 'database' | 'files' | 'both';
  folder?: string;
}

export interface BackupSettings {
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'monthly';
  retention: number; // number of backups to keep
  include_files: boolean;
  include_db: boolean;
  time: string; // HH:MM format
}

export const useBackups = (domain: string, type?: 'database' | 'files') => {
  return useQuery({
    queryKey: ['backups', domain, type],
    queryFn: async () => {
      const { data } = await apiClient.get<BackupFile[]>(`/api/site/${domain}/backups`);
      if (type) {
        return data.filter(b => b.type === type);
      }
      return data;
    },
    enabled: !!domain,
  });
};

export const useCreateBackup = (domain: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (type: 'database' | 'files' | 'both') => {
      const { data } = await apiClient.post(`/api/site/${domain}/backup`, { type });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backups', domain] });
    },
  });
};

export const useBackupStatus = (domain: string, backupId: string | null) => {
  return useQuery({
    queryKey: ['backup-status', domain, backupId],
    queryFn: async () => {
      if (!backupId) return null;
      const { data } = await apiClient.get(`/api/site/${domain}/backup/${backupId}/status`);
      return data;
    },
    enabled: !!backupId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      // Keep polling if running, or if status is not_found (might still be starting)
      return (status === 'running' || status === 'not_found') ? 1000 : false;
    },
  });
};

export const useActiveBackups = (domain: string) => {
  return useQuery({
    queryKey: ['active-backups', domain],
    queryFn: async () => {
      const { data } = await apiClient.get<Array<{ backup_id: string; status: string; message: string; progress: number; type: string; backup_folder?: string }>>(`/api/site/${domain}/backups/active`);
      return data;
    },
    enabled: !!domain,
    refetchInterval: 2000, // Poll every 2 seconds for active backups
  });
};

export const useRestoreBackup = (domain: string) => {
  return useMutation({
    mutationFn: async ({ filename, type }: { filename: string; type: 'database' | 'files' }) => {
      const endpoint = type === 'database'
        ? API_ENDPOINTS.SITES.DATABASE_RESTORE(domain)
        : API_ENDPOINTS.SITES.FILE_RESTORE(domain);
      const { data } = await apiClient.post(endpoint, { filename });
      return data;
    },
  });
};

export const useDeleteBackup = (domain: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ folder }: { folder: string }) => {
      await apiClient.delete(`/api/site/${domain}/backups/${folder}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backups', domain] });
    },
  });
};

export const useBackupSettings = (domain: string) => {
  const queryClient = useQueryClient();
  
  const query = useQuery({
    queryKey: ['backup-settings', domain],
    queryFn: async () => {
      const { data } = await apiClient.get<BackupSettings>(API_ENDPOINTS.SITES.BACKUP_SETTINGS(domain));
      return data;
    },
    enabled: !!domain,
  });

  const mutation = useMutation({
    mutationFn: async (settings: BackupSettings) => {
      const { data } = await apiClient.post(API_ENDPOINTS.SITES.BACKUP_SETTINGS(domain), settings);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backup-settings', domain] });
    },
  });

  return { ...query, saveSettings: mutation };
};

