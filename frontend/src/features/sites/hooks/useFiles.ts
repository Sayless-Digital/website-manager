import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { API_ENDPOINTS } from '@/lib/api/endpoints';

export interface FileInfo {
  name: string;
  path: string;
  type: 'file' | 'dir';
  size: number;
  permissions: string;
  modified: string;
  mime_type?: string;
}

export interface FileContent {
  content: string;
  encoding?: string;
  path?: string;
  size?: number;
}

export const useFiles = (domain: string, path: string = '/') => {
  return useQuery({
    queryKey: ['files', domain, path],
    queryFn: async () => {
      const { data } = await apiClient.get<{ path: string; files: FileInfo[] }>(API_ENDPOINTS.SITES.FILES(domain), {
        params: { path }
      });
      // Transform backend format to match our interface
      return data.files.map(file => ({
        ...file,
        type: file.type === 'directory' ? 'dir' : 'file' as 'file' | 'dir'
      }));
    },
    enabled: !!domain,
  });
};

export const useFileContent = (domain: string) => {
  return useMutation({
    mutationFn: async (path: string) => {
      const { data } = await apiClient.get<FileContent>(API_ENDPOINTS.SITES.FILES_READ(domain), {
        params: { path }
      });
      return data;
    },
  });
};

export const useSaveFile = (domain: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ path, content }: { path: string; content: string }) => {
      const { data } = await apiClient.post(API_ENDPOINTS.SITES.FILES_WRITE(domain), {
        path,
        content
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files', domain] });
    },
  });
};

export const useCreateFolder = (domain: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ path, name }: { path: string; name: string }) => {
      // Create folder by writing a .gitkeep file (backend will create parent dirs)
      const folderPath = path === '/' ? name : `${path}/${name}`;
      const { data } = await apiClient.post(API_ENDPOINTS.SITES.FILES_WRITE(domain), {
        path: `${folderPath}/.gitkeep`,
        content: ''
      });
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['files', domain, variables.path] });
    },
  });
};

export const useDeleteFile = (domain: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (path: string) => {
      const { data } = await apiClient.post(API_ENDPOINTS.SITES.FILES_DELETE(domain), {
        path
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files', domain] });
    },
  });
};

export const useUploadFile = (domain: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ path, file }: { path: string; file: File }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('path', path);
      
      const { data } = await apiClient.post(API_ENDPOINTS.SITES.FILES_UPLOAD(domain), formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['files', domain, variables.path] });
    },
  });
};

export const useDownloadFile = () => {
  return useMutation({
    mutationFn: async ({ domain, path }: { domain: string; path: string }) => {
      const response = await apiClient.get(API_ENDPOINTS.SITES.FILES_DOWNLOAD(domain), {
        params: { path },
        responseType: 'blob',
      });
      
      // Create blob link to download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const fileName = path.split('/').pop() || 'download';
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    },
  });
};
