import { useState, useMemo } from 'react';
import { Search, Filter, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SiteCard } from '@/components/sites/SiteCard';
import { useSites } from '@/features/sites/hooks/useSites';

type FilterType = 'all' | 'active' | 'inactive' | 'wordpress';

export default function Sites() {
  const { data: sites, isLoading, error } = useSites();
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');

  // Filter and search sites
  const filteredSites = useMemo(() => {
    if (!sites) return [];

    let filtered = sites;

    // Apply status filter
    if (filter === 'active') {
      filtered = filtered.filter(site => site.status === 'active');
    } else if (filter === 'inactive') {
      filtered = filtered.filter(site => site.status !== 'active');
    } else if (filter === 'wordpress') {
      filtered = filtered.filter(site => site.wordpress_detected);
    }

    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(site =>
        site.domain.toLowerCase().includes(query) ||
        site.path.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [sites, filter, searchQuery]);

  // Count sites by status
  const counts = useMemo(() => {
    if (!sites) return { all: 0, active: 0, inactive: 0, wordpress: 0 };
    return {
      all: sites.length,
      active: sites.filter(s => s.status === 'active').length,
      inactive: sites.filter(s => s.status !== 'active').length,
      wordpress: sites.filter(s => s.wordpress_detected).length,
    };
  }, [sites]);

  if (isLoading) {
    return null; // Let router's Suspense handle loading
  }

  return (
    <div className="space-y-6">
      {/* Search and Filter Bar */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by domain or path..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
            className="gap-2"
          >
            All
            <Badge variant={filter === 'all' ? 'secondary' : 'outline'} className="ml-1">
              {counts.all}
            </Badge>
          </Button>
          <Button
            variant={filter === 'active' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('active')}
            className="gap-2"
          >
            Active
            <Badge variant={filter === 'active' ? 'secondary' : 'outline'} className="ml-1">
              {counts.active}
            </Badge>
          </Button>
          <Button
            variant={filter === 'inactive' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('inactive')}
            className="gap-2"
          >
            Inactive
            <Badge variant={filter === 'inactive' ? 'secondary' : 'outline'} className="ml-1">
              {counts.inactive}
            </Badge>
          </Button>
          <Button
            variant={filter === 'wordpress' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('wordpress')}
            className="gap-2"
          >
            WordPress
            <Badge variant={filter === 'wordpress' ? 'secondary' : 'outline'} className="ml-1">
              {counts.wordpress}
            </Badge>
          </Button>
        </div>
      </div>

      {/* Sites Grid */}
      {filteredSites.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {filteredSites.map((site) => (
            <SiteCard key={site.domain} site={site} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-card rounded-lg border">
          <Filter className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No sites found</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            {searchQuery
              ? `No sites match your search for "${searchQuery}"`
              : 'No sites found with the selected filter'}
          </p>
          {searchQuery && (
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => setSearchQuery('')}
            >
              Clear search
            </Button>
          )}
        </div>
      )}
    </div>
  );
}