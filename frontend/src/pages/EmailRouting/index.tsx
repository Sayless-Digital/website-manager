import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Mail, Plus, Trash2, RefreshCw, ArrowLeft, Send, X,
  Settings, Search, Globe, CheckCircle2, Circle
} from 'lucide-react';
import {
  useCloudflareZones,
  useEmailRoutingStatus,
  useEnableEmailRouting,
  useEmailAddresses,
  useCreateEmailAddress,
  useDeleteEmailAddress,
  type CloudflareZone,
  type EmailAddress,
} from '@/features/cloudflare/hooks/useCloudflare';
import {
  useEmailConfig,
  useSetEmailConfig,
  useSendEmail,
} from '@/features/email/hooks/useEmail';
import { showNotification } from '@/lib/notifications';
import { cn } from '@/lib/utils/cn';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useQueryClient,
} from '@tanstack/react-query';

export default function EmailRoutingManager() {
  const { zoneId } = useParams<{ zoneId?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('addresses');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedZoneId, setSelectedZoneId] = useState<string>('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showSendEmailDialog, setShowSendEmailDialog] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<EmailAddress | null>(null);

  // Hooks
  const { data: zones, refetch: refetchZones, isLoading: zonesLoading } = useCloudflareZones();
  const selectedZone = zones?.find(z => z.id === selectedZoneId) || zones?.[0];
  
  const { data: emailRoutingStatus, refetch: refetchEmailRouting } = useEmailRoutingStatus(selectedZone?.id || '');
  const enableEmailRouting = useEnableEmailRouting();
  const { data: emailAddresses, refetch: refetchEmailAddresses } = useEmailAddresses(
    selectedZone?.id,
    selectedZone?.account_id
  );
  const createEmailAddress = useCreateEmailAddress();
  const deleteEmailAddress = useDeleteEmailAddress();
  
  const { data: emailConfig, refetch: refetchEmailConfig } = useEmailConfig();
  const setEmailConfig = useSetEmailConfig();
  const sendEmail = useSendEmail();

  // Forms
  const [emailForm, setEmailForm] = useState({
    emailPrefix: '',
    destination: '',
  });
  const [emailConfigForm, setEmailConfigForm] = useState({
    hostname: '',
    domain: '',
    relay_host: '',
    relay_username: '',
    relay_password: '',
    from_email: '',
  });
  const [sendEmailForm, setSendEmailForm] = useState({
    to: '',
    from: '',
    from_name: '',
    subject: '',
    body: '',
  });

  // Set initial zone
  useEffect(() => {
    if (zoneId && zones) {
      setSelectedZoneId(zoneId);
    } else if (zones && zones.length > 0 && !selectedZoneId) {
      setSelectedZoneId(zones[0].id);
    }
  }, [zoneId, zones, selectedZoneId]);

  // Stats
  const stats = useMemo(() => {
    return {
      totalAddresses: emailAddresses?.length || 0,
      routingEnabled: emailRoutingStatus?.enabled || false,
      sendingConfigured: emailConfig?.configured || false,
    };
  }, [emailAddresses, emailRoutingStatus, emailConfig]);

  // Filter email addresses
  const filteredAddresses = useMemo(() => {
    if (!emailAddresses) return [];
    if (!searchQuery) return emailAddresses;
    const query = searchQuery.toLowerCase();
    return emailAddresses.filter(addr => 
      addr.email.toLowerCase().includes(query) ||
      addr.destination?.toLowerCase().includes(query)
    );
  }, [emailAddresses, searchQuery]);

  // Handlers
  const handleEnableEmailRouting = async () => {
    if (!selectedZone) return;
    try {
      await enableEmailRouting.mutateAsync(selectedZone.id);
      showNotification('success', 'Email routing enabled');
      refetchEmailRouting();
    } catch (error: any) {
      showNotification('error', error.response?.data?.error || 'Failed to enable email routing');
    }
  };

  const handleCreateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedZone) return;
    if (!selectedZone.account_id) {
      showNotification('error', 'Selected zone is missing a Cloudflare account ID');
      return;
    }
    try {
      const email = `${emailForm.emailPrefix}@${selectedZone.name}`;
      await createEmailAddress.mutateAsync({
        zoneId: selectedZone.id,
        accountId: selectedZone.account_id,
        email,
        destination: emailForm.destination,
      });
      showNotification('success', 'Email address created');
      setShowCreateDialog(false);
      setEmailForm({ emailPrefix: '', destination: '' });
      refetchEmailAddresses();
    } catch (error: any) {
      showNotification('error', error.response?.data?.error || 'Failed to create email address');
    }
  };

  const handleDeleteEmail = async () => {
    if (!deleteConfirm || !selectedZone) return;
    if (!selectedZone.account_id) {
      showNotification('error', 'Selected zone is missing a Cloudflare account ID');
      return;
    }
    try {
      await deleteEmailAddress.mutateAsync({
        zoneId: selectedZone.id,
        accountId: selectedZone.account_id,
        tag: deleteConfirm.tag,
      });
      showNotification('success', 'Email address deleted');
      setDeleteConfirm(null);
      refetchEmailAddresses();
    } catch (error: any) {
      showNotification('error', error.response?.data?.error || 'Failed to delete email address');
    }
  };

  const handleSaveEmailConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await setEmailConfig.mutateAsync(emailConfigForm);
      showNotification('success', 'Email configuration saved');
      setShowSettingsDialog(false);
      refetchEmailConfig();
    } catch (error: any) {
      showNotification('error', error.response?.data?.error || 'Failed to save configuration');
    }
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await sendEmail.mutateAsync(sendEmailForm);
      showNotification('success', 'Email sent successfully');
      setShowSendEmailDialog(false);
      setSendEmailForm({
        to: '',
        from: sendEmailForm.from,
        from_name: '',
        subject: '',
        body: '',
      });
    } catch (error: any) {
      showNotification('error', error.response?.data?.error || 'Failed to send email');
    }
  };

  const handleRefresh = () => {
    refetchZones();
    if (selectedZone) {
      refetchEmailRouting();
      refetchEmailAddresses();
    }
    refetchEmailConfig();
  };

  // Loading state
  if (zonesLoading) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-12 w-12 mx-auto mb-4 text-muted-foreground animate-spin" />
          <p className="text-muted-foreground">Loading zones...</p>
        </div>
      </div>
    );
  }

  // No zones state
  if (!zones || zones.length === 0) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Mail className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">
                No Cloudflare zones found. Please configure Cloudflare first.
              </p>
              <Button onClick={() => refetchZones()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Load Zones
              </Button>
            </div>
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
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Addresses</p>
                <p className="text-lg font-semibold">{stats.totalAddresses}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Receiving</p>
                <p className="text-lg font-semibold">
                  {stats.routingEnabled ? 'Enabled' : 'Disabled'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Send className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Sending</p>
                <p className="text-lg font-semibold">
                  {stats.sendingConfigured ? 'Configured' : 'Not Configured'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tab Bar */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={() => setActiveTab('addresses')}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg transition-colors",
            activeTab === 'addresses'
              ? "bg-amber-50 border-amber-200 text-foreground"
              : "bg-background border-border hover:bg-muted/50"
          )}
        >
          <Mail className="h-3.5 w-3.5" />
          <span>Email Addresses</span>
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg transition-colors",
            activeTab === 'settings'
              ? "bg-amber-50 border-amber-200 text-foreground"
              : "bg-background border-border hover:bg-muted/50"
          )}
        >
          <Settings className="h-3.5 w-3.5" />
          <span>Settings</span>
        </button>
      </div>

      {/* Search and Actions Bar */}
      {activeTab === 'addresses' && (
        <div className="flex items-center gap-4 flex-shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search email addresses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            {zones && zones.length > 0 && (
              <Select
                value={selectedZoneId}
                onValueChange={setSelectedZoneId}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select zone" />
                </SelectTrigger>
                <SelectContent>
                  {zones.map((zone) => (
                    <SelectItem key={zone.id} value={zone.id}>
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        <span>{zone.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {selectedZone && (
              <Button size="sm" onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New Email Address
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Email Addresses Tab */}
      {activeTab === 'addresses' && (
        <div className="border rounded-lg overflow-hidden min-h-[52vh] h-[52vh] flex-shrink-0">
          {!selectedZone ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Globe className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground mb-4">Please select a zone</p>
              </div>
            </div>
          ) : filteredAddresses.length > 0 ? (
            <div className="overflow-auto h-full overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="text-left p-3 text-sm font-medium w-1/3">Email</th>
                    <th className="text-left p-3 text-sm font-medium w-1/3">Forward To</th>
                    <th className="text-right p-3 text-sm font-medium w-1/3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAddresses.map((addr) => (
                    <tr key={addr.tag} className="border-t hover:bg-muted/30">
                      <td className="p-3 font-medium">{addr.email}</td>
                      <td className="p-3 text-sm text-muted-foreground">
                        {addr.destination || '-'}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSendEmailForm({ ...sendEmailForm, from: addr.email });
                              setShowSendEmailDialog(true);
                            }}
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDeleteConfirm(addr)}
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
                <Mail className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground mb-4">
                  {searchQuery ? 'No email addresses found matching your search' : 'No email addresses configured'}
                </p>
                {!searchQuery && (
                  <Button onClick={() => setShowCreateDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Email Address
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="flex-1 min-h-0 overflow-auto">
          <div className="space-y-6">
            {/* Receiving Configuration */}
            <Card>
              <CardHeader>
                <CardTitle>Receiving Configuration (Cloudflare)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="text-sm font-medium">Email Routing Status</p>
                    <p className="text-xs text-muted-foreground">
                      Enable receiving emails via Cloudflare Email Routing
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={emailRoutingStatus?.enabled ? 'default' : 'secondary'}>
                      {emailRoutingStatus?.enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                    {!emailRoutingStatus?.enabled && selectedZone && (
                      <Button onClick={handleEnableEmailRouting} size="sm">
                        Enable
                      </Button>
                    )}
                  </div>
                </div>
                {selectedZone && (
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm">
                      <span className="font-medium">Zone:</span> {selectedZone.name}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Sending Configuration */}
            <Card>
              <CardHeader>
                <CardTitle>Sending Configuration (Local Server)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="text-sm font-medium">Sending Server Status</p>
                    <p className="text-xs text-muted-foreground">
                      Configure SMTP relay for sending emails
                    </p>
                  </div>
                  <Badge variant={emailConfig?.configured ? 'default' : 'secondary'}>
                    {emailConfig?.configured ? 'Configured' : 'Not Configured'}
                  </Badge>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (emailConfig) {
                      setEmailConfigForm({
                        hostname: emailConfig.hostname || '',
                        domain: emailConfig.domain || '',
                        relay_host: emailConfig.relayhost || '',
                        relay_username: emailConfig.relay_username || '',
                        relay_password: '',
                        from_email: emailConfig.from_email || '',
                      });
                    }
                    setShowSettingsDialog(true);
                  }}
                >
                  Configure Sending
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Create Email Dialog */}
      {showCreateDialog && selectedZone && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Create Email Address</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setShowCreateDialog(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateEmail} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email Prefix *</label>
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="contact"
                      value={emailForm.emailPrefix}
                      onChange={(e) => setEmailForm({ ...emailForm, emailPrefix: e.target.value })}
                      required
                    />
                    <span className="text-muted-foreground">@{selectedZone.name}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Forward To *</label>
                  <Input
                    type="email"
                    placeholder="your@email.com"
                    value={emailForm.destination}
                    onChange={(e) => setEmailForm({ ...emailForm, destination: e.target.value })}
                    required
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={createEmailAddress.isPending} className="flex-1">
                    {createEmailAddress.isPending ? 'Creating...' : 'Create'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Delete Email Address</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>Are you sure you want to delete {deleteConfirm.email}?</p>
              <div className="flex gap-2">
                <Button variant="destructive" onClick={handleDeleteEmail} className="flex-1">
                  Delete
                </Button>
                <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Settings Dialog */}
      {showSettingsDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <CardHeader className="flex-shrink-0">
              <div className="flex items-center justify-between">
                <CardTitle>Email Sending Configuration</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setShowSettingsDialog(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 overflow-y-auto space-y-4">
              <form onSubmit={handleSaveEmailConfig} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Hostname *</label>
                    <Input
                      placeholder="mail.example.com"
                      value={emailConfigForm.hostname}
                      onChange={(e) => setEmailConfigForm({ ...emailConfigForm, hostname: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Domain *</label>
                    <Input
                      placeholder="example.com"
                      value={emailConfigForm.domain}
                      onChange={(e) => setEmailConfigForm({ ...emailConfigForm, domain: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Relay Host</label>
                  <Input
                    placeholder="smtp.example.com"
                    value={emailConfigForm.relay_host}
                    onChange={(e) => setEmailConfigForm({ ...emailConfigForm, relay_host: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Relay Username</label>
                    <Input
                      placeholder="username"
                      value={emailConfigForm.relay_username}
                      onChange={(e) => setEmailConfigForm({ ...emailConfigForm, relay_username: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Relay Password</label>
                    <Input
                      type="password"
                      placeholder="password"
                      value={emailConfigForm.relay_password}
                      onChange={(e) => setEmailConfigForm({ ...emailConfigForm, relay_password: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">From Email</label>
                  <Input
                    type="email"
                    placeholder="noreply@example.com"
                    value={emailConfigForm.from_email}
                    onChange={(e) => setEmailConfigForm({ ...emailConfigForm, from_email: e.target.value })}
                  />
                </div>
                <div className="flex gap-2 pt-4">
                  <Button type="submit" disabled={setEmailConfig.isPending} className="flex-1">
                    {setEmailConfig.isPending ? 'Saving...' : 'Save Configuration'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowSettingsDialog(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Send Email Dialog */}
      {showSendEmailDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <CardHeader className="flex-shrink-0">
              <div className="flex items-center justify-between">
                <CardTitle>Send Email</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setShowSendEmailDialog(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 overflow-y-auto space-y-4">
              <form onSubmit={handleSendEmail} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">To *</label>
                    <Input
                      type="email"
                      placeholder="recipient@example.com"
                      value={sendEmailForm.to}
                      onChange={(e) => setSendEmailForm({ ...sendEmailForm, to: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">From *</label>
                    <Input
                      type="email"
                      placeholder="sender@example.com"
                      value={sendEmailForm.from}
                      onChange={(e) => setSendEmailForm({ ...sendEmailForm, from: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">From Name</label>
                  <Input
                    placeholder="Sender Name"
                    value={sendEmailForm.from_name}
                    onChange={(e) => setSendEmailForm({ ...sendEmailForm, from_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Subject *</label>
                  <Input
                    placeholder="Email subject"
                    value={sendEmailForm.subject}
                    onChange={(e) => setSendEmailForm({ ...sendEmailForm, subject: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Body *</label>
                  <textarea
                    className="w-full min-h-[200px] px-3 py-2 text-sm border rounded-md resize-none"
                    placeholder="Email body"
                    value={sendEmailForm.body}
                    onChange={(e) => setSendEmailForm({ ...sendEmailForm, body: e.target.value })}
                    required
                  />
                </div>
                <div className="flex gap-2 pt-4">
                  <Button type="submit" disabled={sendEmail.isPending} className="flex-1">
                    {sendEmail.isPending ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Send Email
                      </>
                    )}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowSendEmailDialog(false)}>
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
