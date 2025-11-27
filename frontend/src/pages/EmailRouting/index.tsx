import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  RefreshCw,
  Server,
  Inbox,
  Share2,
  Plus,
  Trash2,
  Settings2,
  ShieldCheck,
} from 'lucide-react';
import { showNotification } from '@/lib/notifications';
import {
  useMailDomains,
  useCreateMailDomain,
  useDeleteMailDomain,
  useMailboxes,
  useCreateMailbox,
  useDeleteMailbox,
  useMailAliases,
  useCreateMailAlias,
  useDeleteMailAlias,
  useMailConfigs,
  useSyncMailConfigs,
  type MailDomain,
  useMailDomainDns,
  useMailboxMessages,
  useMailboxMessage,
} from '@/features/mail/hooks/useMail';
import { CloudflareImportDialog } from '@/features/mail/components/CloudflareImportDialog';
import { useSendEmail } from '@/features/email/hooks/useEmail';

type TabValue = 'domains' | 'mailboxes' | 'aliases' | 'settings';

export default function EmailRoutingManager() {
const [activeTab, setActiveTab] = useState<TabValue>('domains');
  const [selectedDomainId, setSelectedDomainId] = useState<number | null>(null);
const [clientMailboxId, setClientMailboxId] = useState<number | null>(null);
const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);

  const { data: domains, isLoading: domainsLoading } = useMailDomains();
  const { data: configPreview } = useMailConfigs();

  const mailboxesQuery = useMailboxes(selectedDomainId ?? undefined);
  const aliasesQuery = useMailAliases(selectedDomainId ?? undefined);

  const createDomain = useCreateMailDomain();
  const deleteDomain = useDeleteMailDomain();
  const createMailbox = useCreateMailbox();
  const deleteMailbox = useDeleteMailbox();
  const createAlias = useCreateMailAlias();
  const deleteAlias = useDeleteMailAlias();
  const syncConfigs = useSyncMailConfigs();

  const [domainForm, setDomainForm] = useState({ name: '', display_name: '', auto_dns_enabled: true });
  const [mailboxForm, setMailboxForm] = useState({ local_part: '', password: '', quota_mb: 512 });
  const [aliasForm, setAliasForm] = useState({ local_part: '', destinations: '' });
  const [importDialogOpen, setImportDialogOpen] = useState(false);
const sendEmailMutation = useSendEmail();
const [composeForm, setComposeForm] = useState({
  from: '',
  to: '',
  subject: 'Test message',
  body: 'This is a test email.',
});
const messagesQuery = useMailboxMessages(clientMailboxId ?? undefined);
const messageDetailQuery = useMailboxMessage(clientMailboxId ?? undefined, selectedMessageId ?? undefined);

  useEffect(() => {
    if (domains && domains.length > 0) {
      if (!selectedDomainId || !domains.some((d) => d.id === selectedDomainId)) {
        setSelectedDomainId(domains[0].id);
      }
    } else {
      setSelectedDomainId(null);
    }
  }, [domains, selectedDomainId]);

  const selectedDomain = domains?.find((d) => d.id === selectedDomainId) ?? null;
  const mailboxes = mailboxesQuery.data ?? [];
  const clientMailbox = mailboxes.find((mb) => mb.id === clientMailboxId) ?? mailboxes[0];
  const aliases = aliasesQuery.data ?? [];
  const dnsQuery = useMailDomainDns(selectedDomain?.id);
  const dnsRecords = dnsQuery.data;

