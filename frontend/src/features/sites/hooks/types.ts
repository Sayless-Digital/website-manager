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





