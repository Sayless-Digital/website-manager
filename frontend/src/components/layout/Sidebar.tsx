import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Home, Globe, Settings, BarChart3, Clock, Search, ChevronDown, X, Sun, Moon, ArrowLeft, FolderOpen, Info, Cloud, Mail, Database, Download, Settings as SettingsIcon } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useUIStore } from '@/store/uiStore';
import { useSites } from '@/features/sites/hooks/useSites';
import { useState, useMemo, useRef, useEffect } from 'react';

const navigation = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Websites', href: '/sites', icon: Globe },
  { name: 'Services', href: '/services', icon: Settings },
  { name: 'Resources', href: '/resources', icon: BarChart3 },
  { name: 'Cron Jobs', href: '/cron', icon: Clock },
  { name: 'Cloudflare', href: '/cloudflare', icon: Cloud },
  { name: 'Email Routing', href: '/email-routing', icon: Mail },
];

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();
  const sidebarOpen = useUIStore((state) => state.sidebarOpen);
  const { data: sites } = useSites();
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDark, setIsDark] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Check if we're on a site detail page
  const isOnSiteDetail = location.pathname.startsWith('/sites/') && params.domain;
  const currentSite = isOnSiteDetail ? sites?.find(s => s.domain === params.domain) : null;

  const filteredSites = useMemo(() => {
    if (!sites) return [];
    let filtered = sites;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = sites.filter(site =>
        site.domain.toLowerCase().includes(query)
      );
    }
    
    // Sort alphabetically by domain
    return filtered.sort((a, b) => a.domain.localeCompare(b.domain));
  }, [sites, searchQuery]);

  const handleSiteSelect = (domain: string) => {
    navigate(`/sites/${domain}`);
    setShowDropdown(false);
    setSearchQuery('');
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Initialize theme from localStorage or default
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const isDarkMode = savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches);
    setIsDark(isDarkMode);
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, []);

  const toggleTheme = () => {
    const newIsDark = !isDark;
    setIsDark(newIsDark);
    document.documentElement.classList.toggle('dark', newIsDark);
    localStorage.setItem('theme', newIsDark ? 'dark' : 'light');
  };

  return (
    <>
      <aside
        className={cn(
          'dark fixed inset-y-0 left-0 z-50 w-64 bg-sidebar text-sidebar-foreground transition-transform duration-300 lg:translate-x-0 flex flex-col',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Search - Always at top */}
        <div className="p-3 pt-4 relative" ref={dropdownRef}>
          <div className={cn(
            "relative rounded-lg overflow-hidden",
            showDropdown && filteredSites.length > 0 ? "ring-1 ring-primary" : ""
          )}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
              <input
                type="text"
                placeholder="Jump to website..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setShowDropdown(true)}
                className={cn(
                  "w-full pl-9 pr-10 py-2 text-sm bg-sidebar-accent border border-sidebar-border text-sidebar-foreground placeholder-muted-foreground focus:outline-none transition-colors",
                  showDropdown && filteredSites.length > 0
                    ? "rounded-t-lg border-b-0"
                    : "rounded-lg focus:border-primary"
                )}
              />
              {searchQuery || showDropdown ? (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    setShowDropdown(false);
                    setSearchQuery('');
                  }}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-sidebar-foreground transition-colors z-10"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : (
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
              )}
            </div>
            
            {showDropdown && filteredSites.length > 0 && (
              <div className="bg-sidebar-accent border-t border-sidebar-border">
                <div className="max-h-64 overflow-y-auto">
                  {filteredSites.map((site) => (
                    <button
                      key={site.domain}
                      onClick={() => handleSiteSelect(site.domain)}
                      className="w-full px-3 py-2 text-left hover:bg-sidebar transition-colors border-b border-sidebar-border last:border-b-0 flex items-center gap-2"
                    >
                      {site.wordpress_detected && (
                        <svg className="h-4 w-4 text-primary shrink-0" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M21.469 6.825c.84 1.537 1.318 3.3 1.318 5.175 0 3.979-2.156 7.456-5.363 9.325l3.295-9.527c.615-1.54.82-2.771.82-3.864 0-.405-.026-.78-.07-1.11m-7.981.105c.647-.03 1.232-.105 1.232-.105.582-.075.514-.93-.067-.899 0 0-1.755.135-2.88.135-1.064 0-2.85-.15-2.85-.15-.585-.03-.661.855-.075.885 0 0 .54.061 1.125.09l1.68 4.605-2.37 7.08L5.354 6.9c.649-.03 1.234-.1 1.234-.1.585-.075.516-.93-.065-.896 0 0-1.746.138-2.874.138-.2 0-.438-.008-.69-.015C5.46 3.15 8.515 1.5 11.998 1.5c2.613 0 4.99.996 6.781 2.625-.043-.008-.084-.015-.123-.015-1.062 0-1.817.923-1.817 1.914 0 .888.513 1.643 1.058 2.533.411.72.89 1.643.89 2.977 0 .915-.354 1.994-.821 3.479l-1.075 3.585-3.9-11.61.001.014zM12 22.784c-1.059 0-2.081-.153-3.048-.437l3.237-9.406 3.315 9.087c.024.053.05.101.078.149-1.12.393-2.325.607-3.582.607M1.211 12c0-1.564.336-3.05.935-4.39L7.29 21.709C3.694 19.96 1.212 16.271 1.212 12M12 0C5.385 0 0 5.385 0 12s5.385 12 12 12 12-5.385 12-12S18.615 0 12 0"/>
                        </svg>
                      )}
                      <div className="font-medium text-sm text-sidebar-foreground truncate">{site.domain}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Current Site Section with Navigation */}
        {isOnSiteDetail && currentSite && (
          <div className="px-3 pb-3">
            <div className="rounded-lg bg-sidebar-accent/50 p-3 space-y-2">
              <button
                onClick={() => navigate('/sites')}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-sidebar text-muted-foreground hover:text-sidebar-foreground transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="text-sm font-medium">Back to Sites</span>
              </button>
              
              <div className="flex items-center gap-2 px-2">
                {currentSite.wordpress_detected && (
                  <svg className="h-4 w-4 text-primary shrink-0" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M21.469 6.825c.84 1.537 1.318 3.3 1.318 5.175 0 3.979-2.156 7.456-5.363 9.325l3.295-9.527c.615-1.54.82-2.771.82-3.864 0-.405-.026-.78-.07-1.11m-7.981.105c.647-.03 1.232-.105 1.232-.105.582-.075.514-.93-.067-.899 0 0-1.755.135-2.88.135-1.064 0-2.85-.15-2.85-.15-.585-.03-.661.855-.075.885 0 0 .54.061 1.125.09l1.68 4.605-2.37 7.08L5.354 6.9c.649-.03 1.234-.1 1.234-.1.585-.075.516-.93-.065-.896 0 0-1.746.138-2.874.138-.2 0-.438-.008-.69-.015C5.46 3.15 8.515 1.5 11.998 1.5c2.613 0 4.99.996 6.781 2.625-.043-.008-.084-.015-.123-.015-1.062 0-1.817.923-1.817 1.914 0 .888.513 1.643 1.058 2.533.411.72.89 1.643.89 2.977 0 .915-.354 1.994-.821 3.479l-1.075 3.585-3.9-11.61.001.014zM12 22.784c-1.059 0-2.081-.153-3.048-.437l3.237-9.406 3.315 9.087c.024.053.05.101.078.149-1.12.393-2.325.607-3.582.607M1.211 12c0-1.564.336-3.05.935-4.39L7.29 21.709C3.694 19.96 1.212 16.271 1.212 12M12 0C5.385 0 0 5.385 0 12s5.385 12 12 12 12-5.385 12-12S18.615 0 12 0"/>
                  </svg>
                )}
                <p className="text-sm font-semibold text-sidebar-foreground truncate">
                  {currentSite.domain}
                </p>
              </div>

              <div className="space-y-1">
                <Link
                  to={`/sites/${currentSite.domain}`}
                  className={cn(
                    'flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors text-sm',
                    location.pathname === `/sites/${currentSite.domain}` && !location.pathname.includes('/files') && !location.pathname.includes('/database') && !location.pathname.includes('/backups') && !location.pathname.includes('/wordpress')
                      ? 'bg-sidebar text-sidebar-foreground'
                      : 'text-muted-foreground hover:bg-sidebar hover:text-sidebar-foreground'
                  )}
                >
                  <Info className="h-4 w-4" />
                  <span className="font-medium">Overview</span>
                </Link>
                <Link
                  to={`/sites/${currentSite.domain}/files`}
                  className={cn(
                    'flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors text-sm',
                    location.pathname === `/sites/${currentSite.domain}/files`
                      ? 'bg-sidebar text-sidebar-foreground'
                      : 'text-muted-foreground hover:bg-sidebar hover:text-sidebar-foreground'
                  )}
                >
                  <FolderOpen className="h-4 w-4" />
                  <span className="font-medium">Files</span>
                </Link>
                {currentSite.databases && currentSite.databases.length > 0 && (
                  <>
                    <Link
                      to={`/sites/${currentSite.domain}/database`}
                      className={cn(
                        'flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors text-sm',
                        location.pathname === `/sites/${currentSite.domain}/database`
                          ? 'bg-sidebar text-sidebar-foreground'
                          : 'text-muted-foreground hover:bg-sidebar hover:text-sidebar-foreground'
                      )}
                    >
                      <Database className="h-4 w-4" />
                      <span className="font-medium">Database</span>
                    </Link>
                    <Link
                      to={`/sites/${currentSite.domain}/backups`}
                      className={cn(
                        'flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors text-sm',
                        location.pathname === `/sites/${currentSite.domain}/backups`
                          ? 'bg-sidebar text-sidebar-foreground'
                          : 'text-muted-foreground hover:bg-sidebar hover:text-sidebar-foreground'
                      )}
                    >
                      <Download className="h-4 w-4" />
                      <span className="font-medium">Backups</span>
                    </Link>
                  </>
                )}
                {currentSite.wordpress_detected && (
                  <Link
                    to={`/sites/${currentSite.domain}/wordpress`}
                    className={cn(
                      'flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors text-sm',
                      location.pathname === `/sites/${currentSite.domain}/wordpress`
                        ? 'bg-sidebar text-sidebar-foreground'
                        : 'text-muted-foreground hover:bg-sidebar hover:text-sidebar-foreground'
                    )}
                  >
                    <SettingsIcon className="h-4 w-4" />
                    <span className="font-medium">WordPress</span>
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}

        <nav className="px-3 pb-3 pt-2 space-y-1">

          {/* Main navigation */}
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="font-medium">{item.name}</span>
              </Link>
            );
          })}
        </nav>
        
        <div className="p-3 mt-auto border-t border-sidebar-border shrink-0">
          <button
            onClick={toggleTheme}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-sidebar-accent hover:bg-sidebar text-sidebar-foreground transition-colors"
          >
            {isDark ? (
              <>
                <Sun className="h-4 w-4" />
                <span className="text-sm font-medium">Light Mode</span>
              </>
            ) : (
              <>
                <Moon className="h-4 w-4" />
                <span className="text-sm font-medium">Dark Mode</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}