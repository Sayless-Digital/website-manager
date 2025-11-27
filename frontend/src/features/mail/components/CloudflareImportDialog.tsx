import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { showNotification } from '@/lib/notifications';
import { useMailCloudflareZones, useImportCloudflareZone } from '../hooks/useMailCloudflare';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CloudflareImportDialog({ open, onClose }: Props) {
  const { data: zones, isLoading } = useMailCloudflareZones(open);
  const importZone = useImportCloudflareZone();
  const [autoDns, setAutoDns] = useState(true);

  const handleImport = async (zoneId: string, zoneName: string) => {
    try {
      await importZone.mutateAsync({ zoneId, name: zoneName, auto_dns_enabled: autoDns });
      showNotification('success', `Imported ${zoneName}`);
      onClose();
    } catch (error: any) {
      showNotification('error', error.response?.data?.error || 'Failed to import zone');
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <Card className="w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Import from Cloudflare</CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoDns}
              onChange={(e) => setAutoDns(e.target.checked)}
              className="rounded border border-border"
            />
            Automatically manage MX/SPF/DKIM/DMARC
          </label>
          <div className="border rounded-lg max-h-64 overflow-auto">
            {isLoading ? (
              <div className="p-4 text-sm text-muted-foreground">Loading zones...</div>
            ) : zones && zones.length > 0 ? (
              <ul className="divide-y">
                {zones.map((zone) => (
                  <li key={zone.id} className="flex items-center justify-between p-3">
                    <div>
                      <p className="font-medium">{zone.name}</p>
                      <p className="text-xs text-muted-foreground">{zone.status}</p>
                    </div>
                    <Button size="sm" onClick={() => handleImport(zone.id, zone.name)}>
                      Import
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-4 text-sm text-muted-foreground">No zones found.</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

