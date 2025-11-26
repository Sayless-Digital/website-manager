import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { API_ENDPOINTS } from '@/lib/api/endpoints';

export interface BackupFile {
  name: string;
  size: number;
  date: string;
  path: string;
  type: 'database' | 'files';
}

export interface BackupSettings {
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'monthly';
  retention: number; // number of backups to keep
  include_files: boolean;
  include_db: boolean;
  time: string; // HH:MM format
}

export const useBackups = (domain: string, type: 'database' | 'files') => {
  return useQuery({
    queryKey: ['backups', domain, type],
    queryFn: async () => {
      const endpoint = type === 'database' 
        ? API_ENDPOINTS.SITES.DATABASE_BACKUPS(domain)
        : API_ENDPOINTS.SITES.FILE_BACKUPS(domain);
      const { data } = await apiClient.get<BackupFile[]>(endpoint);
      return data;
    },
    enabled: !!domain,
  });
};

export const useCreateBackup = (domain: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (type: 'database' | 'files') => {
      const endpoint = type === 'database'
        ? API_ENDPOINTS.SITES.DATABASE_BACKUP(domain)
        : API_ENDPOINTS.SITES.FILE_BACKUP(domain);
      const { data } = await apiClient.post(endpoint);
      return data;
    },
    onSuccess: (_, type) => {
      queryClient.invalidateQueries({ queryKey: ['backups', domain, type] });
    },
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
    mutationFn: async ({ filename, type }: { filename: string; type: 'database' | 'files' }) => {
      const endpoint = type === 'database'
        ? API_ENDPOINTS.SITES.DATABASE_BACKUPS(domain) + `/${filename}`
        : API_ENDPOINTS.SITES.FILE_BACKUPS(domain) + `/${filename}`;
      await apiClient.delete(endpoint);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['backups', domain, variables.type] });
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

