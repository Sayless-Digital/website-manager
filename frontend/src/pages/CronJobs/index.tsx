import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Clock, Plus, RefreshCw, Trash2, Search, X, Save, FileCode, Sparkles, Globe } from 'lucide-react';
import { 
  useCronJobs, 
  useCreateCronJob, 
  useDeleteCronJob, 
  useToggleCronJob 
} from '@/features/cron/hooks/useCronJobs';
import { useSites } from '@/features/sites/hooks/useSites';
import { showNotification } from '@/lib/notifications';
import { cn } from '@/lib/utils/cn';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Types for tabs
interface CreateTab {
  id: string;
  name: string;
  schedule: string;
  command: string;
  comment: string;
  enabled: boolean;
  isDirty: boolean;
}

interface TemplateTab {
  id: string;
  name: string;
  selectedSite: string;
}

// Cron job templates
interface CronTemplate {
  id: string;
  name: string;
  description: string;
  schedule: string;
  command: string;
  comment: string;
  requiresWordPress?: boolean;
}

const CRON_TEMPLATES: CronTemplate[] = [
  {
    id: 'wp-core',
    name: 'WordPress Core Cron',
    description: 'Runs WordPress built-in cron jobs (wp-cron.php)',
    schedule: '*/15 * * * *',
    command: 'cd {PUBLIC_HTML} && /usr/bin/php -q wp-cron.php >/dev/null 2>&1',
    comment: 'WordPress core cron (runs every 15 minutes)',
    requiresWordPress: true,
  },
  {
    id: 'wp-core-hourly',
    name: 'WordPress Core Cron (Hourly)',
    description: 'Runs WordPress cron jobs hourly',
    schedule: '0 * * * *',
    command: 'cd {PUBLIC_HTML} && /usr/bin/php -q wp-cron.php >/dev/null 2>&1',
    comment: 'WordPress core cron (hourly)',
    requiresWordPress: true,
  },
  {
    id: 'woocommerce',
    name: 'WooCommerce Scheduled Actions',
    description: 'Runs WooCommerce scheduled actions and events',
    schedule: '*/5 * * * *',
    command: 'cd {PUBLIC_HTML} && /usr/bin/php -q wp-cron.php >/dev/null 2>&1',
    comment: 'WooCommerce scheduled actions (runs every 5 minutes)',
    requiresWordPress: true,
  },
  {
    id: 'wp-backup',
    name: 'WordPress Backup',
    description: 'Creates a backup of WordPress files and database',
    schedule: '0 2 * * *',
    command: '/usr/bin/php {PUBLIC_HTML}/wp-content/plugins/backup-plugin/backup.php',
    comment: 'Daily WordPress backup at 2 AM',
    requiresWordPress: true,
  },
  {
    id: 'wp-updates',
    name: 'WordPress Update Check',
    description: 'Checks for WordPress, theme, and plugin updates (requires WP-CLI)',
    schedule: '0 3 * * 0',
    command: 'cd {PUBLIC_HTML} && /usr/bin/wp core update-check --allow-root',
    comment: 'Weekly WordPress update check (Sunday 3 AM)',
    requiresWordPress: true,
  },
  {
    id: 'wp-optimize',
    name: 'WordPress Database Optimization',
    description: 'Optimizes WordPress database tables (requires WP-CLI)',
    schedule: '0 4 * * 0',
    command: 'cd {PUBLIC_HTML} && /usr/bin/wp db optimize --allow-root',
    comment: 'Weekly database optimization (Sunday 4 AM)',
    requiresWordPress: true,
  },
  {
    id: 'wp-cache-clear',
    name: 'WordPress Cache Clear',
    description: 'Clears WordPress cache (works with most caching plugins, requires WP-CLI)',
    schedule: '0 */6 * * *',
    command: 'cd {PUBLIC_HTML} && /usr/bin/wp cache flush --allow-root',
    comment: 'Clear WordPress cache every 6 hours',
    requiresWordPress: true,
  },
  {
    id: 'general-backup',
    name: 'General Site Backup',
    description: 'Creates a backup of site files using tar',
    schedule: '0 2 * * *',
    command: 'tar -czf /backups/{DOMAIN}-$(date +\\%Y\\%m\\%d).tar.gz {PUBLIC_HTML}',
    comment: 'Daily site backup at 2 AM',
    requiresWordPress: false,
  },
  {
    id: 'log-cleanup',
    name: 'Log Cleanup',
    description: 'Cleans old log files from the site directory',
    schedule: '0 3 * * 0',
    command: 'find {PUBLIC_HTML} -name "*.log" -mtime +30 -delete',
    comment: 'Weekly log cleanup (removes logs older than 30 days)',
    requiresWordPress: false,
  },
];

