import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import type { ReactNode } from 'react';
import { Toaster } from 'sonner';

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
      <Toaster 
        position="bottom-right" 
        toastOptions={{
          style: {
            fontSize: '0.875rem',
            padding: '0.75rem 1rem',
            background: 'hsl(var(--card))',
            color: 'hsl(var(--card-foreground))',
            border: '1px solid hsl(var(--border))',
          },
          className: 'toast',
          classNames: {
            toast: 'bg-card text-card-foreground border-border',
            success: 'bg-card text-card-foreground border-green-500/50',
            error: 'bg-card text-card-foreground border-destructive',
          },
        }}
        closeButton
      />
    </QueryClientProvider>
  );
}