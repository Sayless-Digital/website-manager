import { useEffect, useId, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Cpu, HardDrive, Activity, Server } from 'lucide-react';
import { useSystemResources, useSystemInfo } from '@/features/system/hooks/useSystem';
import { formatBytes } from '@/lib/utils/format';

const HISTORY_LENGTH = 24;

function MiniSparkline({ data, color }: { data: number[]; color?: string }) {
  const gradientId = useId();
  const fallbackData = data.length >= 2 ? data : [...data, data.at(-1) ?? 0];
  const width = 140;
  const height = 48;
  
  // Find min and max for dynamic scaling
  const minValue = Math.min(...fallbackData);
  const maxValue = Math.max(...fallbackData);
  const range = maxValue - minValue;
  const padding = range * 0.1; // 10% padding
  
  const normalized = fallbackData.map((value) => {
    if (range === 0) return 50; // Center if all values are the same
    return ((value - minValue + padding) / (range + padding * 2)) * 100;
  });

  const points = normalized.map((value, index) => ({
    x: normalized.length === 1 ? width : (index / (normalized.length - 1)) * width,
    y: height - (value / 100) * height,
  }));

  // Create smooth curve path using cubic bezier
  const createSmoothPath = () => {
    if (points.length < 2) return '';
    
    let path = `M ${points[0].x},${points[0].y}`;
    
    for (let i = 0; i < points.length - 1; i++) {
      const current = points[i];
      const next = points[i + 1];
      const controlPointX = (current.x + next.x) / 2;
      
      path += ` C ${controlPointX},${current.y} ${controlPointX},${next.y} ${next.x},${next.y}`;
    }
    
    return path;
  };

  const smoothPath = createSmoothPath();

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-12 text-muted-foreground"
      preserveAspectRatio="none"
      role="img"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.35" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        fill="none"
        stroke="hsl(var(--muted-foreground) / 0.35)"
        strokeWidth="1"
        points={`0,${height} ${width},${height}`}
      />
      <path
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        d={smoothPath}
      />
      <path
        d={`${smoothPath} L ${width},${height} L 0,${height} Z`}
        fill={`url(#${gradientId})`}
        opacity="0.7"
      />
    </svg>
  );
}

export default function Resources() {
  const { data: resources, isLoading, error, refetch } = useSystemResources();
  const { data: systemInfo } = useSystemInfo();

  const [cpuHistory, setCpuHistory] = useState<number[]>([]);
  const [memoryHistory, setMemoryHistory] = useState<number[]>([]);
  const [diskHistory, setDiskHistory] = useState<number[]>([]);

  useEffect(() => {
    if (!resources) return;

    setCpuHistory((prev) =>
      [...prev, resources.cpu?.percent ?? 0].slice(-HISTORY_LENGTH)
    );
    setMemoryHistory((prev) =>
      [...prev, resources.memory?.percent ?? 0].slice(-HISTORY_LENGTH)
    );
    setDiskHistory((prev) =>
      [...prev, resources.disk?.percent ?? 0].slice(-HISTORY_LENGTH)
    );
  }, [resources]);

  if (isLoading) {
    return null; // Let router's Suspense handle loading
  }

  const cpuPercent = resources?.cpu?.percent ?? 0;
  const cpuCount = resources?.cpu?.count;
  const memoryUsed = resources?.memory?.used ?? 0;
  const memoryTotal = resources?.memory?.total ?? 0;
  const memoryPercent = resources?.memory?.percent ?? 0;
  const diskPercent = resources?.disk?.percent ?? 0;
  const diskUsed = resources?.disk?.used ?? 0;
  const diskTotal = resources?.disk?.total ?? 0;

  return (
    <div className="space-y-6">

      {/* Resource Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* CPU Usage */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CPU Usage</CardTitle>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-2xl font-bold">
              {cpuPercent.toFixed(1)}%
            </div>
            <MiniSparkline data={cpuHistory} />
            {cpuCount && (
              <p className="text-xs text-muted-foreground">
                {cpuCount} cores available
              </p>
            )}
          </CardContent>
        </Card>

        {/* Memory Usage */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-2xl font-bold">
              {memoryPercent.toFixed(1)}%
            </div>
            <MiniSparkline data={memoryHistory} />
            <p className="text-xs text-muted-foreground">
              {formatBytes(memoryUsed)} / {formatBytes(memoryTotal)}
            </p>
          </CardContent>
        </Card>

        {/* Disk Usage */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Disk Usage</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-2xl font-bold">
              {diskPercent.toFixed(1)}%
            </div>
            <MiniSparkline data={diskHistory} />
            <p className="text-xs text-muted-foreground">
              {formatBytes(diskUsed)} / {formatBytes(diskTotal)}
            </p>
          </CardContent>
        </Card>

        {/* System Info */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Information</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-2">
            {systemInfo && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Platform:</span>
                  <span className="font-medium">{systemInfo.platform}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Architecture:</span>
                  <span className="font-medium">{systemInfo.architecture}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Python:</span>
                  <span className="font-medium">{systemInfo.python_version}</span>
                </div>
                {systemInfo.hostname && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Hostname:</span>
                    <span className="font-medium truncate ml-2">{systemInfo.hostname}</span>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Network Stats */}
      {resources?.network && (
        <Card>
          <CardHeader>
            <CardTitle>Network Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Bytes Sent</p>
                <p className="text-lg font-medium">{formatBytes(resources.network.bytes_sent)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Bytes Received</p>
                <p className="text-lg font-medium">{formatBytes(resources.network.bytes_recv)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Packets Sent</p>
                <p className="text-lg font-medium">{resources.network.packets_sent.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Packets Received</p>
                <p className="text-lg font-medium">{resources.network.packets_recv.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
