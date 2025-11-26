import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { API_ENDPOINTS } from '@/lib/api/endpoints';

export interface CloudflareZone {
  id: string;
  name: string;
  status: string;
  plan: string;
  development_mode: number;
  name_servers: string[];
  created_on: string;
  modified_on: string;
}

export interface CloudflareDNSRecord {
  id: string;
  type: string;
  name: string;
  content: string;
  ttl: number;
  proxied: boolean;
  priority?: number;
  comment?: string;
  created_on?: string;
  modified_on?: string;
}

export interface CloudflareConfig {
  configured: boolean;
  email?: string;
  has_token?: boolean;
  has_api_key?: boolean;
}

export const useCloudflareConfig = () => {
  return useQuery({
    queryKey: ['cloudflare', 'config'],
    queryFn: async () => {
      const { data } = await apiClient.get<CloudflareConfig>(API_ENDPOINTS.CLOUDFLARE.CONFIG);
      return data;
    },
  });
};

export const useSetCloudflareConfig = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (config: { api_token?: string; global_api_key?: string; email?: string }) => {
      const { data } = await apiClient.post(API_ENDPOINTS.CLOUDFLARE.CONFIG, config);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cloudflare'] });
    },
  });
};

export const useCloudflareZones = () => {
  const { data: config } = useCloudflareConfig();
  
  return useQuery({
    queryKey: ['cloudflare', 'zones'],
    queryFn: async () => {
      const { data } = await apiClient.get<CloudflareZone[]>(API_ENDPOINTS.CLOUDFLARE.ZONES);
      return data;
    },
    enabled: !!config?.configured && (!!config?.has_token || !!config?.has_api_key),
    refetchOnMount: true,
  });
};

export const useCreateCloudflareZone = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (zoneData: { name: string; type?: string; account_id?: string }) => {
      const { data } = await apiClient.post(API_ENDPOINTS.CLOUDFLARE.CREATE_ZONE, zoneData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cloudflare', 'zones'] });
    },
  });
};

export const useCloudflareDNSRecords = (zoneId: string) => {
  return useQuery({
    queryKey: ['cloudflare', 'zones', zoneId, 'dns'],
    queryFn: async () => {
      const { data } = await apiClient.get<CloudflareDNSRecord[]>(
        API_ENDPOINTS.CLOUDFLARE.DNS_RECORDS(zoneId)
      );
      return data;
    },
    enabled: !!zoneId,
  });
};

export const useCreateDNSRecord = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ zoneId, record }: { zoneId: string; record: Partial<CloudflareDNSRecord> }) => {
      const { data } = await apiClient.post(
        API_ENDPOINTS.CLOUDFLARE.DNS_RECORDS(zoneId),
        record
      );
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['cloudflare', 'zones', variables.zoneId, 'dns'] });
    },
  });
};

export const useUpdateDNSRecord = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ zoneId, recordId, record }: { zoneId: string; recordId: string; record: Partial<CloudflareDNSRecord> }) => {
      const { data } = await apiClient.put(
        API_ENDPOINTS.CLOUDFLARE.DNS_RECORD(zoneId, recordId),
        record
      );
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['cloudflare', 'zones', variables.zoneId, 'dns'] });
    },
  });
};

export const useDeleteDNSRecord = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ zoneId, recordId }: { zoneId: string; recordId: string }) => {
      const { data } = await apiClient.delete(
        API_ENDPOINTS.CLOUDFLARE.DNS_RECORD(zoneId, recordId)
      );
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['cloudflare', 'zones', variables.zoneId, 'dns'] });
    },
  });
};

export interface EmailRoutingStatus {
  enabled: boolean;
  tag?: string;
  name?: string;
  status?: string;
}

export interface EmailAddress {
  tag: string;
  email: string;
  verified: boolean;
  created: string;
  modified: string;
  destination?: string;
}

export const useEmailRoutingStatus = (zoneId: string) => {
  return useQuery({
    queryKey: ['cloudflare', 'zones', zoneId, 'email', 'routing'],
    queryFn: async () => {
      const { data } = await apiClient.get<EmailRoutingStatus>(
        API_ENDPOINTS.CLOUDFLARE.EMAIL_ROUTING(zoneId)
      );
      return data;
    },
    enabled: !!zoneId,
  });
};

export const useEnableEmailRouting = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (zoneId: string) => {
      const { data } = await apiClient.post(API_ENDPOINTS.CLOUDFLARE.EMAIL_ROUTING(zoneId));
      return data;
    },
    onSuccess: (_, zoneId) => {
      queryClient.invalidateQueries({ queryKey: ['cloudflare', 'zones', zoneId, 'email'] });
    },
  });
};

export const useEmailAddresses = (zoneId: string) => {
  return useQuery({
    queryKey: ['cloudflare', 'zones', zoneId, 'email', 'addresses'],
    queryFn: async () => {
      const { data } = await apiClient.get<EmailAddress[]>(
        API_ENDPOINTS.CLOUDFLARE.EMAIL_ADDRESSES(zoneId)
      );
      return data;
    },
    enabled: !!zoneId,
  });
};

export const useCreateEmailAddress = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ zoneId, email, destination }: { zoneId: string; email: string; destination: string }) => {
      const { data } = await apiClient.post(
        API_ENDPOINTS.CLOUDFLARE.EMAIL_ADDRESSES(zoneId),
        { email, destination }
      );
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['cloudflare', 'zones', variables.zoneId, 'email'] });
    },
  });
};

export const useUpdateEmailAddress = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ zoneId, tag, email, destination }: { zoneId: string; tag: string; email: string; destination: string }) => {
      const { data } = await apiClient.put(
        API_ENDPOINTS.CLOUDFLARE.EMAIL_ADDRESS(zoneId, tag),
        { email, destination }
      );
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['cloudflare', 'zones', variables.zoneId, 'email'] });
    },
  });
};

export const useDeleteEmailAddress = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ zoneId, tag }: { zoneId: string; tag: string }) => {
      const { data } = await apiClient.delete(
        API_ENDPOINTS.CLOUDFLARE.EMAIL_ADDRESS(zoneId, tag)
      );
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['cloudflare', 'zones', variables.zoneId, 'email'] });
    },
  });
};

