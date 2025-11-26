import { Menu, RefreshCw, ChevronRight } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation, Link } from 'react-router-dom';

const getPageInfo = (pathname: string) => {
  const routes: Record<string, { title: string; subtitle: string; breadcrumbs: Array<{ label: string; path: string }> }> = {
    '/': {
      title: 'Dashboard',
      subtitle: 'Overview of your website management system',
      breadcrumbs: [{ label: 'Dashboard', path: '/' }],
    },
    '/sites': {
      title: 'Websites',
      subtitle: 'Manage all your WordPress sites',
      breadcrumbs: [
        { label: 'Dashboard', path: '/' },
        { label: 'Websites', path: '/sites' },
      ],
    },
    '/services': {
      title: 'Services',
      subtitle: 'Manage system services like Apache, MySQL, and Cloudflare',
      breadcrumbs: [
        { label: 'Dashboard', path: '/' },
        { label: 'Services', path: '/services' },
      ],
    },
    '/resources': {
      title: 'System Resources',
      subtitle: 'Monitor CPU, memory, disk usage, and system performance',
      breadcrumbs: [
        { label: 'Dashboard', path: '/' },
        { label: 'Resources', path: '/resources' },
      ],
    },
    '/cron': {
      title: 'Cron Jobs',
      subtitle: 'View and manage scheduled cron jobs',
      breadcrumbs: [
        { label: 'Dashboard', path: '/' },
        { label: 'Cron Jobs', path: '/cron' },
      ],
    },
  };

  return routes[pathname] || routes['/'];
};

export function Header() {
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);
  const queryClient = useQueryClient();
  const location = useLocation();
  const pageInfo = getPageInfo(location.pathname);

  const handleRefresh = () => {
    queryClient.invalidateQueries();
  };

  return (
    <header className="sticky top-0 z-40 border-b bg-slate-900 border-slate-800">
      <div className="px-6 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={toggleSidebar}
              className="lg:hidden p-2 hover:bg-accent rounded-md"
            >
              <Menu className="h-5 w-5" />
            </button>
            
            {/* Breadcrumbs */}
            <nav className="flex items-center gap-2 text-sm text-muted-foreground">
              {pageInfo.breadcrumbs.map((crumb, index) => (
                <div key={crumb.path} className="flex items-center gap-2">
                  {index > 0 && <ChevronRight className="h-4 w-4" />}
                  {index === pageInfo.breadcrumbs.length - 1 ? (
                    <span className="text-foreground font-medium">{crumb.label}</span>
                  ) : (
                    <Link to={crumb.path} className="hover:text-foreground transition-colors">
                      {crumb.label}
                    </Link>
                  )}
                </div>
              ))}
            </nav>
          </div>
          
          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>
    </header>
  );
}