const stats = useMemo(() => ({
    domains: domains?.length ?? 0,
    mailboxes: mailboxes?.length ?? 0,
    aliases: aliases?.length ?? 0,
  }), [domains, mailboxes, aliases]);

  const handleCreateDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!domainForm.name) {
      showNotification('error', 'Domain name is required');
      return;
    }
    try {
      await createDomain.mutateAsync({
        name: domainForm.name,
        display_name: domainForm.display_name || domainForm.name,
        auto_dns_enabled: domainForm.auto_dns_enabled,
      });
      showNotification('success', 'Domain added');
      setDomainForm({ name: '', display_name: '', auto_dns_enabled: true });
    } catch (error: any) {
      showNotification('error', error.response?.data?.error || 'Failed to add domain');
    }
  };

  const handleDeleteDomain = async (domain: MailDomain) => {
    if (!window.confirm(`Remove ${domain.name}? This deletes mailboxes and aliases.`)) return;
    try {
      await deleteDomain.mutateAsync(domain.id);
      showNotification('success', 'Domain removed');
    } catch (error: any) {
      showNotification('error', error.response?.data?.error || 'Failed to delete domain');
    }
  };

  const handleCreateMailbox = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDomain) {
      showNotification('error', 'Select a domain first');
      return;
    }
    if (!mailboxForm.local_part || !mailboxForm.password) {
      showNotification('error', 'Mailbox and password are required');
      return;
    }
    try {
      await createMailbox.mutateAsync({
        domain_id: selectedDomain.id,
        local_part: mailboxForm.local_part,
        password: mailboxForm.password,
        quota_mb: Number(mailboxForm.quota_mb) || 512,
      });
      showNotification('success', 'Mailbox created');
      setMailboxForm({ local_part: '', password: '', quota_mb: mailboxForm.quota_mb });
    } catch (error: any) {
      showNotification('error', error.response?.data?.error || 'Failed to create mailbox');
    }
  };

  const handleDeleteMailbox = async (mailboxId: number) => {
    if (!window.confirm('Delete this mailbox?')) return;
    try {
      await deleteMailbox.mutateAsync(mailboxId);
      showNotification('success', 'Mailbox removed');
    } catch (error: any) {
      showNotification('error', error.response?.data?.error || 'Failed to delete mailbox');
    }
  };

  const handleCreateAlias = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDomain) {
      showNotification('error', 'Select a domain first');
      return;
    }
    const destinations = aliasForm.destinations
      .split(',')
      .map((d) => d.trim())
      .filter(Boolean);
    if (!aliasForm.local_part || destinations.length === 0) {
      showNotification('error', 'Alias and at least one destination are required');
      return;
    }
    try {
      await createAlias.mutateAsync({
        domain_id: selectedDomain.id,
        local_part: aliasForm.local_part,
        destinations,
      });
      showNotification('success', 'Alias created');
      setAliasForm({ local_part: '', destinations: '' });
    } catch (error: any) {
      showNotification('error', error.response?.data?.error || 'Failed to create alias');
    }
  };

  const handleDeleteAlias = async (aliasId: number) => {
    if (!window.confirm('Delete this alias?')) return;
    try {
      await deleteAlias.mutateAsync(aliasId);
      showNotification('success', 'Alias removed');
    } catch (error: any) {
      showNotification('error', error.response?.data?.error || 'Failed to delete alias');
    }
  };

  const handleSyncConfigs = async () => {
    try {
      await syncConfigs.mutateAsync();
      showNotification('success', 'Mail services reloaded');
    } catch (error: any) {
      showNotification('error', error.response?.data?.error || 'Failed to sync configs');
    }
  };

