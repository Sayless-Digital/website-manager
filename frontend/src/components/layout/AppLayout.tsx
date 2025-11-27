import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useUIStore } from '@/store/uiStore';
import { cn } from '@/lib/utils/cn';

export function AppLayout() {
  const sidebarOpen = useUIStore((state) => state.sidebarOpen);

  return (
    <div className="flex h-screen bg-[hsl(240_5.8824%_10%)] overflow-x-hidden">
      <Sidebar />
      <div
        className={cn(
          'flex flex-col flex-1 transition-all duration-300 min-w-0',
          sidebarOpen ? 'lg:ml-64' : 'lg:ml-0'
        )}
      >
        <main className="flex-1 overflow-y-auto pt-4 pb-4 bg-[hsl(240_5.8824%_10%)] min-w-0">
          <div className="h-full bg-background rounded-l-xl border-l border-t border-b p-6 overflow-y-auto overflow-x-hidden max-w-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}