import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Cloud, Globe, Settings, RefreshCw, X } from 'lucide-react';
import {
  useCloudflareConfig,
  useSetCloudflareConfig,
  useCloudflareZones,
  type CloudflareZone,
} from '@/features/cloudflare/hooks/useCloudflare';

export default function CloudflareManager() {
  const { zoneId } = useParams<{ zoneId?: string }>();
  const { data: config, refetch: refetchConfig } = useCloudflareConfig();
  const setConfig = useSetCloudflareConfig();
  const { data: zones, refetch: refetchZones, isLoading: zonesLoading } = useCloudflareZones();
  const [selectedZone, setSelectedZone] = useState<CloudflareZone | null>(null);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [configForm, setConfigForm] = useState({ api_token: '', global_api_key: '', email: '' });
  const [authMethod, setAuthMethod] = useState<'token' | 'api_key'>('token');

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const configData = authMethod === 'token' 
        ? { api_token: configForm.api_token, email: configForm.email }
        : { global_api_key: configForm.global_api_key, email: configForm.email };
      await setConfig.mutateAsync(configData);
      showNotification('success', 'Cloudflare API credentials saved');
      setShowConfigDialog(false);
      refetchConfig();
    } catch (error: any) {
      showNotification('error', error.response?.data?.error || 'Failed to save configuration');
    }
  };

  if (config && !config.configured) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-4">
              <Cloud className="h-5 w-5" />
              <h3 className="font-semibold text-lg">Cloudflare Configuration</h3>
            </div>
            <p className="text-muted-foreground mb-4">
              To manage Cloudflare domains, you need to configure your API credentials.
            </p>
            <form onSubmit={handleSaveConfig} className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Authentication Method</label>
                <div className="flex gap-4 mb-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="authMethod"
                      value="token"
                      checked={authMethod === 'token'}
                      onChange={(e) => setAuthMethod(e.target.value as 'token')}
                      className="w-4 h-4"
                    />
                    <span>API Token</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="authMethod"
                      value="api_key"
                      checked={authMethod === 'api_key'}
                      onChange={(e) => setAuthMethod(e.target.value as 'api_key')}
                      className="w-4 h-4"
                    />
                    <span>API Key (Recommended for Email Routing)</span>
                  </label>
                </div>
              </div>
              
              {authMethod === 'token' ? (
                <>
                  <div>
                    <label className="text-sm font-medium mb-2 block">API Token</label>
                    <Input
                      type="password"
                      placeholder="Your Cloudflare API token"
                      value={configForm.api_token}
                      onChange={(e) => setConfigForm({ ...configForm, api_token: e.target.value })}
                      className="bg-white"
                      required
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Create a token at: <a href="https://dash.cloudflare.com/profile/api-tokens" target="_blank" rel="noopener noreferrer" className="text-primary underline">Cloudflare Dashboard</a>
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Email (optional)</label>
                    <Input
                      type="email"
                      placeholder="your@email.com"
                      value={configForm.email}
                      onChange={(e) => setConfigForm({ ...configForm, email: e.target.value })}
                      className="bg-white"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Email</label>
                    <Input
                      type="email"
                      placeholder="your@email.com"
                      value={configForm.email}
                      onChange={(e) => setConfigForm({ ...configForm, email: e.target.value })}
                      className="bg-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Global API Key</label>
                    <Input
                      type="password"
                      placeholder="Your Cloudflare Global API Key"
                      value={configForm.global_api_key}
                      onChange={(e) => setConfigForm({ ...configForm, global_api_key: e.target.value })}
                      className="bg-white"
                      required
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Find your Global API Key at: <a href="https://dash.cloudflare.com/profile/api-tokens" target="_blank" rel="noopener noreferrer" className="text-primary underline">Cloudflare Dashboard</a>
                    </p>
                  </div>
                </>
              )}
              
              <Button type="submit" disabled={setConfig.isPending}>
                {setConfig.isPending ? 'Saving...' : 'Save Configuration'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {notification && (
        <div className={`p-4 rounded-lg border ${
          notification.type === 'success' 
            ? 'bg-green-50 border-green-200 text-green-800' 
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {notification.message}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Cloud className="h-5 w-5" />
          <h1 className="text-2xl font-bold">Cloudflare</h1>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowConfigDialog(true)}
        >
          <Settings className="h-4 w-4 mr-2" />
          Settings
        </Button>
      </div>

      {zonesLoading ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <RefreshCw className="h-12 w-12 mx-auto mb-4 text-muted-foreground animate-spin" />
              <p className="text-muted-foreground">Loading zones...</p>
            </div>
          </CardContent>
        </Card>
      ) : zones && zones.length > 0 ? (
        <div className="grid gap-4">
          {zones.map((zone) => (
            <Card key={zone.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  {zone.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <p><span className="font-medium">Status:</span> {zone.status}</p>
                  <p><span className="font-medium">Plan:</span> {zone.plan}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Globe className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">No zones found</p>
              <Button onClick={() => refetchZones()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Load Zones
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {showConfigDialog && (
        <Card className="border-primary bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">Cloudflare Configuration</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowConfigDialog(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <form onSubmit={handleSaveConfig} className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Authentication Method</label>
                <div className="flex gap-4 mb-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="authMethod"
                      value="token"
                      checked={authMethod === 'token'}
                      onChange={(e) => setAuthMethod(e.target.value as 'token')}
                      className="w-4 h-4"
                    />
                    <span>API Token</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="authMethod"
                      value="api_key"
                      checked={authMethod === 'api_key'}
                      onChange={(e) => setAuthMethod(e.target.value as 'api_key')}
                      className="w-4 h-4"
                    />
                    <span>API Key</span>
                  </label>
                </div>
              </div>
              
              {authMethod === 'token' ? (
                <>
                  <div>
                    <label className="text-sm font-medium mb-2 block">API Token</label>
                    <Input
                      type="password"
                      placeholder="Your Cloudflare API token"
                      value={configForm.api_token}
                      onChange={(e) => setConfigForm({ ...configForm, api_token: e.target.value })}
                      className="bg-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Email (optional)</label>
                    <Input
                      type="email"
                      placeholder="your@email.com"
                      value={configForm.email}
                      onChange={(e) => setConfigForm({ ...configForm, email: e.target.value })}
                      className="bg-white"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Email</label>
                    <Input
                      type="email"
                      placeholder="your@email.com"
                      value={configForm.email}
                      onChange={(e) => setConfigForm({ ...configForm, email: e.target.value })}
                      className="bg-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Global API Key</label>
                    <Input
                      type="password"
                      placeholder="Your Cloudflare Global API Key"
                      value={configForm.global_api_key}
                      onChange={(e) => setConfigForm({ ...configForm, global_api_key: e.target.value })}
                      className="bg-white"
                      required
                    />
                  </div>
                </>
              )}
              
              <div className="flex gap-2">
                <Button type="submit" disabled={setConfig.isPending}>
                  {setConfig.isPending ? 'Saving...' : 'Save'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowConfigDialog(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

