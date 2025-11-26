
# Website Manager Frontend - Implementation Guide

This guide provides step-by-step instructions for implementing the redesigned frontend based on the architecture plan.

---

## Prerequisites

- Node.js 18+ and npm 9+
- Python 3.10+ (for Flask backend)
- Git
- Code editor (VS Code recommended)

---

## Phase 1: Project Initialization

### Step 1.1: Create Vite React TypeScript Project

```bash
cd website-manager
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
```

### Step 1.2: Install Core Dependencies

```bash
# React Router
npm install react-router-dom

# Data Fetching & State Management
npm install @tanstack/react-query axios zustand

# UI Framework & Components
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# Shadcn/ui CLI
npx shadcn-ui@latest init
```

During `shadcn-ui init`, choose:
- Style: **Default**
- Base color: **Slate**
- CSS variables: **Yes**

### Step 1.3: Install Additional Dependencies

```bash
# Icons
npm install lucide-react

# Utilities
npm install clsx tailwind-merge class-variance-authority
npm install date-fns

# Forms (if needed later)
npm install react-hook-form @hookform/resolvers zod

# Charts
npm install recharts

# Dev Dependencies
npm install -D @types/node
```

### Step 1.4: Install Shadcn/ui Components

```bash
# Install needed components
npx shadcn-ui@latest add button
npx shadcn-ui@latest add card
npx shadcn-ui@latest add badge
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add tabs
npx shadcn-ui@latest add input
npx shadcn-ui@latest add table
npx shadcn-ui@latest add toast
npx shadcn-ui@latest add dropdown-menu
npx shadcn-ui@latest add separator
npx shadcn-ui@latest add skeleton
npx shadcn-ui@latest add progress
npx shadcn-ui@latest add alert
npx shadcn-ui@latest add switch
npx shadcn-ui@latest add select
npx shadcn-ui@latest add textarea
npx shadcn-ui@latest add breadcrumb
npx shadcn-ui@latest add sheet
```

---

## Phase 2: Project Configuration

### Step 2.1: Configure TypeScript (`tsconfig.json`)

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,

    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",

    /* Linting */
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,

    /* Path aliases */
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

### Step 2.2: Configure Vite (`vite.config.ts`)

```typescript
import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
    },
  },
})
```

### Step 2.3: Configure Tailwind (`tailwind.config.js`)

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
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
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: 0 },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: 0 },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
```

### Step 2.4: Environment Variables

Create `.env.development`:
```env
VITE_API_URL=http://127.0.0.1:5000
VITE_APP_NAME=Website Manager
```

Create `.env.production`:
```env
VITE_API_URL=/api
VITE_APP_NAME=Website Manager
```

### Step 2.5: Add Package Scripts

Update `package.json`:
```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    "preview": "vite preview",
    "type-check": "tsc --noEmit"
  }
}
```

---

## Phase 3: Core Structure Setup

### Step 3.1: Create Directory Structure

```bash
cd src
mkdir -p app pages features components/{ui,layout,common} lib/{api,hooks,utils} store types styles
```

### Step 3.2: Create Type Definitions (`src/types/`)

**`src/types/site.ts`:**
```typescript
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

export interface DatabaseInfo {
  db_name: string;
  db_user: string;
  db_host: string;
  table_count: number;
  size_mb: number;
  connected: boolean;
}
```

**`src/types/service.ts`:**
```typescript
export interface Service {
  name: string;
  active: boolean;
  enabled: boolean;
  status: 'running' | 'stopped';
}

