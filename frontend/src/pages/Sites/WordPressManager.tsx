import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Globe, Check, AlertTriangle, RefreshCw, Server, XCircle, Package, Palette, Power, Layers, Search } from 'lucide-react';
import { useWordPressInfo, useChangeDomain, useCheckDNS, useWordPressPlugins, useWordPressThemes, type WordPressPlugin, type WordPressTheme } from '@/features/sites/hooks/useWordPress';
import { showNotification } from '@/lib/notifications';
import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils/cn';

export default function WordPressManager() {
  const { domain } = useParams<{ domain: string }>();
  const [newDomain, setNewDomain] = useState('');
  const [activeTab, setActiveTab] = useState('domain');
  const [pluginSearch, setPluginSearch] = useState('');
  const [themeSearch, setThemeSearch] = useState('');

  // Hooks
  const { data: wpInfo } = useWordPressInfo(domain!);
  const { data: dnsStatus, refetch: checkDNS, isLoading: dnsLoading } = useCheckDNS(domain!);
  const changeDomainMutation = useChangeDomain(domain!);
  const { data: plugins, isLoading: pluginsLoading, togglePlugin, refetch: refetchPlugins } = useWordPressPlugins(domain!);
  const { data: themes, isLoading: themesLoading, activateTheme, refetch: refetchThemes } = useWordPressThemes(domain!);

  // Filter plugins and themes
  const filteredPlugins = useMemo(() => {
    if (!plugins) return [];
    if (!pluginSearch) return plugins;
    const search = pluginSearch.toLowerCase();
    return plugins.filter((p: WordPressPlugin) => 
      (p.name?.toLowerCase().includes(search)) ||
      (p.title?.toLowerCase().includes(search))
    );
  }, [plugins, pluginSearch]);

  const filteredThemes = useMemo(() => {
    if (!themes) return [];
    if (!themeSearch) return themes;
    const search = themeSearch.toLowerCase();
    return themes.filter(t => 
      (t.name?.toLowerCase().includes(search)) ||
      (t.title?.toLowerCase().includes(search))
    );
  }, [themes, themeSearch]);

  const handleChangeDomain = () => {
    if (!newDomain) return;

    if (confirm(`Are you sure you want to change the domain to ${newDomain}? This will update the database and configuration files.`)) {
      changeDomainMutation.mutate(newDomain, {
        onSuccess: () => {
          showNotification('success', 'Domain changed successfully');
          setNewDomain('');
        },
        onError: (error: any) => {
          showNotification('error', error.response?.data?.error || 'Failed to change domain');
        }
      });
    }
  };

  const handleRefresh = () => {
    refetchPlugins();
    refetchThemes();
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col gap-6 min-h-0">
      {/* Overview Cards */}
      <div className="grid grid-cols-4 gap-4 flex-shrink-0">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Layers className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Version</p>
                <p className="text-lg font-semibold">{wpInfo?.version || 'Unknown'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Palette className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Themes</p>
                <p className="text-lg font-semibold">{themes?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Package className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Plugins</p>
                <p className="text-lg font-semibold">{plugins?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Globe className="h-5 w-5 text-green-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">Site URL</p>
                <p className="text-lg font-semibold truncate" title={wpInfo?.site_url}>{wpInfo?.site_url?.replace('https://', '') || 'Unknown'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tab Bar */}
      <div className="flex items-center gap-4 flex-shrink-0">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('domain')}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg transition-colors",
              activeTab === 'domain' 
                ? "bg-amber-50 border-amber-200 text-foreground" 
                : "bg-background border-border hover:bg-muted/50"
            )}
          >
            <Globe className="h-3.5 w-3.5" />
            <span>Domain</span>
          </button>
          <button
            onClick={() => setActiveTab('themes')}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg transition-colors",
              activeTab === 'themes' 
                ? "bg-amber-50 border-amber-200 text-foreground" 
                : "bg-background border-border hover:bg-muted/50"
            )}
          >
            <Palette className="h-3.5 w-3.5" />
            <span>Themes</span>
          </button>
          <button
            onClick={() => setActiveTab('plugins')}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg transition-colors",
              activeTab === 'plugins' 
                ? "bg-amber-50 border-amber-200 text-foreground" 
                : "bg-background border-border hover:bg-muted/50"
            )}
          >
            <Package className="h-3.5 w-3.5" />
            <span>Plugins</span>
          </button>
        </div>
        {(activeTab === 'plugins' || activeTab === 'themes') && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={activeTab === 'plugins' ? "Search plugins..." : "Search themes..."}
              value={activeTab === 'plugins' ? pluginSearch : themeSearch}
              onChange={(e) => activeTab === 'plugins' ? setPluginSearch(e.target.value) : setThemeSearch(e.target.value)}
              className="w-64 pl-10"
            />
          </div>
        )}
        <div className="flex-1"></div>
        <Button variant="outline" size="sm" onClick={handleRefresh}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Plugins Tab */}
      {activeTab === 'plugins' && (
        <div className="border rounded-lg overflow-hidden flex-shrink-0" style={{ height: '60vh' }}>
          <div className="h-full overflow-y-auto">
            {pluginsLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                Loading plugins...
              </div>
            ) : plugins && 'error' in plugins ? (
              <div className="text-center py-8">
                <div className="text-destructive mb-2">Error loading plugins</div>
                <div className="text-sm text-muted-foreground">{String(plugins.error)}</div>
              </div>
            ) : !plugins || plugins.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No plugins found</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted text-left border-b sticky top-0 z-10">
                  <tr>
                    <th className="p-3 font-medium bg-muted">Name</th>
                    <th className="p-3 font-medium bg-muted">Version</th>
                    <th className="p-3 font-medium bg-muted">Author</th>
                    <th className="p-3 font-medium bg-muted">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredPlugins.map((plugin: WordPressPlugin) => {
                    const isActive = plugin.status === 'active';
                    return (
                      <tr key={plugin.name} className="hover:bg-muted/50">
                        <td className="p-3">
                          <div>
                            <div className="font-medium">{plugin.title || plugin.name}</div>
                            {plugin.title && plugin.title !== plugin.name && (
                              <div className="text-sm text-muted-foreground">{plugin.name}</div>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-muted-foreground">{plugin.version}</td>
                        <td className="p-3 text-muted-foreground">{plugin.author || 'Unknown'}</td>
                        <td className="p-3">
                          <Switch
                            checked={isActive}
                            onCheckedChange={(checked) => {
                              const action = checked ? 'activate' : 'deactivate';
                              togglePlugin.mutate(
                                { plugin: plugin.name, action },
                                {
                                  onSuccess: () => {
                                    showNotification('success', `Plugin ${action}d successfully`);
                                    // Immediately refetch to update UI
                                    refetchPlugins();
                                  },
                                  onError: (error: any) => {
                                    showNotification('error', error.response?.data?.error || `Failed to ${action} plugin`);
                                    // Refetch on error to restore correct state
                                    refetchPlugins();
                                  },
                                }
                              );
                            }}
                            disabled={togglePlugin.isPending}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Themes Tab */}
      {activeTab === 'themes' && (
        <div className="border rounded-lg overflow-hidden flex-shrink-0" style={{ height: '60vh' }}>
          <div className="h-full overflow-y-auto">
            {themesLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                Loading themes...
              </div>
            ) : !themes || themes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No themes found</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted text-left border-b sticky top-0 z-10">
                  <tr>
                    <th className="p-3 font-medium bg-muted">Name</th>
                    <th className="p-3 font-medium bg-muted">Version</th>
                    <th className="p-3 font-medium bg-muted">Author</th>
                    <th className="p-3 font-medium bg-muted">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredThemes.map((theme: WordPressTheme) => {
                    const isActive = theme.status === 'active';
                    return (
                      <tr key={theme.name} className="hover:bg-muted/50">
                        <td className="p-3">
                          <div>
                            <div className="font-medium">{theme.title || theme.name}</div>
                            {theme.title && theme.title !== theme.name && (
                              <div className="text-sm text-muted-foreground">{theme.name}</div>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-muted-foreground">{theme.version}</td>
                        <td className="p-3 text-muted-foreground">{theme.author || 'Unknown'}</td>
                        <td className="p-3">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (!isActive) {
                                activateTheme.mutate(theme.name, {
                                  onSuccess: () => {
                                    showNotification('success', `Theme "${theme.title || theme.name}" activated successfully`);
                                  },
                                  onError: (error: any) => {
                                    showNotification('error', error.response?.data?.error || 'Failed to activate theme');
                                  },
                                });
                              }
                            }}
                            disabled={isActive || activateTheme.isPending}
                          >
                            <Power className="h-4 w-4 mr-2" />
                            Activate
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Domain Tab */}
      {activeTab === 'domain' && (
          <div className="grid gap-6 md:grid-cols-2 flex-1 min-h-0 overflow-auto">
            {/* Change Domain */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-primary" />
                  Change Domain
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm text-blue-800">
                  <p className="font-semibold mb-2">This tool will:</p>
                  <ul className="list-disc list-inside ml-1 space-y-0.5">
                    <li>Update <code className="bg-blue-100 px-1 rounded">WP_HOME</code> and <code className="bg-blue-100 px-1 rounded">WP_SITEURL</code></li>
                    <li>Search & Replace URLs in the database</li>
                    <li>Rename Apache configuration files</li>
                    <li>Attempt to update Cloudflare DNS & Tunnel config</li>
                  </ul>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">New Domain</label>
                  <div className="flex gap-2">
                    <Input 
                      placeholder="new-domain.com" 
                      value={newDomain}
                      onChange={(e) => setNewDomain(e.target.value)}
                    />
                    <Button 
                      onClick={handleChangeDomain}
                      disabled={!newDomain || changeDomainMutation.isPending}
                    >
                      {changeDomainMutation.isPending ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : 'Update'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Current Domain Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-green-500" />
                  Current Domain
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="space-y-1">
                    <span className="text-sm font-medium text-muted-foreground">Domain</span>
                    <p className="font-mono text-lg font-semibold">{domain}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-sm font-medium text-muted-foreground">Site URL</span>
                    <p className="font-mono text-sm truncate" title={wpInfo?.site_url}>{wpInfo?.site_url || 'Unknown'}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-sm font-medium text-muted-foreground">Home URL</span>
                    <p className="font-mono text-sm truncate" title={wpInfo?.home_url}>{wpInfo?.home_url || 'Unknown'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* DNS & Connection Diagnostics */}
            <Card className="md:col-span-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Server className="h-5 w-5 text-blue-500" />
                    Connection Diagnostics
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={() => checkDNS()} disabled={dnsLoading}>
                    {dnsLoading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Globe className="h-4 w-4 mr-2" />}
                    Check Connection
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {!dnsStatus ? (
                  <div className="text-center py-6 text-muted-foreground">
                    Click "Check Connection" to verify DNS and Tunnel configuration.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* DNS Record Status */}
                    <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                      <div className="mt-1">
                        {dnsStatus.record ? (
                          <Check className="h-5 w-5 text-green-500" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-500" />
                        )}
                      </div>
                      <div className="flex-1 space-y-1">
                        <p className="font-medium">DNS Record</p>
                        {dnsStatus.record ? (
                          <div className="text-sm space-y-1">
                            <p className="text-green-600">Found {dnsStatus.record.type} record</p>
                            <p className="text-muted-foreground">Points to: <code className="bg-background px-1 rounded">{dnsStatus.record.content}</code></p>
                            
                            {/* Cloudflare Tunnel Detection Logic */}
                            {dnsStatus.record.type === 'CNAME' && 
                             dnsStatus.record.content && 
                             dnsStatus.record.content.includes('cfargotunnel.com') && (
                              <div className="mt-2 text-xs bg-blue-50 text-blue-700 p-2 rounded border border-blue-100">
                                 <p className="font-semibold flex items-center gap-1">
                                   <Server className="h-3 w-3" />
                                   Cloudflare Tunnel Detected
                                 </p>
                                 <p className="mt-1">
                                   Traffic is being routed through a Cloudflare Tunnel.
                                 </p>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm text-red-600">
                            No DNS record found for <strong>{domain}</strong> in Cloudflare.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Tunnel Configuration Status */}
                    {dnsStatus.tunnel_status && (
                      <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                        <div className="mt-1">
                          {dnsStatus.tunnel_status.ingress_found ? (
                            <Check className="h-5 w-5 text-green-500" />
                          ) : (
                            <AlertTriangle className="h-5 w-5 text-yellow-500" />
                          )}
                        </div>
                        <div className="flex-1 space-y-1">
                          <p className="font-medium">Tunnel Configuration</p>
                          {dnsStatus.tunnel_status.ingress_found ? (
                            <p className="text-sm text-green-600">
                              Ingress rule found for <strong>{domain}</strong> in local configuration.
                            </p>
                          ) : (
                            <div className="text-sm text-yellow-700 space-y-2">
                              <p>
                                No ingress rule found for <strong>{domain}</strong> in local Cloudflare Tunnel config.
                              </p>
                              <div className="bg-yellow-50 p-2 rounded border border-yellow-200 text-xs">
                                <p className="font-semibold">Suggested Fix:</p>
                                <p className="mt-1">The tunnel needs an ingress rule mapping this domain to localhost.</p>
                                <pre className="mt-2 p-2 bg-yellow-100 rounded overflow-x-auto">
{`- hostname: ${domain}
  service: http://localhost:80`}
                                </pre>
                                <p className="mt-2">
                                  Note: The "Change Domain" tool above attempts to add this automatically.
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
      )}
    </div>
  );
}
