# Website Manager Frontend - React + TypeScript + Vite

Modern, redesigned frontend for the Website Manager application built with React 18, TypeScript, Vite, and Shadcn/ui.

## 🚀 What's Been Completed

### ✅ Phase 1: Foundation & Setup (COMPLETE)
- ✅ Initialized Vite + React + TypeScript project
- ✅ Installed and configured all dependencies
- ✅ Set up Tailwind CSS with custom theme
- ✅ Configured TypeScript with path aliases (@/)
- ✅ Configured Vite with API proxy to Flask backend
- ✅ Created environment configuration files

### ✅ Phase 2: Core Architecture (COMPLETE)
- ✅ Set up React Query for server state management
- ✅ Set up Zustand for client state management
- ✅ Created API client with Axios interceptors
- ✅ Defined all TypeScript types and interfaces
- ✅ Created utility functions (cn, formatBytes, formatDate)
- ✅ Set up React Router with lazy loading

### ✅ Phase 3: Layout Components (COMPLETE)
- ✅ Created `Sidebar` with navigation
- ✅ Created `Header` with refresh functionality
- ✅ Created `AppLayout` with responsive design
- ✅ Created `LoadingSpinner` component
- ✅ Set up global styles with Tailwind

### ✅ Phase 4: Routing & Pages (COMPLETE)
- ✅ Set up React Router with code splitting
- ✅ Created placeholder pages for all routes:
  - Dashboard (`/`)
  - Websites (`/sites`)
  - Services (`/services`)
  - Resources (`/resources`)
  - Cron Jobs (`/cron`)

## 📦 Tech Stack

- **React 18.3** - UI library
- **TypeScript 5.3** - Type safety
- **Vite 7.2** - Build tool & dev server
- **Tailwind CSS 3.4** - Utility-first CSS
- **Shadcn/ui** - Component library (ready to add components)
- **React Router v6** - Client-side routing
- **TanStack Query v5** - Server state management
- **Zustand** - Client state management
- **Axios** - HTTP client
- **Lucide React** - Icon library

## 🏗️ Project Structure

```
frontend/
├── src/
│   ├── app/                    # App configuration
│   │   ├── App.tsx            # Main app component
│   │   ├── providers.tsx      # React Query provider
│   │   └── router.tsx         # Route configuration
│   │
│   ├── pages/                 # Page components
│   │   ├── Dashboard/
│   │   ├── Sites/
│   │   ├── Services/
│   │   ├── Resources/
│   │   └── CronJobs/
│   │
│   ├── components/            # Reusable components
│   │   ├── layout/           # Layout components
│   │   │   ├── AppLayout.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── Header.tsx
│   │   ├── common/           # Common components
│   │   │   └── LoadingSpinner.tsx
│   │   └── ui/               # Shadcn/ui components (to be added)
│   │
│   ├── features/             # Feature modules (to be built)
│   │   ├── sites/
│   │   ├── services/
│   │   ├── database/
│   │   ├── files/
│   │   └── logs/
│   │
│   ├── lib/                  # Core libraries
│   │   ├── api/
│   │   │   ├── client.ts    # Axios instance
│   │   │   └── endpoints.ts # API endpoints
│   │   ├── hooks/           # Custom hooks (to be added)
│   │   └── utils/
│   │       ├── cn.ts        # Class name utility
│   │       └── format.ts    # Formatting utilities
│   │
│   ├── store/               # State management
│   │   └── uiStore.ts      # UI state (theme, sidebar)
│   │
│   ├── types/              # TypeScript types
│   │   ├── site.ts
│   │   ├── service.ts
│   │   ├── api.ts
│   │   └── index.ts
│   │
│   ├── styles/
│   │   └── globals.css     # Global styles + Tailwind
│   │
│   └── main.tsx            # Entry point
│
├── .env.development         # Development environment variables
├── .env.production          # Production environment variables
├── tailwind.config.js       # Tailwind configuration
├── tsconfig.json           # TypeScript configuration
├── vite.config.ts          # Vite configuration
└── package.json
```

## 🚦 Getting Started

### Prerequisites
- Node.js 18+
- npm 9+
- Flask backend running on port 5000

### Installation

Dependencies are already installed, but if needed:
```bash
npm install
```

### Development

1. **Start the Flask backend** (in separate terminal):
```bash
cd /home/mercury/Documents/Storage/Websites/website-manager
python3 app.py
```

2. **Start the React frontend**:
```bash
npm run dev
```

3. **Open your browser**: http://localhost:5174 (or 5173)

### Available Scripts

- `npm run dev` - Start development server with HMR
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Lint code with ESLint

## 🎨 Features