export type ServiceAction = 'start' | 'stop' | 'restart' | 'enable' | 'disable';
```

**`src/types/api.ts`:**
```typescript
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface SystemResources {
  cpu: {
    percent: number;
    count: number;
  };
  memory: {
    total: number;
    used: number;
    available: number;
    percent: number;
    total_gb: number;
    used_gb: number;
    available_gb: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
    percent: number;
    total_gb: number;
    used_gb: number;
    free_gb: number;
  };
  processes: number;
}
```

### Step 3.3: Create API Client (`src/lib/api/`)

**`src/lib/api/client.ts`:**
```typescript
import axios from 'axios';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    // Add any auth tokens here if needed
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Global error handling
    const message = error.response?.data?.error || error.message || 'An error occurred';
    console.error('API Error:', message);
    return Promise.reject(error);
  }
);
```

**`src/lib/api/endpoints.ts`:**
```typescript
export const API_ENDPOINTS = {
  SITES: {
    LIST: '/api/sites',
    STATUS: (domain: string) => `/api/site/${domain}/status`,
    FILES: (domain: string) => `/api/site/${domain}/files`,
    DATABASE: (domain: string) => `/api/site/${domain}/database/info`,
    WORDPRESS: (domain: string) => `/api/site/${domain}/wordpress/info`,
    LOGS: (domain: string, type: string) => `/api/site/${domain}/logs/${type}`,
  },
  SERVICES: {
    LIST: '/api/services',
    CONTROL: (service: string, action: string) => `/api/service/${service}/${action}`,
    LOGS: (service: string) => `/api/service/${service}/logs`,
  },
  SYSTEM: {
    RESOURCES: '/api/system/resources',
    INFO: '/api/system/info',
  },
  CRON: {
    LIST: '/api/cron/list',
  },
} as const;
```

### Step 3.4: Create Utilities (`src/lib/utils/`)

**`src/lib/utils/cn.ts`:**
```typescript
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

**`src/lib/utils/format.ts`:**
```typescript
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
```

---

## Phase 4: State Management Setup

### Step 4.1: React Query Setup (`src/app/providers.tsx`)

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ReactNode } from 'react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000, // 30 seconds
      gcTime: 300000, // 5 minutes (formerly cacheTime)
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

### Step 4.2: Zustand Store (`src/store/uiStore.ts`)

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIStore {
  sidebarOpen: boolean;
  theme: 'light' | 'dark' | 'system';
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      theme: 'system',
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'ui-store',
    }
  )
);
```

---

## Phase 5: Layout Components

### Step 5.1: App Layout (`src/components/layout/AppLayout.tsx`)

```typescript
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useUIStore } from '@/store/uiStore';
import { cn } from '@/lib/utils/cn';

export function AppLayout() {
  const sidebarOpen = useUIStore((state) => state.sidebarOpen);

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div
        className={cn(
          'flex flex-col flex-1 transition-all duration-300',
          sidebarOpen ? 'ml-64' : 'ml-0'
        )}
      >
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
```

### Step 5.2: Sidebar Component (`src/components/layout/Sidebar.tsx`)

```typescript
import { Link, useLocation } from 'react-router-dom';
import { Server, Home, Globe, Settings, BarChart3, Clock } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useUIStore } from '@/store/uiStore';

const navigation = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Websites', href: '/sites', icon: Globe },
  { name: 'Services', href: '/services', icon: Settings },
  { name: 'Resources', href: '/resources', icon: BarChart3 },
  { name: 'Cron Jobs', href: '/cron', icon: Clock },
];

export function Sidebar() {
  const location = useLocation();
  const sidebarOpen = useUIStore((state) => state.sidebarOpen);

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-slate-100 transition-transform duration-300',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}
    >
      <div className="flex h-16 items-center gap-2 px-6 border-b border-slate-800">
        <Server className="h-6 w-6 text-blue-400" />
        <h1 className="text-xl font-bold">Website Manager</h1>
      </div>
      <nav className="p-4 space-y-2">
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.name}
              to={item.href}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                isActive
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="font-medium">{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
```

### Step 5.3: Header Component (`src/components/layout/Header.tsx`)

```typescript
import { Menu, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUIStore } from '@/store/uiStore';

export function Header() {
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center gap-4 px-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <div className="flex-1" />
        <Button variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>
    </header>
  );
}
```

---

## Phase 6: Routing Setup

### Step 6.1: Router Configuration (`src/app/router.tsx`)

```typescript
import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

// Lazy load pages
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Sites = lazy(() => import('@/pages/Sites'));
const Services = lazy(() => import('@/pages/Services'));
const Resources = lazy(() => import('@/pages/Resources'));
const CronJobs = lazy(() => import('@/pages/CronJobs'));

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: (
          <Suspense fallback={<LoadingSpinner />}>
            <Dashboard />
          </Suspense>
        ),
      },
      {
        path: 'sites',
        element: (
          <Suspense fallback={<LoadingSpinner />}>
            <Sites />
          </Suspense>
        ),
      },
      {
        path: 'services',
        element: (
          <Suspense fallback={<LoadingSpinner />}>
            <Services />
          </Suspense>
        ),
      },
      {
        path: 'resources',
        element: (
          <Suspense fallback={<LoadingSpinner />}>
            <Resources />
          </Suspense>
        ),
      },
      {
        path: 'cron',
        element: (
          <Suspense fallback={<LoadingSpinner />}>
            <CronJobs />
          </Suspense>
        ),
      },
    ],
  },
]);

