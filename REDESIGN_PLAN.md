# Website Manager Frontend Redesign Plan

## Executive Summary

This document outlines the comprehensive redesign of the Website Manager frontend using modern technologies: **React 18**, **TypeScript**, **Vite**, and **Shadcn/ui**. The redesign will transform the current vanilla JavaScript/Flask template application into a modern, type-safe, maintainable single-page application (SPA) with improved developer experience and user interface.

---

## 1. Technology Stack

### Core Technologies
- **React 18.3+** - UI library with concurrent features
- **TypeScript 5.3+** - Type safety and enhanced IDE support
- **Vite 5+** - Lightning-fast build tool and dev server
- **React Router v6** - Client-side routing

### UI Framework & Components
- **Shadcn/ui** - Beautiful, accessible component library built on Radix UI
- **Tailwind CSS 3.4+** - Utility-first CSS framework
- **Radix UI** - Unstyled, accessible component primitives
- **Lucide React** - Modern icon library
- **Recharts** - Charting library for resource visualization

### State Management & Data Fetching
- **TanStack Query (React Query) v5** - Server state management and caching
- **Zustand** - Lightweight client state management
- **Axios** - HTTP client with interceptors

### Developer Tools
- **ESLint** - Code linting
- **Prettier** - Code formatting
- **Vitest** - Unit testing framework
- **React Testing Library** - Component testing
- **TypeScript ESLint** - TypeScript-specific linting rules

---

## 2. Architecture Overview

### Application Architecture Pattern: Feature-Sliced Design

```
┌─────────────────────────────────────────────────────────┐
│                     React Application                     │
│  ┌─────────────────────────────────────────────────────┐ │
│  │              Presentation Layer                     │ │
│  │  (Components, Pages, Layouts)                       │ │
│  └────────────────────┬────────────────────────────────┘ │
│  ┌────────────────────┴────────────────────────────────┐ │
│  │         Business Logic Layer                        │ │
│  │  (Hooks, Services, State Management)                │ │
│  └────────────────────┬────────────────────────────────┘ │
│  ┌────────────────────┴────────────────────────────────┐ │
│  │              Data Access Layer                      │ │
│  │  (API Client, React Query, Axios)                   │ │
│  └────────────────────┬────────────────────────────────┘ │
└───────────────────────┼──────────────────────────────────┘
                        │
                        ▼
         ┌──────────────────────────┐
         │    Flask Backend API      │
         │  (Existing endpoints)     │
         └──────────────────────────┘
```

### Key Architectural Principles

1. **Separation of Concerns** - Clear boundaries between UI, business logic, and data
2. **Type Safety** - TypeScript throughout for compile-time error detection
3. **Component Composition** - Small, reusable components
4. **Declarative UI** - React's declarative approach for predictable UIs
5. **Performance Optimization** - Code splitting, lazy loading, and memoization
6. **Accessibility First** - WCAG 2.1 AA compliance using Radix UI primitives

---

## 3. Project Structure

```
website-manager/
├── frontend/                      # New React application
│   ├── public/
│   │   ├── favicon.ico
│   │   └── robots.txt
│   │
│   ├── src/
│   │   ├── app/                   # App setup and providers
│   │   │   ├── App.tsx
│   │   │   ├── providers.tsx      # React Query, Router, etc.
│   │   │   └── router.tsx         # Route configuration
│   │   │
│   │   ├── pages/                 # Page components
│   │   │   ├── Dashboard/
│   │   │   │   ├── index.tsx
│   │   │   │   └── components/
│   │   │   ├── Sites/
│   │   │   │   ├── index.tsx
│   │   │   │   ├── SiteList.tsx
│   │   │   │   └── SiteDetail/
│   │   │   ├── Services/
│   │   │   ├── Resources/
│   │   │   └── CronJobs/
│   │   │
│   │   ├── features/              # Feature modules
│   │   │   ├── sites/
│   │   │   │   ├── api/           # API calls
│   │   │   │   ├── components/    # Feature-specific components
│   │   │   │   ├── hooks/         # Custom hooks
│   │   │   │   ├── types/         # TypeScript types
│   │   │   │   └── utils/         # Utilities
│   │   │   ├── services/
│   │   │   ├── database/
│   │   │   ├── files/
│   │   │   └── logs/
│   │   │
│   │   ├── components/            # Shared components
│   │   │   ├── ui/                # Shadcn/ui components
│   │   │   ├── layout/
│   │   │   │   ├── AppLayout.tsx
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   └── Header.tsx
│   │   │   └── common/
│   │   │       ├── LoadingSpinner.tsx
│   │   │       ├── ErrorBoundary.tsx
│   │   │       └── Toast.tsx
│   │   │
│   │   ├── lib/                   # Core libraries and utilities
│   │   │   ├── api/
│   │   │   │   ├── client.ts      # Axios instance
│   │   │   │   ├── endpoints.ts   # API endpoint constants
│   │   │   │   └── types.ts       # API response types
│   │   │   ├── hooks/             # Global hooks
│   │   │   └── utils/
│   │   │       ├── cn.ts          # Class name utility
│   │   │       ├── format.ts      # Formatting utilities
│   │   │       └── validation.ts
│   │   │
│   │   ├── store/                 # State management
│   │   │   ├── index.ts
│   │   │   └── slices/
│   │   │       ├── uiStore.ts     # UI state (theme, sidebar, etc.)
│   │   │       └── authStore.ts   # Auth state (future)
│   │   │
│   │   ├── styles/
│   │   │   ├── globals.css        # Global styles and Tailwind directives
│   │   │   └── themes/            # Theme configurations
│   │   │
│   │   ├── types/                 # Global TypeScript types
│   │   │   ├── index.ts
│   │   │   ├── site.ts
│   │   │   ├── service.ts
│   │   │   └── api.ts
│   │   │
│   │   ├── main.tsx               # Entry point
│   │   └── vite-env.d.ts
│   │
│   ├── .env.development
│   ├── .env.production
│   ├── .eslintrc.cjs
│   ├── .prettierrc
│   ├── index.html
│   ├── package.json
│   ├── postcss.config.js
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   ├── tsconfig.node.json
│   └── vite.config.ts
│
├── app.py                         # Existing Flask backend (unchanged)
├── requirements.txt
└── README.md
```

