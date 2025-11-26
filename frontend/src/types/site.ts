export interface DatabaseInfo {
  name: string;
  size_mb?: number;
  table_count?: number;
}

export interface Site {
  domain: string;
  path: string;
  public_html: string;
  apache_config: string | null;
  apache_enabled: boolean;
  db_name: string | null;
  db_user: string | null;
  db_host: string;
  error_log: string;
  access_log: string;
  size_mb: number;
  
  // Enhanced fields (may be added by frontend)
  status?: 'active' | 'inactive';
  disk_usage?: number; // in bytes
  databases?: DatabaseInfo[];
  wordpress_detected?: boolean;
  wordpress_version?: string | null;
}

export interface SiteStatus {
  domain: string;
  apache_enabled: boolean;
  local_accessible: boolean;
  public_accessible: boolean;
  path: string;
}

export interface WordPressInfo {
  version?: string;
  home_url?: string;
  site_url?: string;
  plugin_count?: number;
  theme_count?: number;
}

export interface FileItem {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size: number;
  size_human: string;
  modified: string;
  permissions: string;
}