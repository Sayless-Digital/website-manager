import { apiClient } from './client';
import { API_ENDPOINTS } from './endpoints';

export const fileOperations = {
  // Delete a file or folder
  deleteFile: async (domain: string, path: string) => {
    const response = await apiClient.post(
      API_ENDPOINTS.SITES.FILES_DELETE(domain),
      { path }
    );
    return response.data;
  },

  // Download a file
  downloadFile: (domain: string, path: string) => {
    const url = `${API_ENDPOINTS.SITES.FILES_DOWNLOAD(domain)}?path=${encodeURIComponent(path)}`;
    window.open(url, '_blank');
  },

  // Upload files
  uploadFiles: async (domain: string, files: File[], path: string = '') => {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('file', file);
    });
    if (path) {
      formData.append('path', path);
    }

    const response = await apiClient.post(
      API_ENDPOINTS.SITES.FILES_UPLOAD(domain),
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  },

  // Read file content
  readFile: async (domain: string, path: string) => {
    const response = await apiClient.get(
      `${API_ENDPOINTS.SITES.FILES_READ(domain)}?path=${encodeURIComponent(path)}`
    );
    return response.data;
  },

  // Write file content
  writeFile: async (domain: string, path: string, content: string) => {
    const response = await apiClient.post(
      API_ENDPOINTS.SITES.FILES_WRITE(domain),
      { path, content }
    );
    return response.data;
  },

  // Create a new folder
  createFolder: async (domain: string, folderPath: string) => {
    // We'll use writeFile to create a placeholder file then delete it
    // Or we can just call mkdir via a new endpoint if available
    // For now, let's assume the backend will handle this
    const response = await apiClient.post(
      API_ENDPOINTS.SITES.FILES_WRITE(domain),
      { path: `${folderPath}/.gitkeep`, content: '' }
    );
    return response.data;
  },
};