export function Router() {
  return <RouterProvider router={router} />;
}
```

---

## Phase 7: Main Entry Point

### Step 7.1: Update `src/main.tsx`

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './app/App';
import './styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

### Step 7.2: Create App Component (`src/app/App.tsx`)

```typescript
import { Providers } from './providers';
import { Router } from './router';
import { Toaster } from '@/components/ui/toaster';

export function App() {
  return (
    <Providers>
      <Router />
      <Toaster />
    </Providers>
  );
}
```

### Step 7.3: Global Styles (`src/styles/globals.css`)

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 221.2 83.2% 53.3%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 221.2 83.2% 53.3%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 217.2 91.2% 59.8%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 224.3 76.3% 48%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

---

## Phase 8: Development Workflow

### Running the Application

1. **Start Flask Backend** (Terminal 1):
```bash
cd website-manager
source venv/bin/activate
python3 app.py
```

2. **Start React Frontend** (Terminal 2):
```bash
cd website-manager/frontend
npm run dev
```

3. **Open Browser**: Navigate to `http://localhost:5173`

### Development Tips

- Use React DevTools browser extension
- Use React Query DevTools (included)
- Check browser console for errors
- Use TypeScript's type checking: `npm run type-check`
- Format code: `npx prettier --write src`
- Lint code: `npm run lint`

---

## Phase 9: Building Sample Pages

### Dashboard Page Template (`src/pages/Dashboard/index.tsx`)

```typescript
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Globe, Database, HardDrive, MemoryStick } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { API_ENDPOINTS } from '@/lib/api/endpoints';
import type { Site, SystemResources } from '@/types';

export default function Dashboard() {
  const { data: sites = [] } = useQuery<Site[]>({
    queryKey: ['sites'],
    queryFn: async () => {
      const { data } = await apiClient.get(API_ENDPOINTS.SITES.LIST);
      return data;
    },
  });

  const { data: resources } = useQuery<SystemResources>({
    queryKey: ['resources'],
    queryFn: async () => {
      const { data } = await apiClient.get(API_ENDPOINTS.SYSTEM.RESOURCES);
      return data;
    },
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Websites</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sites.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Databases</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {sites.filter(s => s.db_name).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Disk Usage</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {resources?.disk.percent.toFixed(1)}%
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
            <MemoryStick className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {resources?.memory.percent.toFixed(1)}%
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

---

## Phase 10: Production Build

### Building for Production

```bash
# Type check
npm run type-check

# Build
npm run build

# Preview build
npm run preview
```

### Integrating with Flask

Update Flask `app.py` to serve the React build:

```python
from flask import send_from_directory
import os

# Serve React App
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    if path != "" and os.path.exists(os.path.join('frontend/dist', path)):
        return send_from_directory('frontend/dist', path)
    else:
        return send_from_directory('frontend/dist', 'index.html')
```

---

## Troubleshooting

### Common Issues

**Issue**: Module not found errors
- **Solution**: Ensure `tsconfig.json` has correct path aliases
- Run `npm install` to ensure all dependencies are installed

**Issue**: Vite dev server not proxying API requests
- **Solution**: Check `vite.config.ts` proxy configuration
- Ensure Flask backend is running on port 5000

**Issue**: TypeScript errors
- **Solution**: Run `npm run type-check` to see all errors
- Check that all types are properly imported

**Issue**: Tailwind classes not working
- **Solution**: Ensure `globals.css` is imported in `main.tsx`
- Check that PostCSS is configured correctly

---

## Next Steps

1. Implement remaining pages (Sites, Services, Resources, Cron)
2. Add feature-specific components and hooks
3. Implement file manager functionality
4. Add database management features
5. Create log viewer components
6. Add error boundaries and loading states
7. Implement toast notifications
8.