useEffect(() => {
    if (clientMailbox && clientMailboxId !== clientMailbox.id) {
      setClientMailboxId(clientMailbox.id);
      setComposeForm((prev) => ({ ...prev, from: clientMailbox.email }));
    } else if (!clientMailbox && mailboxes.length > 0 && !clientMailboxId) {
      setClientMailboxId(mailboxes[0].id);
      setComposeForm((prev) => ({ ...prev, from: mailboxes[0].email }));
    }
  }, [clientMailboxId, clientMailbox, mailboxes]);

 const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!composeForm.to || !composeForm.from || !composeForm.subject || !composeForm.body) {
      showNotification('error', 'All fields are required');
      return;
    }
    try {
      await sendEmailMutation.mutateAsync({
        to: composeForm.to,
        from: composeForm.from,
        from_name: '',
        subject: composeForm.subject,
        body: composeForm.body,
      });
      showNotification('success', 'Test email sent');
      setComposeForm((prev) => ({ ...prev, to: '', subject: prev.subject, body: prev.body }));
    } catch (error: any) {
      showNotification('error', error.response?.data?.error || 'Failed to send email');
    }
  };

  if (domainsLoading) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-12 w-12 mx-auto mb-4 text-muted-foreground animate-spin" />
          <p className="text-muted-foreground">Loading mail domains...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col gap-6">
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Server className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Domains</p>
              <p className="text-lg font-semibold">{stats.domains}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <Inbox className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Mailboxes</p>
              <p className="text-lg font-semibold">{stats.mailboxes}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Share2 className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Aliases</p>
              <p className="text-lg font-semibold">{stats.aliases}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Config Status</p>
              <p className="text-lg font-semibold">{configPreview?.stats.mailboxes ?? 0} mailboxes synced</p>
            </div>
            <ShieldCheck className="h-5 w-5 text-emerald-500" />
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabValue)} className="flex-1 flex flex-col">
      <TabsList className="w-full justify-start gap-2">
          <TabsTrigger value="domains">Domains</TabsTrigger>
          <TabsTrigger value="mailboxes" disabled={!selectedDomain}>
            Mailboxes
          </TabsTrigger>
          <TabsTrigger value="aliases" disabled={!selectedDomain}>
            Aliases
          </TabsTrigger>
          <TabsTrigger value="settings">Config & Reload</TabsTrigger>
        <TabsTrigger value="client" disabled={!clientMailbox}>
          Mail Client
        </TabsTrigger>
        </TabsList>

        <TabsContent value="domains" className="flex-1 mt-4 flex flex-col gap-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1">
            <Card className="lg:col-span-2 h-full">
              <CardHeader className="flex items-center justify-between">
                <CardTitle>Managed Domains</CardTitle>
                <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(true)}>
                  Import from Cloudflare
                </Button>
              </CardHeader>
              <CardContent className="overflow-auto max-h-[480px]">
                {domains && domains.length > 0 ? (
                  <table className="w-full text-sm">
                    <thead className="text-muted-foreground">
                      <tr>
                        <th className="text-left pb-2">Domain</th>
                        <th className="text-left pb-2">MX Host</th>
                        <th className="text-left pb-2">Mailboxes</th>
                        <th className="text-left pb-2">Aliases</th>
                        <th className="text-right pb-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {domains.map((domain) => (
                        <tr key={domain.id} className="border-t border-border/60">
                          <td className="py-2">
                            <div className="font-medium">{domain.name}</div>
                            <Badge variant={domain.active ? 'default' : 'secondary'}>
                              {domain.active ? 'Active' : 'Disabled'}
                            </Badge>
                          </td>
                          <td className="py-2">{domain.mx_hostname || `mail.${domain.name}`}</td>
                          <td className="py-2">{domain.mailbox_count ?? 0}</td>
                          <td className="py-2">{domain.alias_count ?? 0}</td>
                          <td className="py-2 text-right">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setSelectedDomainId(domain.id)}
                              className="mr-2"
                            >
                              <Settings2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleDeleteDomain(domain)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-muted-foreground text-sm">No domains yet. Add one using the form.</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Add Domain</CardTitle>
              </CardHeader>
              <CardContent>
                <form className="space-y-3" onSubmit={handleCreateDomain}>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Domain Name</label>
                    <Input
                      placeholder="example.com"
                      value={domainForm.name}
                      onChange={(e) => setDomainForm({ ...domainForm, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Display Name</label>
                    <Input
                      placeholder="Marketing"
                      value={domainForm.display_name}
                      onChange={(e) => setDomainForm({ ...domainForm, display_name: e.target.value })}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={domainForm.auto_dns_enabled}
                      onChange={(e) => setDomainForm({ ...domainForm, auto_dns_enabled: e.target.checked })}
                      className="rounded border border-border"
                    />
                    <span className="text-sm">Automatically publish MX/SPF/DKIM/DMARC via Cloudflare</span>
                  </div>
                  <Button type="submit" className="w-full" disabled={createDomain.isPending}>
                    {createDomain.isPending ? 'Saving...' : 'Add Domain'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
          <CloudflareImportDialog open={importDialogOpen} onClose={() => setImportDialogOpen(false)} />
        </TabsContent>

        <TabsContent value="mailboxes" className="flex-1 mt-4">
          {!selectedDomain ? (
            <div className="border rounded-lg p-6 text-center text-muted-foreground">
              Add a domain first to manage mailboxes.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
              <Card className="lg:col-span-2">
                <CardHeader className="flex items-center justify-between">
                  <CardTitle>Mailboxes for {selectedDomain.name}</CardTitle>
                  <Select
                    value={selectedDomainId?.toString()}
                    onValueChange={(value) => setSelectedDomainId(Number(value))}
                  >
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Select domain" />
                    </SelectTrigger>
                    <SelectContent>
                      {domains?.map((domain) => (
                        <SelectItem key={domain.id} value={domain.id.toString()}>
                          {domain.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardHeader>
                <CardContent className="overflow-auto max-h-[480px]">
                  {mailboxes.length > 0 ? (
                    <table className="w-full text-sm">
                      <thead className="text-muted-foreground">
                        <tr>
                          <th className="text-left pb-2">Email</th>
                          <th className="text-left pb-2">Quota (MB)</th>
                          <th className="text-left pb-2">Forwarding</th>
                          <th className="text-right pb-2">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mailboxes.map((mailbox) => (
                          <tr key={mailbox.id} className="border-t border-border/60">
                            <td className="py-2 font-medium">{mailbox.email}</td>
                            <td className="py-2">{mailbox.quota_mb}</td>
                            <td className="py-2">
                              {mailbox.forwarding_enabled ? mailbox.forwarding_address : '—'}
                            </td>
                            <td className="py-2 text-right">
                          <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleDeleteMailbox(mailbox.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-muted-foreground text-sm">No mailboxes yet.</p>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Create Mailbox</CardTitle>
                </CardHeader>
                <CardContent>
                  <form className="space-y-3" onSubmit={handleCreateMailbox}>
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Local Part</label>
                      <Input
                        placeholder="support"
                        value={mailboxForm.local_part}
                        onChange={(e) => setMailboxForm({ ...mailboxForm, local_part: e.target.value })}
                        required
                      />
                      <p className="text-xs text-muted-foreground">@{selectedDomain.name}</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Password</label>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        value={mailboxForm.password}
                        onChange={(e) => setMailboxForm({ ...mailboxForm, password: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Quota (MB)</label>
                      <Input
                        type="number"
                        min={100}
                        value={mailboxForm.quota_mb}
                        onChange={(e) => setMailboxForm({ ...mailboxForm, quota_mb: Number(e.target.value) })}
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={createMailbox.isPending}>
                      {createMailbox.isPending ? 'Creating...' : 'Create Mailbox'}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="aliases" className="flex-1 mt-4">
          {!selectedDomain ? (
            <div className="border rounded-lg p-6 text-center text-muted-foreground">
              Add a domain first to manage aliases.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
              <Card className="lg:col-span-2">
                <CardHeader className="flex items-center justify-between">
                  <CardTitle>Aliases for {selectedDomain.name}</CardTitle>
                  <Select
                    value={selectedDomainId?.toString()}
                    onValueChange={(value) => setSelectedDomainId(Number(value))}
                  >
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Select domain" />
                    </SelectTrigger>
                    <SelectContent>
                      {domains?.map((domain) => (
                        <SelectItem key={domain.id} value={domain.id.toString()}>
                          {domain.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardHeader>
                <CardContent className="overflow-auto max-h-[480px]">
                  {aliases.length > 0 ? (
                    <table className="w-full text-sm">
                      <thead className="text-muted-foreground">
                        <tr>
                          <th className="text-left pb-2">Alias</th>
                          <th className="text-left pb-2">Destinations</th>
                          <th className="text-right pb-2">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {aliases.map((alias) => (
                          <tr key={alias.id} className="border-t border-border/60">
                            <td className="py-2 font-medium">{alias.email}</td>
                            <td className="py-2 text-xs text-muted-foreground">
                              {alias.destinations.map((dest) => dest.destination).join(', ') || '—'}
                            </td>
                            <td className="py-2 text-right">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleDeleteAlias(alias.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-muted-foreground text-sm">No aliases yet.</p>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Create Alias</CardTitle>
                </CardHeader>
                <CardContent>
                  <form className="space-y-3" onSubmit={handleCreateAlias}>
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Alias</label>
                      <Input
                        placeholder="sales"
                        value={aliasForm.local_part}
                        onChange={(e) => setAliasForm({ ...aliasForm, local_part: e.target.value })}
                        required
                      />
                      <p className="text-xs text-muted-foreground">@{selectedDomain.name}</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Destinations</label>
                      <Input
                        placeholder="user@example.com, team@example.net"
                        value={aliasForm.destinations}
                        onChange={(e) => setAliasForm({ ...aliasForm, destinations: e.target.value })}
                        required
                      />
                      <p className="text-xs text-muted-foreground">Separate multiple emails with commas.</p>
                    </div>
                    <Button type="submit" className="w-full" disabled={createAlias.isPending}>
                      {createAlias.isPending ? 'Creating...' : 'Create Alias'}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="settings" className="flex-1 mt-4 space-y-4">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>DNS Records</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Publish these with your DNS provider
                </p>
              </CardHeader>
              <CardContent>
                {!selectedDomain ? (
                  <p className="text-sm text-muted-foreground">Select a domain to view DNS guidance.</p>
                ) : dnsQuery.isLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Loading records...
                  </div>
                ) : dnsRecords ? (
                  <div className="space-y-3 text-xs font-mono">
                    {dnsRecords.mx.map((record, index) => (
                      <div key={`mx-${index}`} className="border rounded-md p-2">
                        <p><strong>{record.type}</strong> {record.name}</p>
                        <p>{record.value}</p>
                      </div>
                    ))}
                    <div className="border rounded-md p-2">
                      <p><strong>{dnsRecords.spf.type}</strong> {dnsRecords.spf.name}</p>
                      <p>{dnsRecords.spf.value}</p>
                    </div>
                    {dnsRecords.dkim ? (
                      <div className="border rounded-md p-2">
                        <p><strong>{dnsRecords.dkim.type}</strong> {dnsRecords.dkim.name}</p>
                        <p>{dnsRecords.dkim.value}</p>
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-xs">
                        Add a DKIM key to this domain to generate a record.
                      </p>
                    )}
                    <div className="border rounded-md p-2">
                      <p><strong>{dnsRecords.dmarc.type}</strong> {dnsRecords.dmarc.name}</p>
                      <p>{dnsRecords.dmarc.value}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No DNS data available.</p>
                )}
              </CardContent>
            </Card>
            <Card className="xl:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Configuration Preview</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Generated virtual alias and mailbox maps
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </CardHeader>
              <CardContent className="space-y-3 max-h-[460px] overflow-auto">
                <div>
                  <p className="text-xs font-semibold mb-1">Alias Map</p>
                  <textarea
                    className="w-full h-24 text-xs font-mono border rounded-md p-2 bg-muted/30"
                    readOnly
                    value={configPreview?.alias_map || ''}
                  />
                </div>
                <div>
                  <p className="text-xs font-semibold mb-1">Mailbox Map</p>
                  <textarea
                    className="w-full h-24 text-xs font-mono border rounded-md p-2 bg-muted/30"
                    readOnly
                    value={configPreview?.mailbox_map || ''}
                  />
                </div>
                <div>
                  <p className="text-xs font-semibold mb-1">Dovecot Users</p>
                  <textarea
                    className="w-full h-24 text-xs font-mono border rounded-md p-2 bg-muted/30"
                    readOnly
                    value={configPreview?.dovecot_users || ''}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle>Apply Configuration</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-between gap-4">
              <div className="space-y-2 text-sm">
                <p>Deploy the generated configuration files to Postfix and Dovecot.</p>
                <ul className="list-disc text-muted-foreground pl-5 space-y-1">
                  <li>Updates virtual alias and mailbox maps</li>
                  <li>Rebuilds hash maps via <code>postmap</code></li>
                  <li>Reloads Postfix & Dovecot services</li>
                </ul>
              </div>
              <Button onClick={handleSyncConfigs} disabled={syncConfigs.isPending}>
                {syncConfigs.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Applying...
                  </>
                ) : (
                  <>
                    <Settings2 className="h-4 w-4 mr-2" />
                    Sync & Reload
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="client" className="flex-1 mt-4">
          {!clientMailbox ? (
            <div className="border rounded-lg p-6 text-center text-muted-foreground">
              Create a mailbox first to use the mail client.
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 h-full">
              <Card className="xl:col-span-1">
                <CardHeader>
                  <CardTitle>Mailboxes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Select
                    value={clientMailboxId?.toString()}
                    onValueChange={(value) => {
                      setClientMailboxId(Number(value));
                      const mb = mailboxes.find((m) => m.id === Number(value));
                      if (mb) {
                        setComposeForm((prev) => ({ ...prev, from: mb.email }));
                      }
                      setSelectedMessageId(null);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select mailbox" />
                    </SelectTrigger>
                    <SelectContent>
                      {mailboxes.map((mailbox) => (
                        <SelectItem key={mailbox.id} value={mailbox.id.toString()}>
                          {mailbox.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" onClick={() => messagesQuery.refetch()}>
                    Refresh Inbox
                  </Button>
                  <div className="border rounded-lg max-h-[400px] overflow-auto">
                    {messagesQuery.isLoading ? (
                      <div className="p-4 text-sm text-muted-foreground">Loading messages...</div>
                    ) : messagesQuery.data && messagesQuery.data.length > 0 ? (
                      <ul className="divide-y">
                        {messagesQuery.data.map((msg) => (
                          <li
                            key={msg.id}
                            className={`p-3 cursor-pointer ${selectedMessageId === msg.id ? 'bg-muted' : 'hover:bg-muted/50'}`}
                            onClick={() => setSelectedMessageId(msg.id)}
                          >
                            <p className="text-sm font-medium truncate">{msg.subject || '(No subject)'}</p>
                            <p className="text-xs text-muted-foreground truncate">{msg.from}</p>
                            <p className="text-xs text-muted-foreground truncate">{msg.snippet}</p>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="p-4 text-sm text-muted-foreground">No messages yet.</div>
                    )}
                  </div>
                </CardContent>
              </Card>
              <div className="xl:col-span-3 grid grid-rows-2 gap-4">
                <Card className="row-span-1">
                  <CardHeader>
                    <CardTitle>Message Viewer</CardTitle>
                  </CardHeader>
                  <CardContent className="overflow-auto max-h-[340px]">
                    {selectedMessageId ? (
                      messageDetailQuery.isLoading ? (
                        <p className="text-sm text-muted-foreground">Loading message...</p>
                      ) : messageDetailQuery.data ? (
                        <div className="space-y-2 text-sm">
                          <p><strong>From:</strong> {messageDetailQuery.data.from}</p>
                          <p><strong>To:</strong> {messageDetailQuery.data.to}</p>
                          <p><strong>Subject:</strong> {messageDetailQuery.data.subject}</p>
                          <div className="mt-3 border rounded-md p-3 bg-muted/40 text-sm whitespace-pre-wrap">
                            {messageDetailQuery.data.parts?.map((part, idx) => (
                              <div key={idx} className="mb-4">
                                <p className="text-xs text-muted-foreground">[{part.type}]</p>
                                <p>{part.content}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Message not found.</p>
                      )
                    ) : (
                      <p className="text-sm text-muted-foreground">Select a message to view.</p>
                    )}
                  </CardContent>
                </Card>
                <Card className="row-span-1">
                  <CardHeader>
                    <CardTitle>Compose Test Email</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form className="space-y-3" onSubmit={handleSendTestEmail}>
                      <div className="space-y-1">
                        <label className="text-sm font-medium">From</label>
                        <Input
                          type="email"
                          value={composeForm.from}
                          onChange={(e) => setComposeForm({ ...composeForm, from: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-medium">To</label>
                        <Input
                          type="email"
                          placeholder="recipient@example.com"
                          value={composeForm.to}
                          onChange={(e) => setComposeForm({ ...composeForm, to: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-medium">Subject</label>
                        <Input
                          value={composeForm.subject}
                          onChange={(e) => setComposeForm({ ...composeForm, subject: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-medium">Body</label>
                        <textarea
                          className="w-full border rounded-md p-2 text-sm h-24"
                          value={composeForm.body}
                          onChange={(e) => setComposeForm({ ...composeForm, body: e.target.value })}
                          required
                        />
                      </div>
                      <Button type="submit" disabled={sendEmailMutation.isPending}>
                        {sendEmailMutation.isPending ? 'Sending...' : 'Send'}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