### Current Features
- ✅ Modern, responsive layout with sidebar navigation
- ✅ Dark/light theme support (via Zustand store)
- ✅ API integration ready with Axios + React Query
- ✅ TypeScript throughout for type safety
- ✅ Code splitting with lazy-loaded pages
- ✅ Global state management with Zustand
- ✅ Server state caching with React Query

### Layout Features
- Responsive sidebar (collapsible on mobile)
- Sticky header with refresh button
- Clean, modern design with Tailwind CSS
- Smooth transitions and animations

## 📋 Next Steps

### Phase 5: Implement Dashboard (Next Priority)
- [ ] Create stats cards showing:
  - Total websites
  - Total databases
  - Disk usage
  - Memory usage
- [ ] Add recent sites list
- [ ] Add services status overview
- [ ] Implement real-time data fetching

### Phase 6: Implement Sites Page
- [ ] Create sites grid/list view
- [ ] Add search and filter functionality
- [ ] Create site detail modal/page with tabs:
  - [ ] Overview tab
  - [ ] File Manager tab
  - [ ] Database tab
  - [ ] Logs tab
  - [ ] WordPress info tab
- [ ] Add site management actions

### Phase 7: Implement Services Page
- [ ] List all services (Apache, MySQL, Cloudflare)
- [ ] Show service status (running/stopped)
- [ ] Add control buttons (start/stop/restart)
- [ ] Show service logs

### Phase 8: Implement Resources Page
- [ ] CPU usage graph
- [ ] Memory usage graph
- [ ] Disk usage graph
- [ ] Real-time monitoring (5-second refresh)
- [ ] System information display

### Phase 9: Add Shadcn/ui Components
As needed, install components:
```bash
npx shadcn-ui@latest add button
npx shadcn-ui@latest add card
npx shadcn-ui@latest add badge
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add tabs
# etc.
```

### Phase 10: Polish & Optimization
- [ ] Add error boundaries
- [ ] Implement toast notifications
- [ ] Add loading skeletons
- [ ] Optimize bundle size
- [ ] Add unit tests
- [ ] Performance optimization

## 🔧 Configuration

### Environment Variables

**Development (`.env.development`):**
```env
VITE_API_URL=http://127.0.0.1:5000
VITE_APP_NAME=Website Manager
```

**Production (`.env.production`):**
```env
VITE_API_URL=/api
VITE_APP_NAME=Website Manager
```

### API Proxy

The Vite dev server is configured to proxy `/api` requests to the Flask backend:
```typescript
// vite.config.ts
server: {
  proxy: {
    '/api': {
      target: 'http://127.0.0.1:5000',
      changeOrigin: true,
    },
  },
}
```

## 🎯 Key Architectural Decisions

1. **React Query for Server State**
   - Automatic caching and background refetching
   - Optimistic updates
   - Request deduplication

2. **Zustand for Client State**
   - Lightweight and simple
   - Persistent storage for UI preferences
   - No boilerplate

3. **Feature-Sliced Design**
   - Clear separation of concerns
   - Easy to test and maintain
   - Scalable architecture

4. **TypeScript Throughout**
   - Compile-time error detection
   - Better IDE support
   - Self-documenting code

5. **Code Splitting**
   - Faster initial load
   - Only load what's needed
   - Better performance

## 📖 Documentation

See also:
- [`../REDESIGN_PLAN.md`](../REDESIGN_PLAN.md) - Complete redesign architecture plan
- [`../ARCHITECTURE_DIAGRAM.md`](../ARCHITECTURE_DIAGRAM.md) - Visual architecture diagrams
- [`../IMPLEMENTATION_GUIDE.md`](../IMPLEMENTATION_GUIDE.md) - Detailed implementation guide

## 🐛 Troubleshooting

### Port Already in Use
If port 5173 is in use, Vite will automatically use the next available port (5174, etc.)

### API Requests Failing
Ensure the Flask backend is running on port 5000:
```bash
cd /home/mercury/Documents/Storage/Websites/website-manager
python3 app.py
```

### TypeScript Errors
Run type checking:
```bash
npm run type-check
```

### Build Errors
Clear node_modules and reinstall:
```bash
rm -rf node_modules package-lock.json
npm install
```

## 📝 Notes

- The application uses the Flask backend's existing API endpoints
- No changes are needed to the Flask backend
- The old frontend (templates/, static/) remains unchanged
- This is a complete reimplementation of the frontend only

## 🤝 Contributing

When implementing new features:
1. Create types in `src/types/`
2. Create API functions in `src/features/*/api/`
3. Create custom hooks in `src/features/*/hooks/`
4. Create components in `src/features/*/components/`
5. Update pages to use the new features

## 📄 License

Same as the main Website Manager project.