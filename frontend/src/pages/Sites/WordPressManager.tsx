import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, ExternalLink, Globe, Check, AlertTriangle, RefreshCw, Server, XCircle } from 'lucide-react';
import { useWordPressInfo, useChangeDomain, useCheckDNS } from '@/features/sites/hooks/useWordPress';
import { showNotification } from '@/lib/notifications';
import { useState } from 'react';

export default function WordPressManager() {
  const { domain } = useParams<{ domain: string }>();
  const [newDomain, setNewDomain] = useState('');

  // Hooks
  const { data: wpInfo, isLoading: wpLoading } = useWordPressInfo(domain!);
  const { data: dnsStatus, refetch: checkDNS, isLoading: dnsLoading } = useCheckDNS(domain!);
  const changeDomainMutation = useChangeDomain(domain!);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to={`/sites/${domain}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">WordPress Manager</h1>
            <span className="text-muted-foreground px-2 py-1 bg-muted rounded text-sm">{domain}</span>
          </div>
        </div>
        <a href={`https://${domain}`} target="_blank" rel="noopener noreferrer">
          <Button variant="outline">
            <ExternalLink className="h-4 w-4 mr-2" />
            Visit Site
          </Button>
        </a>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Site Information */}
        <Card>
          <CardHeader>
            <CardTitle>Site Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="text-sm font-medium text-muted-foreground">Version</span>
                <p>{wpInfo?.version || 'Unknown'}</p>
              </div>
              <div className="space-y-1">
                <span className="text-sm font-medium text-muted-foreground">Site URL</span>
                <p className="truncate" title={wpInfo?.site_url}>{wpInfo?.site_url || 'Unknown'}</p>
              </div>
              <div className="space-y-1">
                <span className="text-sm font-medium text-muted-foreground">Admin Email</span>
                <p className="truncate" title={wpInfo?.admin_email}>{wpInfo?.admin_email || 'Unknown'}</p>
              </div>
              <div className="space-y-1">
                <span className="text-sm font-medium text-muted-foreground">Debug Mode</span>
                <div className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${wpInfo?.debug_mode ? 'bg-yellow-500' : 'bg-green-500'}`} />
                  <span>{wpInfo?.debug_mode ? 'Enabled' : 'Disabled'}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Change Domain */}
        <Card>
          <CardHeader>
            <CardTitle>Change Domain</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm text-blue-800">
              <p>This tool will:</p>
              <ul className="list-disc list-inside ml-1 mt-1 space-y-0.5">
                <li>Update <code>WP_HOME</code> and <code>WP_SITEURL</code></li>
                <li>Search & Replace URLs in the database</li>
                <li>Rename Apache configuration files</li>
                <li>Attempt to update Cloudflare DNS & Tunnel config</li>
              </ul>
            </div>
            
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
          </CardContent>
        </Card>

        {/* DNS & Connection Diagnostics */}
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Connection Diagnostics</CardTitle>
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
    </div>
  );
}
