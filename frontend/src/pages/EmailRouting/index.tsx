import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Mail, Plus, Edit, Trash2, RefreshCw, ArrowLeft, Send, X } from 'lucide-react';
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

export default function EmailRoutingManager() {
  const { zoneId } = useParams<{ zoneId?: string }>();
  const navigate = useNavigate();
  const { data: zones, refetch: refetchZones, isLoading: zonesLoading } = useCloudflareZones();
  const [selectedZone, setSelectedZone] = useState<CloudflareZone | null>(null);
  
  const { data: emailRoutingStatus, refetch: refetchEmailRouting } = useEmailRoutingStatus(selectedZone?.id || zoneId || '');
  const enableEmailRouting = useEnableEmailRouting();
  const { data: emailAddresses, refetch: refetchEmailAddresses } = useEmailAddresses(selectedZone?.id || zoneId || '');
  const createEmailAddress = useCreateEmailAddress();
  const deleteEmailAddress = useDeleteEmailAddress();
  
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [deleteEmailConfirm, setDeleteEmailConfirm] = useState<EmailAddress | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  
  const [emailForm, setEmailForm] = useState({
    emailPrefix: '',
    destination: '',
  });

  const { data: emailConfig, refetch: refetchEmailConfig } = useEmailConfig();
  const setEmailConfig = useSetEmailConfig();
  const sendEmail = useSendEmail();
  
  const [showEmailConfigDialog, setShowEmailConfigDialog] = useState(false);
  const [showSendEmailDialog, setShowSendEmailDialog] = useState(false);
  const [emailConfigForm, setEmailConfigForm] = useState({ hostname: '', domain: '', relay_host: '', relay_username: '', relay_password: '' });
  const [sendEmailForm, setSendEmailForm] = useState({
    to: '',
    from: '',
    from_name: '',
    subject: '',
    body: '',
  });

  useEffect(() => {
    if (zoneId && zones) {
      const zone = zones.find(z => z.id === zoneId);
      if (zone) {
        setSelectedZone(zone);
      }
    } else if (zones && zones.length > 0 && !selectedZone) {
      setSelectedZone(zones[0]);
    }
  }, [zoneId, zones]);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

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
    try {
      const email = `${emailForm.emailPrefix}@${selectedZone.name}`;
      await createEmailAddress.mutateAsync({
        zoneId: selectedZone.id,
        email,
        destination: emailForm.destination,
      });
      showNotification('success', 'Email address created');
      setShowEmailDialog(false);
      setEmailForm({ emailPrefix: '', destination: '' });
      refetchEmailAddresses();
    } catch (error: any) {
      showNotification('error', error.response?.data?.error || 'Failed to create email address');
    }
  };

  const handleDeleteEmail = async () => {
    if (!deleteEmailConfirm || !selectedZone) return;
    try {
      await deleteEmailAddress.mutateAsync({
        zoneId: selectedZone.id,
        tag: deleteEmailConfirm.tag,
      });
      showNotification('success', 'Email address deleted');
      setDeleteEmailConfirm(null);
      refetchEmailAddresses();
    } catch (error: any) {
      showNotification('error', error.response?.data?.error || 'Failed to delete email address');
    }
  };

  if (zonesLoading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <RefreshCw className="h-12 w-12 mx-auto mb-4 text-muted-foreground animate-spin" />
              <p className="text-muted-foreground">Loading zones...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!zones || zones.length === 0) {
    return (
      <div className="space-y-4">
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
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/cloudflare')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Cloudflare
          </Button>
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            <h1 className="text-2xl font-bold">Email Routing</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {zones && zones.length > 0 && (
            <select
              value={selectedZone?.id || ''}
              onChange={(e) => {
                const zone = zones.find(z => z.id === e.target.value);
                if (zone) setSelectedZone(zone);
              }}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {zones.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {selectedZone && (
        <Card>
          <CardHeader>
            <CardTitle>{selectedZone.name} - Email Routing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Receiving (Cloudflare)</p>
                <Badge variant={emailRoutingStatus?.enabled ? 'default' : 'secondary'}>
                  {emailRoutingStatus?.enabled ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>
              {!emailRoutingStatus?.enabled && (
                <Button onClick={handleEnableEmailRouting} size="sm">
                  Enable Receiving
                </Button>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Sending (Local Server)</p>
                <Badge variant={emailConfig?.configured ? 'default' : 'secondary'}>
                  {emailConfig?.configured ? 'Configured' : 'Not Configured'}
                </Badge>
              </div>
              <Button onClick={() => setShowEmailConfigDialog(true)} size="sm" variant="outline">
                Configure Sending
              </Button>
            </div>

            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Email Addresses</h3>
                <Button onClick={() => setShowEmailDialog(true)} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Email
                </Button>
              </div>

              {emailAddresses && emailAddresses.length > 0 ? (
                <div className="space-y-2">
                  {emailAddresses.map((addr) => (
                    <div key={addr.tag} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{addr.email}</p>
                        {addr.destination && (
                          <p className="text-sm text-muted-foreground">→ {addr.destination}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSendEmailForm({ ...sendEmailForm, from: addr.email });
                            setShowSendEmailDialog(true);
                          }}
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setDeleteEmailConfirm(addr)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No email addresses configured</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {showEmailDialog && selectedZone && (
        <Card className="border-primary bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">Add Email Address</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowEmailDialog(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <form onSubmit={handleCreateEmail} className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Email Prefix</label>
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
              <div>
                <label className="text-sm font-medium mb-2 block">Forward To</label>
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={emailForm.destination}
                  onChange={(e) => setEmailForm({ ...emailForm, destination: e.target.value })}
                  required
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={createEmailAddress.isPending}>
                  {createEmailAddress.isPending ? 'Creating...' : 'Create'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowEmailDialog(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {deleteEmailConfirm && (
        <Card className="border-red-500 bg-red-50">
          <CardContent className="pt-6">
            <p className="mb-4">Are you sure you want to delete {deleteEmailConfirm.email}?</p>
            <div className="flex gap-2">
              <Button variant="destructive" onClick={handleDeleteEmail}>
                Delete
              </Button>
              <Button variant="outline" onClick={() => setDeleteEmailConfirm(null)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

