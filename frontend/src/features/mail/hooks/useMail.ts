import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { API_ENDPOINTS } from '@/lib/api/endpoints';

export interface MailDomain {
  id: number;
  name: string;
  display_name?: string;
  description?: string;
  active: boolean;
  inbound_enabled: boolean;
  outbound_enabled: boolean;
  mx_hostname?: string;
  mailbox_count?: number;
  alias_count?: number;
  managed_by_cloudflare?: boolean;
  auto_dns_enabled?: boolean;
}

export interface Mailbox {
  id: number;
  domain_id: number;
  email: string;
  local_part: string;
  quota_mb: number;
  forwarding_enabled: boolean;
  forwarding_address?: string;
  active: boolean;
}

export interface MailAliasDestination {
  id: number;
  destination: string;
  destination_type: string;
  priority: number;
}

export interface MailAlias {
  id: number;
  domain_id: number;
  email: string;
  local_part: string;
  enabled: boolean;
  description?: string;
  destinations: MailAliasDestination[];
}

export interface MailMessageSummary {
  id: string;
  subject?: string;
  from?: string;
  to?: string;
  date?: number;
  snippet?: string;
}

export interface MailMessageDetail {
  subject?: string;
  from?: string;
  to?: string;
  parts?: { type: string; content: string }[];
}

export interface MailConfigPreview {
  alias_map: string;
  mailbox_map: string;
  dovecot_users: string;
  stats: {
    mailboxes: number;
    aliases: number;
    destinations: number;
  };
}

export interface MailDnsRecords {
  mx: { type: string; name: string; value: string; ttl: number }[];
  spf: { type: string; name: string; value: string };
  dmarc: { type: string; name: string; value: string };
  dkim?: { type: string; name: string; value: string };
}

// Domains
export const useMailDomains = () => {
  return useQuery({
    queryKey: ['mail', 'domains'],
    queryFn: async () => {
      const { data } = await apiClient.get<MailDomain[]>(API_ENDPOINTS.MAIL.DOMAINS);
      return data;
    },
  });
};

export const useCreateMailDomain = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<MailDomain> & { name: string }) => {
      const { data } = await apiClient.post(API_ENDPOINTS.MAIL.DOMAINS, payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mail', 'domains'] });
    },
  });
};

export const useUpdateMailDomain = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: number } & Partial<MailDomain>) => {
      const { data } = await apiClient.put(API_ENDPOINTS.MAIL.DOMAIN(id), payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mail', 'domains'] });
    },
  });
};

export const useDeleteMailDomain = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await apiClient.delete(API_ENDPOINTS.MAIL.DOMAIN(id));
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mail', 'domains'] });
    },
  });
};

// Mailboxes
export const useMailboxes = (domainId?: number) => {
  return useQuery({
    queryKey: ['mail', 'mailboxes', domainId ?? 'all'],
    queryFn: async () => {
      const { data } = await apiClient.get<Mailbox[]>(API_ENDPOINTS.MAIL.MAILBOXES, {
        params: domainId ? { domain_id: domainId } : undefined,
      });
      return data;
    },
  });
};

export const useMailboxMessages = (mailboxId?: number, limit = 20) => {
  return useQuery({
    queryKey: ['mail', 'mailboxes', mailboxId, 'messages'],
    queryFn: async () => {
      if (!mailboxId) return [];
      const { data } = await apiClient.get<MailMessageSummary[]>(
        API_ENDPOINTS.MAIL.MAILBOX_MESSAGES(mailboxId),
        { params: { limit } }
      );
      return data;
    },
    enabled: !!mailboxId,
  });
};

export const useMailboxMessage = (mailboxId?: number, messageId?: string) => {
  return useQuery({
    queryKey: ['mail', 'mailboxes', mailboxId, 'messages', messageId],
    queryFn: async () => {
      if (!mailboxId || !messageId) return null;
      const { data } = await apiClient.get<MailMessageDetail>(
        API_ENDPOINTS.MAIL.MAILBOX_MESSAGES(mailboxId, messageId)
      );
      return data;
    },
    enabled: !!mailboxId && !!messageId,
  });
};

export const useCreateMailbox = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { domain_id: number; local_part: string; password: string; quota_mb?: number }) => {
      const { data } = await apiClient.post(API_ENDPOINTS.MAIL.MAILBOXES, payload);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['mail', 'mailboxes', variables.domain_id] });
    },
  });
};

export const useDeleteMailbox = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (mailboxId: number) => {
      const { data } = await apiClient.delete(API_ENDPOINTS.MAIL.MAILBOX(mailboxId));
      return data;
    },
    onSuccess: (_, mailboxId) => {
      queryClient.invalidateQueries({ queryKey: ['mail', 'mailboxes'] });
    },
  });
};

// Aliases
export const useMailAliases = (domainId?: number) => {
  return useQuery({
    queryKey: ['mail', 'aliases', domainId ?? 'all'],
    queryFn: async () => {
      const { data } = await apiClient.get<MailAlias[]>(API_ENDPOINTS.MAIL.ALIASES, {
        params: domainId ? { domain_id: domainId } : undefined,
      });
      return data;
    },
  });
};

export const useCreateMailAlias = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { domain_id: number; local_part: string; destinations: (string | Record<string, unknown>)[] }) => {
      const { data } = await apiClient.post(API_ENDPOINTS.MAIL.ALIASES, payload);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['mail', 'aliases', variables.domain_id] });
    },
  });
};

export const useDeleteMailAlias = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (aliasId: number) => {
      const { data } = await apiClient.delete(API_ENDPOINTS.MAIL.ALIAS(aliasId));
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mail', 'aliases'] });
    },
  });
};

// Config helpers
export const useMailConfigs = () => {
  return useQuery({
    queryKey: ['mail', 'configs'],
    queryFn: async () => {
      const { data } = await apiClient.get<MailConfigPreview>(API_ENDPOINTS.MAIL.CONFIGS);
      return data;
    },
  });
};

export const useSyncMailConfigs = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload?: { dry_run?: boolean }) => {
      const { data } = await apiClient.post(API_ENDPOINTS.MAIL.SYNC_CONFIGS, payload || {});
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mail', 'configs'] });
    },
  });
};

export const useMailDomainDns = (domainId?: number) => {
  return useQuery({
    queryKey: ['mail', 'dns', domainId],
    queryFn: async () => {
      if (!domainId) return null;
      const { data } = await apiClient.get<MailDnsRecords>(API_ENDPOINTS.MAIL.DOMAIN_DNS(domainId));
      return data;
    },
    enabled: !!domainId,
  });
};

