import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Cloud, Globe, Settings, RefreshCw, X, Plus,
  FileCode, Search, Trash2, Edit2, Save, Mail
} from 'lucide-react';
import {
  useCloudflareConfig,
  useSetCloudflareConfig,
  useCloudflareZones,
  useCloudflareDNSRecords,
  useCreateDNSRecord,
  useUpdateDNSRecord,
  useDeleteDNSRecord,
  type CloudflareZone,
  type CloudflareDNSRecord,
} from '@/features/cloudflare/hooks/useCloudflare';
import { showNotification } from '@/lib/notifications';
import { cn } from '@/lib/utils/cn';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Types for zone tabs
interface ZoneTab {
  id: string;
  name: string;
  zoneId: string;
  searchQuery: string;
}

// Types for DNS record form tabs
interface DNSRecordTab {
  id: string;
  name: string;
  zoneId: string;
  recordId?: string;
  type: string;
  recordName: string;
  content: string;
  ttl: number;
  proxied: boolean;
  priority?: number;
  comment?: string;
  isDirty: boolean;
}

export default function CloudflareManager() {
  const [activeTab, setActiveTab] = useState('zones');
  const [zoneTabs, setZoneTabs] = useState<ZoneTab[]>([]);
  const [dnsRecordTabs, setDnsRecordTabs] = useState<DNSRecordTab[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [configForm, setConfigForm] = useState({ api_token: '', global_api_key: '', email: '' });
  const [authMethod, setAuthMethod] = useState<'token' | 'api_key'>('token');
  const [zonesSearchQuery, setZonesSearchQuery] = useState('');

  // Hooks
  const { data: config, refetch: refetchConfig } = useCloudflareConfig();
  const setConfig = useSetCloudflareConfig();
  const { data: zones, isLoading: zonesLoading, refetch: refetchZones } = useCloudflareZones();
  
  // Get current zone tab
  const currentZoneTab = zoneTabs.find(t => t.id === activeTab);
  const currentZone = zones?.find(z => z.id === currentZoneTab?.zoneId);
  const { data: dnsRecords, isLoading: dnsRecordsLoading, refetch: refetchDNSRecords } = useCloudflareDNSRecords(
    currentZoneTab?.zoneId || ''
  );

  // Mutations
  const createDNSRecord = useCreateDNSRecord();
  const updateDNSRecord = useUpdateDNSRecord();
  const deleteDNSRecord = useDeleteDNSRecord();

  // Stats
  const stats = useMemo(() => {
    if (!zones) return { total: 0, active: 0, dnsRecords: 0 };
    const activeZones = zones.filter(z => z.status === 'active').length;
    const totalDNSRecords = dnsRecords?.length || 0;
    return {
      total: zones.length,
      active: activeZones,
      dnsRecords: totalDNSRecords,
    };
  }, [zones, dnsRecords]);

  // Filter zones
  const filteredZones = useMemo(() => {
    if (!zones) return [];
    if (!zonesSearchQuery) return zones;
    const query = zonesSearchQuery.toLowerCase();
    return zones.filter(zone => 
      zone.name.toLowerCase().includes(query) ||
      zone.status.toLowerCase().includes(query) ||
      zone.plan.toLowerCase().includes(query)
    );
  }, [zones, zonesSearchQuery]);

  // Filter DNS records
  const filteredDNSRecords = useMemo(() => {
    if (!dnsRecords) return [];
    const searchQuery = currentZoneTab?.searchQuery || '';
    if (!searchQuery) return dnsRecords;
    const query = searchQuery.toLowerCase();
    return dnsRecords.filter(record => 
      record.name.toLowerCase().includes(query) ||
      record.type.toLowerCase().includes(query) ||
      record.content.toLowerCase().includes(query)
    );
  }, [dnsRecords, currentZoneTab?.searchQuery]);

  // Handle opening a zone
  const handleOpenZone = (zone: CloudflareZone) => {
    const existingTab = zoneTabs.find(t => t.zoneId === zone.id);
    if (existingTab) {
      setActiveTab(existingTab.id);
      return;
    }

    const newTabId = `zone-${Date.now()}`;
    const newTab: ZoneTab = {
      id: newTabId,
      name: zone.name,
      zoneId: zone.id,
      searchQuery: ''
    };
    setZoneTabs([...zoneTabs, newTab]);
    setActiveTab(newTabId);
  };

  // Handle closing a zone tab
  const handleCloseZoneTab = (tabId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const newTabs = zoneTabs.filter(t => t.id !== tabId);
    setZoneTabs(newTabs);
    if (activeTab === tabId) {
      setActiveTab(newTabs.length > 0 ? newTabs[newTabs.length - 1].id : 'zones');
    }
  };

  // Handle creating new DNS record
  const handleNewDNSRecord = (type?: string) => {
    if (!currentZoneTab) {
      showNotification('error', 'Please select a zone first');
      return;
    }

    const newTabId = `dns-${Date.now()}`;
    const newTab: DNSRecordTab = {
      id: newTabId,
      name: 'New DNS Record',
      zoneId: currentZoneTab.zoneId,
      type: type || 'A',
      recordName: '',
      content: '',
      ttl: 3600,
      proxied: false,
      isDirty: false
    };
    setDnsRecordTabs([...dnsRecordTabs, newTab]);
    setActiveTab(newTabId);
  };

  // Handle editing DNS record
  const handleEditDNSRecord = (record: CloudflareDNSRecord) => {
    if (!currentZoneTab) return;

    const newTabId = `dns-${Date.now()}`;
    const recordName = record.name || 'DNS Record';
    const newTab: DNSRecordTab = {
      id: newTabId,
      name: recordName,
      zoneId: currentZoneTab.zoneId,
      recordId: record.id,
      type: record.type,
      recordName: record.name,
      content: record.content,
      ttl: record.ttl,
      proxied: record.proxied,
      priority: record.priority,
      comment: record.comment,
      isDirty: false
    };
    setDnsRecordTabs([...dnsRecordTabs, newTab]);
    setActiveTab(newTabId);
  };

  // Handle saving DNS record
  const handleSaveDNSRecord = async (tabId: string) => {
    const tab = dnsRecordTabs.find(t => t.id === tabId);
    if (!tab) return;

    try {
      const recordData: any = {
        type: tab.type,
        name: tab.recordName,
        content: tab.content,
        ttl: tab.ttl,
        proxied: tab.proxied,
      };
      if (tab.priority !== undefined) recordData.priority = tab.priority;
      if (tab.comment) recordData.comment = tab.comment;

      if (tab.recordId) {
        await updateDNSRecord.mutateAsync({
          zoneId: tab.zoneId,
          recordId: tab.recordId,
          record: recordData
        });
        showNotification('success', 'DNS record updated successfully');
      } else {
        await createDNSRecord.mutateAsync({
          zoneId: tab.zoneId,
          record: recordData
        });
        showNotification('success', 'DNS record created successfully');
      }

      // Close tab and refresh
      handleCloseDNSTab(tabId);
      refetchDNSRecords();
    } catch (error: any) {
      showNotification('error', error.response?.data?.error || 'Failed to save DNS record');
    }
  };

  // Handle deleting DNS record
  const handleDeleteDNSRecord = async (record: CloudflareDNSRecord) => {
    if (!currentZoneTab) return;
    if (!confirm(`Delete DNS record ${record.name}?`)) return;

    try {
      await deleteDNSRecord.mutateAsync({
        zoneId: currentZoneTab.zoneId,
        recordId: record.id
      });
      showNotification('success', 'DNS record deleted successfully');
      refetchDNSRecords();
    } catch (error: any) {
      showNotification('error', error.response?.data?.error || 'Failed to delete DNS record');
    }
  };

  // Handle closing DNS record tab
  const handleCloseDNSTab = (tabId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const tab = dnsRecordTabs.find(t => t.id === tabId);
    if (tab?.isDirty) {
      if (!confirm(`Discard changes to ${tab.name}?`)) return;
    }

    const newTabs = dnsRecordTabs.filter(t => t.id !== tabId);
    setDnsRecordTabs(newTabs);
    if (activeTab === tabId) {
      setActiveTab(currentZoneTab?.id || 'zones');
    }
  };

  // Handle saving config
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const configData = authMethod === 'token' 
        ? { api_token: configForm.api_token, email: configForm.email }
        : { global_api_key: configForm.global_api_key, email: configForm.email };
      await setConfig.mutateAsync(configData);
      showNotification('success', 'Cloudflare API credentials saved');
      setShowSettings(false);
      refetchConfig();
      refetchZones();
    } catch (error: any) {
      showNotification('error', error.response?.data?.error || 'Failed to save configuration');
    }
  };

  // Update zone tab search query
  const setZoneTabSearchQuery = (query: string) => {
    if (!currentZoneTab) return;
    setZoneTabs(prev => prev.map(t => 
      t.id === currentZoneTab.id ? { ...t, searchQuery: query } : t
    ));
  };

  // Show configuration if not configured
  if (config && !config.configured) {
    return (
      <div className="h-[calc(100vh-8rem)] flex flex-col gap-6 min-h-0">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cloud className="h-5 w-5" />
              Cloudflare Configuration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-6">
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

  // Main interface
  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col gap-6 min-h-0">
      {/* Overview Cards */}
      <div className="grid grid-cols-3 gap-4 flex-shrink-0">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Globe className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Zones</p>
                <p className="text-lg font-semibold">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Cloud className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Active Zones</p>
                <p className="text-lg font-semibold">{stats.active}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <FileCode className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">DNS Records</p>
                <p className="text-lg font-semibold">{stats.dnsRecords}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tab Bar */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={() => setActiveTab('zones')}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg transition-colors",
            activeTab === 'zones'
              ? "bg-amber-50 border-amber-200 text-foreground"
              : "bg-background border-border hover:bg-muted/50"
          )}
        >
          <Globe className="h-3.5 w-3.5" />
          <span>Zones</span>
        </button>
        {zoneTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg transition-colors",
              activeTab === tab.id
                ? "bg-amber-50 border-amber-200 text-foreground"
                : "bg-background border-border hover:bg-muted/50"
            )}
          >
            <Cloud className="h-3.5 w-3.5" />
            <span className="max-w-[150px] truncate">{tab.name}</span>
            <button
              onClick={(e) => handleCloseZoneTab(tab.id, e)}
              className="ml-1 hover:bg-muted rounded p-0.5"
            >
              <X className="h-3 w-3" />
            </button>
          </button>
        ))}
        {dnsRecordTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg transition-colors",
              activeTab === tab.id
                ? "bg-amber-50 border-amber-200 text-foreground"
                : "bg-background border-border hover:bg-muted/50"
            )}
          >
            <FileCode className="h-3.5 w-3.5" />
            <span className="max-w-[150px] truncate">{tab.name}</span>
            {tab.isDirty && <span className="h-1.5 w-1.5 rounded-full bg-yellow-500" />}
            <button
              onClick={(e) => handleCloseDNSTab(tab.id, e)}
              className="ml-1 hover:bg-muted rounded p-0.5"
            >
              <X className="h-3 w-3" />
            </button>
          </button>
        ))}
      </div>

      {/* Search and Actions Bar */}
      {(activeTab === 'zones' || zoneTabs.find(t => t.id === activeTab) || dnsRecordTabs.find(t => t.id === activeTab)) && (
        <div className="flex items-center gap-4 flex-shrink-0">
          {activeTab === 'zones' ? (
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search zones..."
                value={zonesSearchQuery}
                onChange={(e) => setZonesSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          ) : zoneTabs.find(t => t.id === activeTab) ? (
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search DNS records..."
                value={currentZoneTab?.searchQuery || ''}
                onChange={(e) => setZoneTabSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          ) : (
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                className="pl-10"
                readOnly
              />
            </div>
          )}
          <div className="flex items-center gap-2">
            {activeTab === 'zones' && (
              <Button variant="outline" size="sm" onClick={() => refetchZones()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            )}
            {zoneTabs.find(t => t.id === activeTab) && (
              <>
                <Button variant="outline" size="sm" onClick={() => refetchDNSRecords()}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
                <Button size="sm" onClick={() => handleNewDNSRecord()}>
                  <Plus className="h-4 w-4 mr-2" />
                  New DNS Record
                </Button>
              </>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSettings(true)}
            >
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
          </div>
        </div>
      )}

      {/* Zones Tab */}
      {activeTab === 'zones' && (
        <div className="border rounded-lg overflow-hidden min-h-[52vh] h-[52vh] flex-shrink-0">
          {zonesLoading ? (
            <div className="flex items-center justify-center h-full">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredZones.length > 0 ? (
            <div className="overflow-auto h-full">
              <table className="w-full">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="text-left p-3 text-sm font-medium">Domain</th>
                    <th className="text-left p-3 text-sm font-medium">Status</th>
                    <th className="text-left p-3 text-sm font-medium">Plan</th>
                    <th className="text-left p-3 text-sm font-medium">Name Servers</th>
                    <th className="text-right p-3 text-sm font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredZones.map((zone) => (
                    <tr
                      key={zone.id}
                      className="border-t hover:bg-muted/30 cursor-pointer"
                      onClick={() => handleOpenZone(zone)}
                    >
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{zone.name}</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <Badge
                          variant={zone.status === 'active' ? 'default' : 'outline'}
                          className={zone.status === 'active' ? 'bg-green-500' : ''}
                        >
                          {zone.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-sm text-muted-foreground">{zone.plan}</td>
                      <td className="p-3 text-sm text-muted-foreground">
                        {zone.name_servers?.slice(0, 2).join(', ') || '-'}
                        {zone.name_servers && zone.name_servers.length > 2 && '...'}
                      </td>
                      <td className="p-3 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenZone(zone);
                          }}
                        >
                          Open
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
        </div>
      ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
              <Globe className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">No zones found</p>
              <Button onClick={() => refetchZones()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Load Zones
              </Button>
            </div>
            </div>
          )}
        </div>
      )}

      {/* Zone DNS Records Tab */}
      {currentZoneTab && activeTab === currentZoneTab.id && (
        <div className="border rounded-lg overflow-hidden min-h-[52vh] h-[52vh] flex-shrink-0">
          {dnsRecordsLoading ? (
            <div className="flex items-center justify-center h-full">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredDNSRecords.length > 0 ? (
            <div className="overflow-auto h-full overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="text-left p-3 text-sm font-medium w-20">Type</th>
                    <th className="text-left p-3 text-sm font-medium w-48">Name</th>
                    <th className="text-left p-3 text-sm font-medium min-w-[200px]">Content</th>
                    <th className="text-left p-3 text-sm font-medium w-24">TTL</th>
                    <th className="text-left p-3 text-sm font-medium w-32">Proxy</th>
                    <th className="text-right p-3 text-sm font-medium w-32">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDNSRecords.map((record) => (
                    <tr key={record.id} className="border-t hover:bg-muted/30">
                      <td className="p-3">
                        <Badge variant="outline">{record.type}</Badge>
                      </td>
                      <td className="p-3 font-medium truncate max-w-[192px]" title={record.name}>
                        {record.name}
                      </td>
                      <td className="p-3 text-sm font-mono break-all min-w-[200px] max-w-[400px]">
                        <div className="overflow-hidden overflow-x-auto" title={record.content}>
                          {record.content}
                        </div>
                      </td>
                      <td className="p-3 text-sm text-muted-foreground">{record.ttl}</td>
                      <td className="p-3">
                        <Badge variant={record.proxied ? 'default' : 'outline'}>
                          {record.proxied ? 'Proxied' : 'DNS Only'}
                        </Badge>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditDNSRecord(record)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteDNSRecord(record)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <FileCode className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground mb-4">No DNS records found</p>
                <Button onClick={() => handleNewDNSRecord()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create DNS Record
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* DNS Record Form Tab */}
      {dnsRecordTabs.find(t => t.id === activeTab) && (() => {
        const tab = dnsRecordTabs.find(t => t.id === activeTab);
        if (!tab) return null;

        return (
          <Card className="h-[52vh] flex flex-col overflow-hidden flex-shrink-0">
            <CardHeader className="flex-shrink-0 border-b p-3 h-auto">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">{tab.recordId ? 'Edit DNS Record' : 'Create DNS Record'}</CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCloseDNSTab(tab.id)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleSaveDNSRecord(tab.id)}
                    disabled={createDNSRecord.isPending || updateDNSRecord.isPending || !tab.recordName || !tab.content}
                  >
                    {createDNSRecord.isPending || updateDNSRecord.isPending ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Save
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 flex-1 min-h-0 overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Type *</label>
                    <Select
                      value={tab.type}
                      onValueChange={(value) => {
                        setDnsRecordTabs(prev => prev.map(t => 
                          t.id === tab.id 
                            ? { ...t, type: value, isDirty: true }
                            : t
                        ));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="A">A</SelectItem>
                        <SelectItem value="AAAA">AAAA</SelectItem>
                        <SelectItem value="CNAME">CNAME</SelectItem>
                        <SelectItem value="MX">MX</SelectItem>
                        <SelectItem value="TXT">TXT</SelectItem>
                        <SelectItem value="SRV">SRV</SelectItem>
                        <SelectItem value="NS">NS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">TTL *</label>
                    <Input
                      type="number"
                      value={tab.ttl}
                      onChange={(e) => {
                        setDnsRecordTabs(prev => prev.map(t => 
                          t.id === tab.id 
                            ? { ...t, ttl: parseInt(e.target.value) || 3600, isDirty: true }
                            : t
                        ));
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Name *</label>
                  <Input
                    placeholder="example.com or subdomain"
                    value={tab.recordName}
                    onChange={(e) => {
                      setDnsRecordTabs(prev => prev.map(t => 
                        t.id === tab.id 
                          ? { ...t, recordName: e.target.value, name: e.target.value, isDirty: true }
                          : t
                      ));
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Content *</label>
                  <Input
                    placeholder="IP address or domain"
                    value={tab.content}
                    onChange={(e) => {
                      setDnsRecordTabs(prev => prev.map(t => 
                        t.id === tab.id 
                          ? { ...t, content: e.target.value, isDirty: true }
                          : t
                      ));
                    }}
                  />
                </div>

                {(tab.type === 'MX' || tab.type === 'SRV') && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Priority</label>
                    <Input
                      type="number"
                      value={tab.priority || ''}
                      onChange={(e) => {
                        setDnsRecordTabs(prev => prev.map(t => 
                          t.id === tab.id 
                            ? { ...t, priority: parseInt(e.target.value) || undefined, isDirty: true }
                            : t
                        ));
                      }}
                    />
                  </div>
                )}

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="text-sm font-medium">Proxy Status</p>
                    <p className="text-xs text-muted-foreground">Enable Cloudflare proxy</p>
                  </div>
                  <Switch
                    checked={tab.proxied}
                    onCheckedChange={(checked) => {
                      setDnsRecordTabs(prev => prev.map(t => 
                        t.id === tab.id 
                          ? { ...t, proxied: checked, isDirty: true }
                          : t
                      ));
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Comment (Optional)</label>
                  <Input
                    placeholder="Optional comment"
                    value={tab.comment || ''}
                    onChange={(e) => {
                      setDnsRecordTabs(prev => prev.map(t => 
                        t.id === tab.id 
                          ? { ...t, comment: e.target.value, isDirty: true }
                          : t
                      ));
                    }}
                  />
                </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Settings Dialog */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Cloudflare Configuration</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setShowSettings(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            </CardHeader>
            <CardContent>
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
                      required
                    />
                  </div>
                </>
              )}
              
              <div className="flex gap-2">
                <Button type="submit" disabled={setConfig.isPending}>
                  {setConfig.isPending ? 'Saving...' : 'Save'}
                </Button>
                  <Button type="button" variant="outline" onClick={() => setShowSettings(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
        </div>
      )}
    </div>
  );
}