---

## 4. Component Hierarchy

### Layout Components
```typescript
AppLayout
├── Sidebar
│   ├── SidebarHeader
│   └── SidebarNav
│       └── SidebarNavItem[]
├── Header
│   ├── PageTitle
│   └── HeaderActions
└── MainContent
    └── Outlet (React Router)
```

### Page Components

#### Dashboard Page
```typescript
DashboardPage
├── StatsGrid
│   └── StatCard[]
├── RecentSitesCard
│   └── SiteListItem[]
└── ServicesStatusCard
    └── ServiceStatusItem[]
```

#### Sites Page
```typescript
SitesPage
├── SitesHeader
│   ├── SearchInput
│   └── FilterButtons
└── SitesGrid
    └── SiteCard[]
        ├── SiteCardHeader
        ├── SiteCardBadges
        ├── SiteCardInfo
        └── SiteCardActions
```

#### Site Detail Page
```typescript
SiteDetailPage
├── SiteHeader
│   ├── Breadcrumb
│   └── SiteActions
├── Tabs
│   ├── TabsList
│   └── TabsTrigger[]
└── TabsContent[]
    ├── OverviewTab
    ├── FileManagerTab
    │   ├── FileToolbar
    │   └── FileExplorer
    ├── DatabaseTab
    │   ├── DatabaseInfo
    │   └── TablesGrid
    ├── LogsTab
    │   └── LogViewer
    └── WordPressTab
```

---

## 5. State Management Strategy

### Server State (React Query)
- **Sites data** - Cached with 30-second stale time
- **Services status** - Polling every 5 seconds when active
- **Database information** - On-demand fetching
- **Logs** - Streaming with auto-refresh
- **System resources** - Real-time polling

### Client State (Zustand)
```typescript
// UI Store
interface UIStore {
  sidebarOpen: boolean;
  theme: 'light' | 'dark' | 'system';
  toggleSidebar: () => void;
  setTheme: (theme: string) => void;
}

// Notification Store
interface NotificationStore {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id'>) => void;
  removeNotification: (id: string) => void;
}
```

### React Query Configuration
```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,        // 30 seconds
      cacheTime: 300000,       // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
```

---

## 6. API Integration

### API Client Setup
```typescript
// lib/api/client.ts
import axios from 'axios';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
apiClient.interceptors.request.use((config) => {
  // Add auth token if needed
  return config;
});

// Response interceptor
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Global error handling
    return Promise.reject(error);
  }
);
```

### API Endpoints Structure
```typescript
// lib/api/endpoints.ts
export const API_ENDPOINTS = {
  SITES: {
    LIST: '/api/sites',
    DETAIL: (domain: string) => `/api/site/${domain}/status`,
    FILES: (domain: string) => `/api/site/${domain}/files`,
    DATABASE: (domain: string) => `/api/site/${domain}/database/info`,
  },
  SERVICES: {
    LIST: '/api/services',
    CONTROL: (service: string, action: string) => 
      `/api/service/${service}/${action}`,
  },
  RESOURCES: '/api/system/resources',
  // ... more endpoints
};
```

