import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

// Lazy load pages
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Sites = lazy(() => import('@/pages/Sites'));
const SiteDetail = lazy(() => import('@/pages/Sites/SiteDetail'));
const FileManager = lazy(() => import('@/pages/Sites/FileManager'));
const DatabaseManager = lazy(() => import('@/pages/Sites/DatabaseManager'));
const Backups = lazy(() => import('@/pages/Sites/Backups'));
const WordPressManager = lazy(() => import('@/pages/Sites/WordPressManager'));
const Services = lazy(() => import('@/pages/Services'));
const Resources = lazy(() => import('@/pages/Resources'));
const CronJobs = lazy(() => import('@/pages/CronJobs'));
const CloudflareManager = lazy(() => import('@/pages/Cloudflare'));
const EmailRoutingManager = lazy(() => import('@/pages/EmailRouting'));

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
        path: 'sites/:domain',
        element: (
          <Suspense fallback={<LoadingSpinner />}>
            <SiteDetail />
          </Suspense>
        ),
      },
      {
        path: 'sites/:domain/files',
        element: (
          <Suspense fallback={<LoadingSpinner />}>
            <FileManager />
          </Suspense>
        ),
      },
      {
        path: 'sites/:domain/database',
        element: (
          <Suspense fallback={<LoadingSpinner />}>
            <DatabaseManager />
          </Suspense>
        ),
      },
      {
        path: 'sites/:domain/backups',
        element: (
          <Suspense fallback={<LoadingSpinner />}>
            <Backups />
          </Suspense>
        ),
      },
      {
        path: 'sites/:domain/wordpress',
        element: (
          <Suspense fallback={<LoadingSpinner />}>
            <WordPressManager />
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
      {
        path: 'cloudflare',
        element: (
          <Suspense fallback={<LoadingSpinner />}>
            <CloudflareManager />
          </Suspense>
        ),
      },
      {
        path: 'email-routing',
        element: (
          <Suspense fallback={<LoadingSpinner />}>
            <EmailRoutingManager />
          </Suspense>
        ),
      },
      {
        path: 'email-routing/:zoneId',
        element: (
          <Suspense fallback={<LoadingSpinner />}>
            <EmailRoutingManager />
          </Suspense>
        ),
      },
    ],
  },
]);

export function Router() {
  return <RouterProvider router={router} />;
}