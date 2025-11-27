export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface SystemResources {
  cpu: {
    percent: number;
    count: number;
  };
  memory: {
    total: number;
    used: number;
    available: number;
    percent: number;
    total_gb: number;
    used_gb: number;
    available_gb: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
    percent: number;
    total_gb: number;
    used_gb: number;
    free_gb: number;
  };
  network: {
    bytes_sent: number;
    bytes_recv: number;
    packets_sent: number;
    packets_recv: number;
  };
  processes: number;
}

export interface SystemInfo {
  disk_usage?: string;
  uptime?: string;
  load_average?: {
    '1min': number;
    '5min': number;
    '15min': number;
  };
}

export interface CronJob {
  schedule: string;
  command: string;
  user?: string;
  enabled: boolean;
  comment?: string;
  raw: string;
  last_run?: string;
}