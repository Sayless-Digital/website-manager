# Website Manager - Architecture Diagrams

## System Architecture Overview

```mermaid
graph TB
    subgraph "Frontend - React SPA"
        A[React App Entry]
        A --> B[Router]
        B --> C[App Layout]
        C --> D1[Dashboard]
        C --> D2[Sites]
        C --> D3[Services]
        C --> D4[Resources]
        C --> D5[Cron Jobs]
        
        D2 --> E[Site Detail]
        
        F[React Query] -.->|Cache & Sync| D1
        F -.->|Cache & Sync| D2
        F -.->|Cache & Sync| D3
        F -.->|Cache & Sync| D4
        F -.->|Cache & Sync| D5
        
        G[Zustand Store] -.->|UI State| C
        G -.->|Theme| C
    end
    
    subgraph "API Layer"
        H[Axios Client]
        H --> I[Request Interceptor]
        H --> J[Response Interceptor]
    end
    
    subgraph "Backend - Flask"
        K[Flask App]
        K --> L[Sites API]
        K --> M[Services API]
        K --> N[Database API]
        K --> O[Files API]
        K --> P[System API]
    end
    
    F --> H
    H --> K
    
    L -.->|Read| Q[(File System)]
    M -.->|Control| R[Systemd]
    N -.->|Query| S[(MySQL)]
    O -.->|Manage| Q
    P -.->|Monitor| T[System Resources]
    
    style A fill:#6366f1
    style K fill:#10b981
    style F fill:#f59e0b
    style G fill:#ef4444
```

## Component Hierarchy

```mermaid
graph TD
    A[App.tsx] --> B[Providers]
    B --> C[QueryClientProvider]
    B --> D[RouterProvider]
    
    D --> E[AppLayout]
    E --> F[Sidebar]
    E --> G[Header]
    E --> H[MainContent]
    
    F --> F1[SidebarHeader]
    F --> F2[SidebarNav]
    F2 --> F3[SidebarNavItem]
    
    G --> G1[PageTitle]
    G --> G2[HeaderActions]
    G2 --> G3[ThemeToggle]
    G2 --> G4[RefreshButton]
    
    H --> I[Outlet/Pages]
    
    I --> J1[DashboardPage]
    I --> J2[SitesPage]
    I --> J3[ServicesPage]
    I --> J4[ResourcesPage]
    I --> J5[CronJobsPage]
    
    J1 --> K1[StatsGrid]
    J1 --> K2[RecentSitesCard]
    J1 --> K3[ServicesStatusCard]
    
    J2 --> L1[SitesHeader]
    J2 --> L2[SitesGrid]
    L2 --> L3[SiteCard]
    
    L3 --> M1[SiteCardHeader]
    L3 --> M2[SiteCardBadges]
    L3 --> M3[SiteCardInfo]
    L3 --> M4[SiteCardActions]
    
    style A fill:#6366f1
    style E fill:#10b981
    style J1 fill:#f59e0b
    style J2 fill:#f59e0b
```

## Data Flow Architecture

```mermaid
sequenceDiagram
    participant U as User
    participant C as React Component
    participant RQ as React Query
    participant A as Axios Client
    participant F as Flask API
    participant D as Data Source
    
    U->>C: Clicks "View Sites"
    C->>RQ: useSites() hook
    
    alt Cache Hit
        RQ-->>C: Return cached data
        C->>U: Display sites
    else Cache Miss or Stale
        RQ->>A: GET /api/sites
        A->>F: HTTP Request
        F->>D: Query filesystem
        D-->>F: Site data
        F-->>A: JSON Response
        A-->>RQ: Processed data
        RQ->>RQ: Cache data
        RQ-->>C: Return fresh data
        C->>U: Display sites
    end
    
    Note over RQ: Auto-refresh every 30s
    
    U->>C: Clicks "Restart Service"
    C->>RQ: useServiceControl()
    RQ->>A: POST /api/service/apache2/restart
    A->>F: HTTP Request
    F->>D: Systemctl command
    D-->>F: Result
    F-->>A: Success response
    A-->>RQ: Success
    RQ->>RQ: Invalidate services cache
    RQ->>A: Refetch services
    RQ-->>C: Updated data
    C->>U: Show success toast
```

## State Management Flow

```mermaid
graph LR
    subgraph "Server State - React Query"
        A[API Data]
        A --> B[Query Cache]
        B --> C1[Sites Query]
        B --> C2[Services Query]
        B --> C3[Resources Query]
        B --> C4[Database Query]
        
        C1 --> D[Auto-refresh]
        C2 --> D
        C3 --> D
    end
    
    subgraph "Client State - Zustand"
        E[UI Store]
        E --> F1[Sidebar State]
        E --> F2[Theme]
        E --> F3[Modal State]
        
        G[Notification Store]
        G --> G1[Toast Queue]
        G --> G2[Alert Stack]
    end
    
    subgraph "Component State - useState/useReducer"
        H[Local State]
        H --> H1[Form Data]
        H --> H2[UI Toggles]
        H --> H3[Temporary Data]
    end
    
    style B fill:#f59e0b
    style E fill:#ef4444
    style H fill:#6366f1
```

## File Structure Visualization