### Custom Hooks for Data Fetching
```typescript
// features/sites/hooks/useSites.ts
export const useSites = () => {
  return useQuery({
    queryKey: ['sites'],
    queryFn: async () => {
      const { data } = await apiClient.get<Site[]>(API_ENDPOINTS.SITES.LIST);
      return data;
    },
  });
};

// features/services/hooks/useServiceControl.ts
export const useServiceControl = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      service, 
      action 
    }: { 
      service: string; 
      action: ServiceAction;
    }) => {
      const { data } = await apiClient.post(
        API_ENDPOINTS.SERVICES.CONTROL(service, action)
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
    },
  });
};
```

---

## 7. Design System

### Shadcn/ui Components to Use
- **Layout**: `Card`, `Separator`, `Tabs`
- **Navigation**: `Sidebar`, `NavigationMenu`, `Breadcrumb`
- **Forms**: `Input`, `Button`, `Select`, `Switch`, `Textarea`
- **Feedback**: `Toast`, `Alert`, `Badge`, `Progress`, `Skeleton`
- **Overlay**: `Dialog`, `Sheet`, `Popover`, `Dropdown Menu`
- **Data Display**: `Table`, `Avatar`, `Tooltip`

### Theme Configuration
```typescript
// Tailwind theme extension
export const theme = {
  extend: {
    colors: {
      border: "hsl(var(--border))",
      input: "hsl(var(--input))",
      ring: "hsl(var(--ring))",
      background: "hsl(var(--background))",
      foreground: "hsl(var(--foreground))",
      primary: {
        DEFAULT: "hsl(var(--primary))",
        foreground: "hsl(var(--primary-foreground))",
      },
      // ... Shadcn theme variables
    },
    borderRadius: {
      lg: "var(--radius)",
      md: "calc(var(--radius) - 2px)",
      sm: "calc(var(--radius) - 4px)",
    },
  },
};
```

### CSS Variables (Dark Mode Support)
```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 221.2 83.2% 53.3%;
  --primary-foreground: 210 40% 98%;
  /* ... more variables */
}

.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  /* ... dark mode variables */
}
```

---

## 8. TypeScript Type System

### Core Types
```typescript
// types/site.ts
export interface Site {
  domain: string;
  path: string;
  public_html: string;
  apache_config: string | null;
  apache_enabled: boolean;
  db_name: string | null;
  db_user: string | null;
  db_host: string;
  error_log: string;
  access_log: string;
  size_mb: number;
}

export interface SiteStatus {
  domain: string;
  apache_enabled: boolean;
  local_accessible: boolean;
  public_accessible: boolean;
  path: string;
}

// types/service.ts
export interface Service {
  name: string;
  active: boolean;
  enabled: boolean;
  status: 'running' | 'stopped';
}

export type ServiceAction = 'start' | 'stop' | 'restart' | 'enable' | 'disable';

// types/api.ts
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}
```

---

## 9. Performance Optimization

### Code Splitting Strategy
```typescript
// Lazy load pages
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Sites = lazy(() => import('./pages/Sites'));
const SiteDetail = lazy(() => import('./pages/Sites/SiteDetail'));
const Services = lazy(() => import('./pages/Services'));
const Resources = lazy(() => import('./pages/Resources'));

// Route configuration with Suspense
<Suspense fallback={<PageLoader />}>
  <Routes>
    <Route path="/" element={<Dashboard />} />
    <Route path="/sites" element={<Sites />} />
    <Route path="/site/:domain" element={<SiteDetail />} />
    {/* ... more routes */}
  </Routes>
</Suspense>
```

### Optimization Techniques
1. **React.memo** for expensive components
2. **useMemo** for expensive calculations
3. **useCallback** for event handlers
4. **Virtual scrolling** for large lists (react-window)
5. **Image optimization** with lazy loading
6. **Bundle analysis** with rollup-plugin-visualizer

---

## 10. Migration Strategy

### Phase 1: Foundation (Week 1)
- [ ] Initialize Vite + React + TypeScript project
- [ ] Configure Tailwind CSS and Shadcn/ui
- [ ] Set up ESLint, Prettier, and TypeScript config
- [ ] Create base layout components (Sidebar, Header, AppLayout)
- [ ] Set up React Router and basic routing
- [ ] Configure React Query and Axios client
- [ ] Set up Zustand stores

### Phase 2: Core Features (Week 2-3)
- [ ] Dashboard page with stats and charts
- [ ] Sites list page with search and filters
- [ ] Services management page
- [ ] System resources page with real-time updates
- [ ] Implement all API integrations
- [ ] Create shared components library

### Phase 3: Site Management (Week 3-4)
- [ ] Site detail page with tabs
- [ ] File manager with upload/download
- [ ] Database viewer and management
- [ ] Log viewer with filtering
- [ ] WordPress information display

