import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { API_ENDPOINTS } from '@/lib/api/endpoints';

export interface EmailServerConfig {
  configured: boolean;
  hostname?: string;
  domain?: string;
  relayhost?: string;
  relay_username?: string;
  has_relay_password?: boolean;
  from_email?: string;
}

export interface EmailUser {
  username: string;
  domain: string;
  full_email: string;
}

export interface SendEmailRequest {
  to: string;
  from: string;
  from_name?: string;
  subject: string;
  body: string;
  html_body?: string;
}

export interface SendEmailResponse {
  success: boolean;
  message: string;
}

export const useEmailConfig = () => {
  return useQuery({
    queryKey: ['email', 'config'],
    queryFn: async () => {
      const { data } = await apiClient.get<EmailServerConfig>(API_ENDPOINTS.EMAIL.CONFIG);
      return data;
    },
  });
};

export const useSetEmailConfig = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (config: { hostname: string; domain: string; relay_host?: string; relay_username?: string; relay_password?: string; from_email?: string }) => {
      const { data } = await apiClient.post(API_ENDPOINTS.EMAIL.CONFIG, config);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email'] });
    },
  });
};

export const useEmailUsers = () => {
  return useQuery({
    queryKey: ['email', 'users'],
    queryFn: async () => {
      const { data } = await apiClient.get<EmailUser[]>(API_ENDPOINTS.EMAIL.USERS);
      return data;
    },
  });
};

export const useCreateEmailUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userData: { username: string; domain: string; password: string }) => {
      const { data } = await apiClient.post(API_ENDPOINTS.EMAIL.USERS, userData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email', 'users'] });
    },
  });
};

export const useSendEmail = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (emailData: SendEmailRequest) => {
      const { data } = await apiClient.post<SendEmailResponse>(
        API_ENDPOINTS.EMAIL.SEND,
        emailData
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email'] });
    },
  });
};