```mermaid
graph TD
    A[frontend/] --> B[src/]
    
    B --> C1[app/]
    B --> C2[pages/]
    B --> C3[features/]
    B --> C4[components/]
    B --> C5[lib/]
    B --> C6[store/]
    B --> C7[types/]
    B --> C8[styles/]
    
    C1 --> C1A[App.tsx]
    C1 --> C1B[providers.tsx]
    C1 --> C1C[router.tsx]
    
    C2 --> C2A[Dashboard/]
    C2 --> C2B[Sites/]
    C2 --> C2C[Services/]
    C2 --> C2D[Resources/]
    
    C3 --> C3A[sites/]
    C3 --> C3B[services/]
    C3 --> C3C[database/]
    
    C3A --> C3A1[api/]
    C3A --> C3A2[components/]
    C3A --> C3A3[hooks/]
    C3A --> C3A4[types/]
    
    C4 --> C4A[ui/]
    C4 --> C4B[layout/]
    C4 --> C4C[common/]
    
    C4A --> C4A1[button.tsx]
    C4A --> C4A2[card.tsx]
    C4A --> C4A3[dialog.tsx]
    
    C5 --> C5A[api/]
    C5 --> C5B[hooks/]
    C5 --> C5C[utils/]
    
    C5A --> C5A1[client.ts]
    C5A --> C5A2[endpoints.ts]
    
    style B fill:#6366f1
    style C1 fill:#10b981
    style C2 fill:#f59e0b
    style C3 fill:#ef4444
    style C4 fill:#8b5cf6
    style C5 fill:#06b6d4
```

## Technology Stack Dependencies

```mermaid
graph TB
    subgraph "Build Tools"
        A[Vite]
        A --> B[TypeScript Compiler]
        A --> C[PostCSS]
        C --> D[Tailwind CSS]
    end
    
    subgraph "Core Framework"
        E[React 18]
        E --> F[React Router v6]
        E --> G[React Query v5]
    end
    
    subgraph "UI Layer"
        H[Shadcn/ui]
        H --> I[Radix UI]
        H --> D
        I --> J[React ARIA]
    end
    
    subgraph "State Management"
        K[Zustand]
        G --> L[Query Cache]
    end
    
    subgraph "HTTP Client"
        M[Axios]
        M --> N[Interceptors]
    end
    
    subgraph "Utilities"
        O[Lucide React Icons]
        P[clsx/tailwind-merge]
        Q[date-fns]
    end
    
    E --> H
    E --> K
    E --> M
    E --> O
    
    style A fill:#646cff
    style E fill:#61dafb
    style H fill:#000000
    style K fill:#453e3e
    style M fill:#5a29e4
```

## Development Workflow

```mermaid
flowchart TD
    A[Start Development] --> B[npm run dev]
    B --> C[Vite Dev Server]
    C --> D{Code Change?}
    
    D -->|Yes| E[Hot Module Replacement]
    E --> F[Update Browser]
    F --> D
    
    D -->|No| G{Ready to Build?}
    
    G -->|Yes| H[npm run build]
    H --> I[TypeScript Check]
    I --> J{Type Errors?}
    
    J -->|Yes| K[Fix Errors]
    K --> I
    
    J -->|No| L[Vite Build]
    L --> M[Optimize Assets]
    M --> N[Generate Bundles]
    N --> O[Create dist/]
    
    O --> P{Deploy?}
    P -->|Yes| Q[Deploy to Production]
    P -->|No| R[npm run preview]
    
    G -->|No| D
    
    style C fill:#646cff
    style F fill:#61dafb
    style L fill:#646cff
    style O fill:#10b981
```

## Deployment Architecture

```mermaid
graph TB
    subgraph "Development"
        A[Vite Dev Server :5173]
        B[Flask Dev Server :5000]
        A -.->|API Proxy| B
    end
    
    subgraph "Production"
        C[Flask App :5000]
        C --> D[Serve Static Files]
        C --> E[API Routes]
        
        D --> F[dist/index.html]
        D --> G[dist/assets/*]
        
        E --> H[/api/sites]
        E --> I[/api/services]
        E --> J[/api/system]
    end
    
    subgraph "Browser"
        K[React SPA]
        K -->|HTTP| C
        K -->|WebSocket?| C
    end
    
    C --> L[(Database)]
    C --> M[File System]
    C --> N[Systemd Services]
    
    style A fill:#646cff
    style B fill:#10b981
    style C fill:#10b981
    style K fill:#61dafb
```

## Component Communication Patterns

```mermaid
graph LR
    subgraph "Parent-Child Props"
        A[Parent Component] -->|Props| B[Child Component]
        B -->|Callback| A
    end
    
    subgraph "Context API"
        C[Provider] -.->|Context| D[Consumer 1]
        C -.->|Context| E[Consumer 2]
        C -.->|Context| F[Consumer 3]
    end
    
    subgraph "Global State"
        G[Zustand Store] <-->|Subscribe| H[Component A]
        G <-->|Subscribe| I[Component B]
        G <-->|Subscribe| J[Component C]
    end
    
    subgraph "Server State"
        K[React Query] <-->|Query| L[Component X]
        K <-->|Query| M[Component Y]
        K -->|Cache| N[(Query Cache)]
    end
    
    style G fill:#453e3e
    style K fill:#f59e0b
    style C fill:#6366f1