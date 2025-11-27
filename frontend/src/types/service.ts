export interface Service {
  name: string;
  display_name?: string;
  description?: string;
  active: boolean;
  enabled: boolean;
  status: 'running' | 'stopped';
}

export type ServiceAction = 'start' | 'stop' | 'restart' | 'enable' | 'disable';

export interface ServiceControlResponse {
  success: boolean;
  message?: string;
  error?: string;
  status?: Service;
}