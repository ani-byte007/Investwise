import { useEffect, useState } from 'react';
import {
  BarChart3,
  Bookmark,
  Briefcase,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Scale,
  Shield,
  SlidersHorizontal,
  Sun,
  User,
  X,
} from 'lucide-react';
import { AuthModal } from './components/AuthModal.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { PublicLandingPage } from './components/PublicLandingPage.tsx';
import { Button } from './components/ui/button.tsx';
import { AccountSubscriptionView } from './components/workspace/AccountSubscriptionView.tsx';
import { AdminCommandCentreView } from './components/workspace/AdminCommandCentreView.tsx';
import { DashboardOverviewView } from './components/workspace/DashboardOverviewView.tsx';
import { PortfolioAnalyticsView } from './components/workspace/PortfolioAnalyticsView.tsx';
import { ScreenerComparisonView } from './components/workspace/ScreenerComparisonView.tsx';
import { StockResearchView } from './components/workspace/StockResearchView.tsx';
import { WatchlistsHistoryView } from './components/workspace/WatchlistsHistoryView.tsx';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import {
  subscribeAuditLogs,
  subscribePortfolios,
  subscribeResearchReports,
  subscribeSupportTickets,
  subscribeTransactions,
  subscribeUserSubscriptions,
  subscribeWatchlists,
  type AuditLogRecord,
  type PortfolioRecord,
  type SavedResearchReportRecord,
  type SubscriptionRecord,
  type SupportTicketRecord,
  type WatchlistRecord,
} from './services/firestoreService.ts';
import type { PortfolioTransactionInput } from './types/financial.ts';

type WorkspaceTab =
  | 'overview'
  | 'research'
  | 'screener'
  | 'portfolio'
  | 'watchlists'
  | 'account'
  | 'governance'
  | 'admin';

const TAB_LABELS: Record<WorkspaceTab, string> = {
  overview: 'Dashboard Overview',
  research: 'Stock Research & Grounded AI',
  screener: 'Stock Screener & Peer Comparison',
  portfolio: 'Portfolio Analytics & Ledger',
  watchlists: 'Watchlists & Research History',
  account: 'Account, Subscription & Support',
  governance: 'Data Licensing & Compliance',
  admin: 'Admin Command Centre',
};