### Phase 4: Polish & Optimization (Week 4-5)
- [ ] Add loading states and skeletons
- [ ] Implement error boundaries and error handling
- [ ] Add toast notifications system
- [ ] Optimize performance (memoization, code splitting)
- [ ] Add dark mode support
- [ ] Responsive design improvements
- [ ] Accessibility audit and fixes

### Phase 5: Testing & Documentation (Week 5-6)
- [ ] Write unit tests for utilities and hooks
- [ ] Write component tests
- [ ] Create user documentation
- [ ] Performance testing and optimization
- [ ] Cross-browser testing
- [ ] Production build optimization

---

## 11. Development Workflow

### Local Development
```bash
# Install dependencies
cd frontend
npm install

# Start dev server
npm run dev

# The Flask backend should be running separately
cd ..
python3 app.py
```

### Build for Production
```bash
# Build optimized production bundle
npm run build

# Preview production build
npm run preview
```

### Flask Integration
```python
# app.py - Serve React build in production
from flask import send_from_directory

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_spa(path):
    if path and os.path.exists(os.path.join('frontend/dist', path)):
        return send_from_directory('frontend/dist', path)
    return send_from_directory('frontend/dist', 'index.html')
```

---

## 12. Environment Configuration

### Development (.env.development)
```env
VITE_API_URL=http://127.0.0.1:5000
VITE_WS_URL=ws://127.0.0.1:5000
VITE_APP_NAME=Website Manager
```

### Production (.env.production)
```env
VITE_API_URL=/api
VITE_APP_NAME=Website Manager
```

---

## 13. Key Improvements Over Current Implementation

### Developer Experience
- ✅ **Type Safety** - Catch errors at compile time
- ✅ **Hot Module Replacement** - Instant feedback during development
- ✅ **Modern Tooling** - Better debugging, linting, and formatting
- ✅ **Component Reusability** - DRY principle with composable components
- ✅ **Better Code Organization** - Feature-based structure

### User Experience
- ✅ **Faster Load Times** - Optimized bundles and code splitting
- ✅ **Smooth Interactions** - React's virtual DOM for efficient updates
- ✅ **Better Accessibility** - Radix UI's accessible primitives
- ✅ **Modern UI** - Shadcn/ui's beautiful, consistent components
- ✅ **Responsive Design** - Mobile-first approach with Tailwind
- ✅ **Dark Mode** - Built-in theme switching

### Maintainability
- ✅ **Testability** - Easy to test with React Testing Library
- ✅ **Scalability** - Clear architecture for feature additions
- ✅ **Documentation** - TypeScript types serve as inline documentation
- ✅ **Error Handling** - Centralized error boundaries and handling

---

## 14. Potential Challenges & Solutions

### Challenge 1: Large Initial Migration Effort
**Solution**: Incremental migration - Start with one page and gradually migrate others

### Challenge 2: Learning Curve for New Technologies
**Solution**: Comprehensive documentation and code examples in this plan

### Challenge 3: Maintaining Backend Compatibility
**Solution**: Keep existing API structure, only change frontend

### Challenge 4: State Synchronization
**Solution**: React Query handles caching and synchronization automatically

### Challenge 5: Bundle Size
**Solution**: Code splitting, tree shaking, and bundle analysis

---

## 15. Success Metrics

### Performance Metrics
- **Initial Load Time**: < 2 seconds
- **Time to Interactive**: < 3 seconds
- **Lighthouse Score**: > 90
- **Bundle Size**: < 500KB (gzipped)

### Developer Metrics
- **Build Time**: < 10 seconds
- **Hot Reload**: < 100ms
- **Type Coverage**: > 95%
- **Test Coverage**: > 80%

### User Experience Metrics
- **Accessibility Score**: WCAG 2.1 AA compliant
- **Mobile Responsiveness**: All features work on mobile
- **Error Rate**: < 1% of user actions
- **User Satisfaction**: Measured through feedback

---

## 16. Next Steps

After reviewing and approving this plan, the next steps would be:

1. **Create a new branch** for the redesign work
2. **Initialize the Vite project** in the `frontend/` directory
3. **Set up the development environment** with all dependencies
4. **Create the base layout** and routing structure
5. **Start implementing features** following the migration phases
6. **Regular code reviews** and testing throughout development
7. **Documentation** of components and features as they're built

---

## Conclusion

This redesign will modernize the Website Manager with industry-standard tools and practices, resulting in:
- **Better Developer Experience**: Type safety, modern tooling, and clear architecture
- **Enhanced User Experience**: Faster, more responsive, and more accessible
- **Improved Maintainability**: Easier to test, debug, and extend
- **Future-Proof**: Built on actively maintained, widely-adopted technologies

The React + TypeScript + Vite + Shadcn/ui stack is battle-tested, well-documented, and has excellent community support, making it an ideal choice for this project.