export default function CronJobs() {
  const [activeTab, setActiveTab] = useState('jobs');
  const [searchQuery, setSearchQuery] = useState('');
  const [createTabs, setCreateTabs] = useState<CreateTab[]>([]);
  const [templateTabs, setTemplateTabs] = useState<TemplateTab[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; job: any | null }>({ 
    show: false, 
    job: null 
  });

  // Hooks
  const { data: cronJobs, isLoading, refetch } = useCronJobs();
  const { data: sites } = useSites();
  const createCronJob = useCreateCronJob();
  const deleteCronJob = useDeleteCronJob();
  const toggleCronJob = useToggleCronJob();

  // Filter cron jobs
  const filteredJobs = useMemo(() => {
    if (!cronJobs || !Array.isArray(cronJobs)) return [];
    if (!searchQuery) return cronJobs;
    const query = searchQuery.toLowerCase();
    return cronJobs.filter((job) => 
      job.command?.toLowerCase().includes(query) ||
      job.schedule?.toLowerCase().includes(query) ||
      job.comment?.toLowerCase().includes(query)
    );
  }, [cronJobs, searchQuery]);

  // Stats
  const stats = useMemo(() => {
    if (!cronJobs || !Array.isArray(cronJobs)) return { total: 0, enabled: 0, disabled: 0 };
    return {
      total: cronJobs.length,
      enabled: cronJobs.filter(j => j.enabled).length,
      disabled: cronJobs.filter(j => !j.enabled).length,
    };
  }, [cronJobs]);

  // Filter sites based on template requirements
  const getAvailableSites = (requiresWordPress?: boolean) => {
    if (!sites) return [];
    if (requiresWordPress) {
      return sites.filter(site => site.wordpress_detected);
    }
    return sites;
  };

  // Handle creating new cron job tab
  const handleNewCronJob = () => {
    const newTabId = `create-${Date.now()}`;
    const newTab: CreateTab = {
      id: newTabId,
      name: `New Cron Job ${createTabs.length + 1}`,
      schedule: '',
      command: '',
      comment: '',
      enabled: true,
      isDirty: false
    };
    setCreateTabs([...createTabs, newTab]);
    setActiveTab(newTabId);
  };

  // Handle opening templates tab
  const handleOpenTemplates = () => {
    const newTabId = `templates-${Date.now()}`;
    const newTab: TemplateTab = {
      id: newTabId,
      name: 'Templates',
      selectedSite: ''
    };
    setTemplateTabs([...templateTabs, newTab]);
    setActiveTab(newTabId);
  };

  // Handle closing template tab
  const handleCloseTemplateTab = (tabId: string) => {
    setTemplateTabs(prev => prev.filter(t => t.id !== tabId));
    if (activeTab === tabId) {
      const remainingTabs = templateTabs.filter(t => t.id !== tabId);
      if (remainingTabs.length > 0) {
        setActiveTab(remainingTabs[0].id);
      } else if (createTabs.length > 0) {
        setActiveTab(createTabs[0].id);
      } else {
        setActiveTab('jobs');
      }
    }
  };

  // Handle generating template cron job
  const handleGenerateTemplate = (template: CronTemplate, tabId: string) => {
    const templateTab = templateTabs.find(t => t.id === tabId);
    if (!templateTab || !templateTab.selectedSite) {
      showNotification('error', 'Please select a site first');
      return;
    }

    const site = sites?.find(s => s.domain === templateTab.selectedSite);
    if (!site) {
      showNotification('error', 'Site not found');
      return;
    }

    if (template.requiresWordPress && !site.wordpress_detected) {
      showNotification('error', 'This template requires WordPress. Selected site is not a WordPress site.');
      return;
    }

    // Replace placeholders in command
    let command = template.command.replace(/{PUBLIC_HTML}/g, site.public_html);
    command = command.replace(/{DOMAIN}/g, site.domain);
    
    // Replace {PHP} placeholder if exists (common PHP path)
    command = command.replace(/{PHP}/g, '/usr/bin/php');

    // Replace placeholders in comment
    let comment = template.comment.replace(/{DOMAIN}/g, site.domain);

    const newTabId = `create-${Date.now()}`;
    const newTab: CreateTab = {
      id: newTabId,
      name: template.name,
      schedule: template.schedule,
      command: command,
      comment: comment,
      enabled: true,
      isDirty: false
    };
    
    setCreateTabs([...createTabs, newTab]);
    setActiveTab(newTabId);
    showNotification('success', `Template "${template.name}" loaded. Review and save when ready.`);
  };

  // Handle closing create tab
  const handleCloseTab = (tabId: string) => {
    const tab = createTabs.find(t => t.id === tabId);
    if (tab?.isDirty) {
      if (!confirm(`Discard changes to ${tab.name}?`)) {
        return;
      }
    }
    const newTabs = createTabs.filter(t => t.id !== tabId);
    setCreateTabs(newTabs);
    if (activeTab === tabId) {
      setActiveTab(newTabs.length > 0 ? newTabs[newTabs.length - 1].id : 'jobs');
    }
  };

  // Handle save cron job
  const handleSaveCronJob = async (tabId: string) => {
    const tab = createTabs.find(t => t.id === tabId);
    if (!tab) return;
    
    if (!tab.schedule || !tab.command) {
      showNotification('error', 'Schedule and command are required');
      return;
    }

    createCronJob.mutate({
      schedule: tab.schedule,
      command: tab.command,
      comment: tab.comment || undefined,
      enabled: tab.enabled
    }, {
      onSuccess: () => {
        showNotification('success', 'Cron job created successfully');
        handleCloseTab(tabId);
      },
      onError: (error: any) => {
        showNotification('error', error.response?.data?.error || 'Failed to create cron job');
      }
    });
  };

  // Handle delete cron job
  const handleDeleteCronJob = async () => {
    if (!deleteConfirm.job) return;
    
    deleteCronJob.mutate(deleteConfirm.job.raw, {
      onSuccess: () => {
        showNotification('success', 'Cron job deleted successfully');
        setDeleteConfirm({ show: false, job: null });
      },
      onError: (error: any) => {
        showNotification('error', error.response?.data?.error || 'Failed to delete cron job');
      }
    });
  };

  // Handle toggle cron job
  const handleToggleCronJob = (job: any) => {
    toggleCronJob.mutate({
      rawLine: job.raw,
      enabled: !job.enabled
    }, {
      onSuccess: () => {
        showNotification('success', `Cron job ${!job.enabled ? 'enabled' : 'disabled'} successfully`);
      },
      onError: (error: any) => {
        showNotification('error', error.response?.data?.error || 'Failed to update cron job');
      }
    });
  };

  // Handle refresh
  const handleRefresh = () => {
    refetch();
  };

  // Show create tab if active
  const isCreateTab = createTabs.find(t => t.id === activeTab);
  const isTemplateTab = templateTabs.find(t => t.id === activeTab);
  
  if (isCreateTab) {
    const tab = createTabs.find(t => t.id === activeTab);
    if (!tab) return null;

    return (
      <div className="h-[calc(100vh-8rem)] flex flex-col gap-6 min-h-0">
        {/* Tab Bar */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('jobs')}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg transition-colors",
              activeTab === 'jobs'
                ? "bg-amber-50 border-amber-200 text-foreground"
                : "bg-background border-border hover:bg-muted/50"
            )}
          >
            <Clock className="h-3.5 w-3.5" />
            <span>Cron Jobs</span>
          </button>
          {templateTabs.map(tab => (
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
              <Sparkles className="h-3.5 w-3.5" />
              <span>{tab.name}</span>
              <div
                role="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCloseTemplateTab(tab.id);
                }}
                className="hover:bg-muted rounded p-0.5 ml-1"
              >
                <X className="h-3 w-3" />
              </div>
            </button>
          ))}
          {createTabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg transition-colors",
                activeTab === t.id
                  ? "bg-amber-50 border-amber-200 text-foreground"
                  : "bg-background border-border hover:bg-muted/50"
              )}
            >
              <FileCode className="h-3.5 w-3.5" />
              <span className="max-w-[150px] truncate">{t.name}</span>
              {t.isDirty && <span className="h-1.5 w-1.5 rounded-full bg-yellow-500" />}
              <div
                role="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCloseTab(t.id);
                }}
                className="hover:bg-muted rounded p-0.5 ml-1"
              >
                <X className="h-3 w-3" />
              </div>
            </button>
          ))}
        </div>

        {/* Create Form */}
        <Card className="flex-1 min-h-0 overflow-auto">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Create Cron Job</CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCloseTab(tab.id)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleSaveCronJob(tab.id)}
                  disabled={createCronJob.isPending || !tab.schedule || !tab.command}
                >
                  {createCronJob.isPending ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Schedule *</label>
              <Input
                placeholder="0 * * * * or @daily, @hourly, etc."
                value={tab.schedule}
                onChange={(e) => {
                  setCreateTabs(prev => prev.map(t => 
                    t.id === tab.id 
                      ? { ...t, schedule: e.target.value, isDirty: true }
                      : t
                  ));
                }}
              />
              <p className="text-xs text-muted-foreground">
                Cron format: minute hour day month weekday (e.g., "0 * * * *" for hourly)
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Command *</label>
              <textarea
                className="w-full min-h-[100px] px-3 py-2 text-sm border rounded-md font-mono resize-none"
                placeholder="/usr/bin/php /path/to/script.php"
                value={tab.command}
                onChange={(e) => {
                  setCreateTabs(prev => prev.map(t => 
                    t.id === tab.id 
                      ? { ...t, command: e.target.value, isDirty: true }
                      : t
                  ));
                }}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Comment (Optional)</label>
              <Input
                placeholder="Description of this cron job"
                value={tab.comment}
                onChange={(e) => {
                  setCreateTabs(prev => prev.map(t => 
                    t.id === tab.id 
                      ? { ...t, comment: e.target.value, isDirty: true }
                      : t
                  ));
                }}
              />
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="text-sm font-medium">Enabled</p>
                <p className="text-xs text-muted-foreground">Disable to prevent this job from running</p>
              </div>
              <Switch
                checked={tab.enabled}
                onCheckedChange={(checked) => {
                  setCreateTabs(prev => prev.map(t => 
                    t.id === tab.id 
                      ? { ...t, enabled: checked, isDirty: true }
                      : t
                  ));
                }}
              />
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
              <p className="font-semibold mb-2">Preview:</p>
              <code className="block bg-blue-100 px-2 py-1 rounded font-mono text-xs">
                {tab.schedule || '* * * * *'} {tab.command || 'command'}
              </code>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main Jobs view
  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col gap-6 min-h-0">
      {/* Overview Cards */}
      {activeTab === 'jobs' && (
      <div className="grid grid-cols-3 gap-4 flex-shrink-0">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Jobs</p>
                <p className="text-lg font-semibold">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Clock className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Enabled</p>
                <p className="text-lg font-semibold">{stats.enabled}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gray-500/10">
                <Clock className="h-5 w-5 text-gray-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Disabled</p>
                <p className="text-lg font-semibold">{stats.disabled}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      )}

      {/* Tab Bar */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={() => setActiveTab('jobs')}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg transition-colors",
            activeTab === 'jobs'
              ? "bg-amber-50 border-amber-200 text-foreground"
              : "bg-background border-border hover:bg-muted/50"
          )}
        >
          <Clock className="h-3.5 w-3.5" />
          <span>Cron Jobs</span>
        </button>
        {templateTabs.map(tab => (
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
            <Sparkles className="h-3.5 w-3.5" />
            <span>{tab.name}</span>
            <div
              role="button"
              onClick={(e) => {
                e.stopPropagation();
                handleCloseTemplateTab(tab.id);
              }}
              className="hover:bg-muted rounded p-0.5 ml-1"
            >
              <X className="h-3 w-3" />
            </div>
          </button>
        ))}
        {createTabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg transition-colors",
              activeTab === t.id
                ? "bg-amber-50 border-amber-200 text-foreground"
                : "bg-background border-border hover:bg-muted/50"
            )}
          >
            <FileCode className="h-3.5 w-3.5" />
            <span className="max-w-[150px] truncate">{t.name}</span>
            {t.isDirty && <span className="h-1.5 w-1.5 rounded-full bg-yellow-500" />}
            <div
              role="button"
              onClick={(e) => {
                e.stopPropagation();
                handleCloseTab(t.id);
              }}
              className="hover:bg-muted rounded p-0.5 ml-1"
            >
              <X className="h-3 w-3" />
            </div>
          </button>
        ))}
      </div>

      {/* Search and Actions Bar */}
      {activeTab === 'jobs' && !createTabs.find(t => t.id === activeTab) && !templateTabs.find(t => t.id === activeTab) && (
      <div className="flex items-center gap-4 flex-shrink-0">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={activeTab === 'jobs' ? "Search cron jobs..." : templateTabs.find(t => t.id === activeTab) ? "Search templates..." : "Search..."}
            value={activeTab === 'jobs' ? searchQuery : ''}
            onChange={(e) => {
              if (activeTab === 'jobs') {
                setSearchQuery(e.target.value);
              }
            }}
            className="pl-10"
            readOnly={activeTab !== 'jobs'}
          />
        </div>
        <div className="flex items-center gap-2">
          {activeTab === 'jobs' && (
            <>
              <Button variant="outline" size="sm" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={handleOpenTemplates}>
                <Sparkles className="h-4 w-4 mr-2" />
                Templates
              </Button>
              <Button size="sm" onClick={handleNewCronJob}>
                <Plus className="h-4 w-4 mr-2" />
                New Cron Job
              </Button>
            </>
          )}
          {templateTabs.find(t => t.id === activeTab) && (
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          )}
          {createTabs.find(t => t.id === activeTab) && (
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          )}
        </div>
      </div>
      )}

      {/* Templates Tab */}
      {templateTabs.find(t => t.id === activeTab) && (() => {
        const currentTemplateTab = templateTabs.find(t => t.id === activeTab);
        if (!currentTemplateTab) return null;
        
        return (
        <div className="flex-1 min-h-0 overflow-auto">
    <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Generate Cron Job from Template</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Select Site *</label>
                  <Select 
                    value={currentTemplateTab.selectedSite} 
                    onValueChange={(value) => {
                      setTemplateTabs(prev => prev.map(t => 
                        t.id === currentTemplateTab.id 
                          ? { ...t, selectedSite: value }
                          : t
                      ));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a site" />
                    </SelectTrigger>
                    <SelectContent>
                      {sites?.map((site) => (
                        <SelectItem key={site.domain} value={site.domain}>
                          <div className="flex items-center gap-2">
                            <Globe className="h-4 w-4" />
                            <span>{site.domain}</span>
                            {site.wordpress_detected && (
                              <Badge variant="outline" className="ml-2">WordPress</Badge>
                    )}
                  </div>
                        </SelectItem>
                      ))}
                      {(!sites || sites.length === 0) && (
                        <SelectItem value="none" disabled>No sites found</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Select a site to generate cron jobs for. WordPress templates require a WordPress site.
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Available Templates</h3>
              <div className="grid gap-4 md:grid-cols-2">
                {CRON_TEMPLATES.map((template) => {
                  const site = sites?.find(s => s.domain === currentTemplateTab.selectedSite);
                  const canUse = currentTemplateTab.selectedSite && (!template.requiresWordPress || site?.wordpress_detected);
                  
                  return (
                    <Card 
                      key={template.id}
                      className={cn(
                        "transition-colors",
                        canUse 
                          ? "cursor-pointer hover:bg-muted/50 hover:border-primary/50" 
                          : "opacity-60 cursor-not-allowed"
                      )}
                      onClick={() => canUse && handleGenerateTemplate(template, currentTemplateTab.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-semibold text-sm">{template.name}</h4>
                              {template.requiresWordPress && (
                                <Badge variant="outline" className="text-xs">WordPress</Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mb-3">
                              {template.description}
                            </p>
                            <div className="flex items-center gap-2 text-xs mb-2">
                              <span className="font-mono bg-muted px-2 py-1 rounded">
                                {template.schedule}
                              </span>
                            </div>
                            {currentTemplateTab.selectedSite && template.requiresWordPress && !site?.wordpress_detected && (
                              <p className="text-xs text-destructive mt-2">
                                ⚠ This template requires WordPress. Selected site is not a WordPress site.
                              </p>
                            )}
                            {currentTemplateTab.selectedSite && (!template.requiresWordPress || site?.wordpress_detected) && (
                              <div className="mt-3">
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleGenerateTemplate(template, currentTemplateTab.id);
                                  }}
                                >
                                  <Sparkles className="h-3.5 w-3.5 mr-2" />
                                  Use Template
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                    </div>
                  </div>
                      </div>
                    </div>
        );
      })()}

      {/* Jobs Table */}
      {activeTab === 'jobs' && (
      <div className="border rounded-lg overflow-hidden min-h-[52vh] h-[52vh] flex-shrink-0">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <Clock className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {searchQuery ? 'No cron jobs found matching your search' : 'No cron jobs found'}
            </p>
            {!searchQuery && (
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={handleNewCronJob}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Cron Job
              </Button>
            )}
          </div>
        ) : (
          <div className="h-full overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left border-b sticky top-0 z-10">
                <tr>
                  <th className="p-3 font-medium bg-muted">Status</th>
                  <th className="p-3 font-medium bg-muted">Schedule</th>
                  <th className="p-3 font-medium bg-muted">Command</th>
                  <th className="p-3 font-medium bg-muted">Comment</th>
                  <th className="p-3 font-medium bg-muted">User</th>
                  <th className="p-3 font-medium bg-muted">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredJobs.map((job, index) => (
                  <tr key={index} className="hover:bg-muted/50">
                    <td className="p-3">
                      <Badge variant={job.enabled ? 'default' : 'secondary'}>
                        {job.enabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <code className="text-xs font-mono bg-muted px-2 py-1 rounded">
                        {job.schedule}
                      </code>
                    </td>
                    <td className="p-3">
                      <code className="text-xs font-mono break-all">
                        {job.command}
                      </code>
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {job.comment || '-'}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {job.user || '-'}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={job.enabled}
                          onCheckedChange={() => handleToggleCronJob(job)}
                          disabled={toggleCronJob.isPending}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteConfirm({ show: true, job })}
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
                  )}
                </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirm.show && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Delete Cron Job</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Are you sure you want to delete this cron job? This action cannot be undone.
              </p>
              {deleteConfirm.job && (
                <div className="bg-muted p-3 rounded-lg">
                  <code className="text-xs font-mono break-all">
                    {deleteConfirm.job.schedule} {deleteConfirm.job.command}
                  </code>
                </div>
              )}
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setDeleteConfirm({ show: false, job: null })}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDeleteCronJob}
                  disabled={deleteCronJob.isPending}
                >
                  {deleteCronJob.isPending ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  Delete
                </Button>
                </div>
              </CardContent>
            </Card>
        </div>
      )}
    </div>
  );
}