function InvestWiseShell() {
  const {
    user,
    account,
    platformSettings,
    authReady,
    isAdmin,
    isEmailVerified,
    logout,
  } = useAuth();

  const [viewMode, setViewMode] = useState<'landing' | 'workspace'>('landing');
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('overview');
  const [selectedSymbol, setSelectedSymbol] = useState('RELIANCE');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);

  // Real-time Firestore state (attached ONLY when verified & signed in)
  const [portfolios, setPortfolios] = useState<PortfolioRecord[]>([]);
  const [transactions, setTransactions] = useState<PortfolioTransactionInput[]>([]);
  const [watchlists, setWatchlists] = useState<WatchlistRecord[]>([]);
  const [reports, setReports] = useState<SavedResearchReportRecord[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>([]);
  const [tickets, setTickets] = useState<SupportTicketRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [isDark]);

  useEffect(() => {
    if (!user || !isEmailVerified) {
      setPortfolios([]);
      setTransactions([]);
      setWatchlists([]);
      setReports([]);
      setSubscriptions([]);
      setTickets([]);
      setAuditLogs([]);
      return;
    }

    const unsubs = [
      subscribePortfolios(user.uid, setPortfolios),
      subscribeTransactions(user.uid, setTransactions),
      subscribeWatchlists(user.uid, setWatchlists),
      subscribeResearchReports(user.uid, setReports),
      subscribeUserSubscriptions(user.uid, setSubscriptions),
      subscribeSupportTickets(user.uid, isAdmin, setTickets),
      subscribeAuditLogs(user.uid, isAdmin, setAuditLogs),
    ];

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [user, isEmailVerified, isAdmin]);

  function handleEnterWorkspace(initialTab?: string, symbol?: string) {
    if (symbol) setSelectedSymbol(symbol);
    if (
      initialTab &&
      (
        [
          'overview',
          'research',
          'screener',
          'portfolio',
          'watchlists',
          'account',
          'governance',
          'admin',
        ] as const
      ).includes(initialTab as WorkspaceTab)
    ) {
      setActiveTab(initialTab as WorkspaceTab);
    } else {
      setActiveTab('overview');
    }
    setViewMode('workspace');
  }

  function handleInspectSymbol(symbol: string) {
    setSelectedSymbol(symbol);
    setActiveTab('research');
  }

  async function handleLogout() {
    await logout();
    setActiveTab('overview');
    setViewMode('landing');
  }

  const navItems: Array<{
    id: WorkspaceTab;
    label: string;
    icon: typeof BarChart3;
    adminOnly?: boolean;
  }> = [
    { id: 'overview', label: 'Dashboard Overview', icon: LayoutDashboard },
    { id: 'research', label: 'Stock Research', icon: BarChart3 },
    { id: 'screener', label: 'Screener & Compare', icon: SlidersHorizontal },
    { id: 'portfolio', label: 'Portfolio Analytics', icon: Briefcase },
    { id: 'watchlists', label: 'Watchlists & History', icon: Bookmark },
    { id: 'account', label: 'Account & Settings', icon: User },
    { id: 'governance', label: 'Data & Compliance', icon: Scale },
    { id: 'admin', label: 'Admin Command', icon: Shield, adminOnly: true },
  ];

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-600 dark:bg-slate-950 dark:text-slate-300 text-sm">
        Initializing InvestWise AI session...
      </div>
    );
  }

  return (
    <>
      {viewMode === 'landing' ? (
        <PublicLandingPage
          platformSettings={platformSettings}
          isSignedIn={Boolean(user)}
          onEnterWorkspace={handleEnterWorkspace}
          onOpenAuth={() => setAuthModalOpen(true)}
        />
      ) : (
        <div className="min-h-screen flex bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
          {/* Desktop Sidebar */}
          <aside className="hidden lg:flex lg:w-64 lg:flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 shrink-0">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setViewMode('landing')}
                className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap"
              >
                InvestWise AI
              </button>
            </div>

            <nav className="flex-1 p-3 space-y-1">
              {navItems
                .filter((item) => !item.adminOnly || isAdmin)
                .map((item) => {
                  const Icon = item.icon;
                  const active = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveTab(item.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                        active
                          ? 'bg-teal-700 text-white dark:bg-teal-600'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
            </nav>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 text-xs space-y-2">
              {user ? (
                <div className="space-y-1">
                  <p className="font-semibold truncate">
                    {account?.displayName || user.displayName || 'Investor'}
                  </p>
                  <p className="text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
                  <p className="font-mono text-teal-800 dark:text-teal-400">
                    {account?.tier === 'premium' ? 'Premium Plan' : 'Free Plan'} ·{' '}
                    {isEmailVerified ? 'Verified' : 'Unverified'}
                  </p>
                </div>
              ) : (
                <p className="text-slate-500 dark:text-slate-400">
                  Public Research Preview · Sign in to save portfolios &amp; AI memos
                </p>
              )}
              <button
                type="button"
                onClick={() => setViewMode('landing')}
                className="text-teal-700 hover:underline dark:text-teal-400"
              >
                View Public Overview
              </button>
            </div>
          </aside>

          {/* Mobile Drawer */}
          {mobileNavOpen && (
            <div className="fixed inset-0 z-50 lg:hidden flex">
              <div
                className="fixed inset-0 bg-slate-950/50"
                onClick={() => setMobileNavOpen(false)}
              />
              <aside className="relative z-10 w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
                  <span className="text-base font-bold">InvestWise AI</span>
                  <button
                    type="button"
                    onClick={() => setMobileNavOpen(false)}
                    aria-label="Close navigation"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <nav className="flex-1 p-3 space-y-1">
                  {navItems
                    .filter((item) => !item.adminOnly || isAdmin)
                    .map((item) => {
                      const Icon = item.icon;
                      const active = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setActiveTab(item.id);
                            setMobileNavOpen(false);
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium ${
                            active
                              ? 'bg-teal-700 text-white'
                              : 'text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                </nav>
              </aside>
            </div>
          )}

          {/* Main Workspace Area */}
          <div className="flex-1 flex flex-col min-w-0">
            <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-5 py-3.5 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  onClick={() => setMobileNavOpen(true)}
                  className="lg:hidden p-1.5 rounded border border-slate-200 dark:border-slate-700"
                  aria-label="Open navigation"
                >
                  <Menu className="h-4 w-4" />
                </button>
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 truncate">
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    Workspace
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{TAB_LABELS[activeTab]}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsDark((prev) => !prev)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  aria-label="Toggle color theme"
                >
                  {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </button>

                {user ? (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setActiveTab('account')}
                      className="hidden sm:inline-flex"
                    >
                      <User className="h-3.5 w-3.5" />
                      {account?.displayName || user.displayName || 'Profile'}
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleLogout}>
                      <LogOut className="h-3.5 w-3.5" />
                      Sign Out
                    </Button>
                  </>
                ) : (
                  <Button size="sm" onClick={() => setAuthModalOpen(true)}>
                    Sign In
                  </Button>
                )}
              </div>
            </header>

            <main className="flex-1 p-5 lg:p-8 max-w-[1360px] w-full mx-auto">
              {activeTab === 'overview' && (
                <DashboardOverviewView
                  portfolios={portfolios}
                  transactions={transactions}
                  watchlists={watchlists}
                  reports={reports}
                  onNavigateTab={(tab) => setActiveTab(tab)}
                  onInspectSymbol={handleInspectSymbol}
                  onRequireAuth={() => setAuthModalOpen(true)}
                />
              )}
              {activeTab === 'research' && (
                <StockResearchView
                  selectedSymbol={selectedSymbol}
                  onSelectSymbol={setSelectedSymbol}
                  watchlists={watchlists}
                  isDark={isDark}
                  onRequireAuth={() => setAuthModalOpen(true)}
                />
              )}
              {activeTab === 'screener' && (
                <ScreenerComparisonView onInspectSymbol={handleInspectSymbol} />
              )}
              {activeTab === 'portfolio' && (
                <PortfolioAnalyticsView
                  portfolios={portfolios}
                  transactions={transactions}
                  onRequireAuth={() => setAuthModalOpen(true)}
                />
              )}
              {activeTab === 'watchlists' && (
                <WatchlistsHistoryView
                  watchlists={watchlists}
                  reports={reports}
                  onInspectSymbol={handleInspectSymbol}
                  onRequireAuth={() => setAuthModalOpen(true)}
                />
              )}
              {activeTab === 'account' && (
                <AccountSubscriptionView
                  subscriptions={subscriptions}
                  tickets={tickets}
                  auditLogs={auditLogs}
                  onRequireAuth={() => setAuthModalOpen(true)}
                />
              )}
              {activeTab === 'governance' && (
                <AdminCommandCentreView tickets={tickets} governanceOnly />
              )}
              {activeTab === 'admin' && isAdmin && (
                <AdminCommandCentreView tickets={tickets} auditLogs={auditLogs} />
              )}
            </main>
          </div>
        </div>
      )}

      <AuthModal
        open={authModalOpen}
        onOpenChange={setAuthModalOpen}
        onAuthenticated={() => handleEnterWorkspace('overview')}
      />
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <InvestWiseShell />
      </AuthProvider>
    </ErrorBoundary>
  );
}
