import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useState } from "react";
import {
  BarChart3,
  BellRing,
  Bot,
  LayoutDashboard,
  LineChart,
  Radar,
  LogOut,
  Moon,
  Package,
  RefreshCw,
  ShoppingBag,
  Sun,
  User,
  UsersRound,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useRunScrape } from "../../api/hooks";
import { useAuth } from "../../auth/AuthContext";
import { useTheme } from "../../theme/ThemeContext";
import { formatDateTime } from "../../lib/utils";
import { errorMessage, useToast } from "../ui/Toast";

const navItems = [
  { to: "/dashboard", label: "Business Dashboard", icon: LayoutDashboard },
  { to: "/analytics", label: "Business Analytics", icon: LineChart },
  { to: "/operational-analytics", label: "Target Vs Achieved", icon: Radar },
  { to: "/alerts", label: "Product Alerts", icon: BellRing },
  { to: "/sales", label: "Sales Report", icon: ShoppingBag },
  { to: "/users", label: "User Management", icon: UsersRound },
  { to: "/asins", label: "Manage ASINs", icon: Package },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const scrape = useRunScrape();
  const [refreshing, setRefreshing] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      // Force a refetch of every mounted query (ignores staleTime).
      await qc.refetchQueries({ type: "active" });
    } finally {
      setRefreshing(false);
    }
  };

  const handleScrape = async () => {
    try {
      const run = await scrape.mutateAsync();
      toast.success(`Scrape ${run.status}: ${run.succeeded}/${run.total} products updated.`);
    } catch (error) {
      toast.error(errorMessage(error, "The scrape could not be started."));
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)]">
      {/* Top header */}
      <header className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--panel)] px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--accent)] text-white">
            <BarChart3 size={20} />
          </div>
          <div>
            <h1 className="text-base font-bold leading-tight text-[var(--text)]">ASIN Tracker</h1>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)]">
              Kratos Analytics
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--muted)]">
            <User size={14} /> {user?.email}
          </div>
          <button
            onClick={toggle}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--muted)] transition hover:text-[var(--text)]"
            title="Toggle theme"
          >
            {theme === "dark" ? <Moon size={16} /> : <Sun size={16} />}
          </button>
          <button
            onClick={handleScrape}
            disabled={scrape.isPending}
            className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3.5 py-2 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--panel-2)] disabled:opacity-60"
            title="Scrape all active ASINs now"
          >
            <RefreshCw size={15} className={scrape.isPending ? "animate-spin" : ""} />
            {scrape.isPending ? "Scraping…" : "Scrape now"}
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 rounded-lg bg-[var(--accent)] px-3.5 py-2 text-sm font-medium text-white transition hover:bg-[var(--accent-2)] disabled:opacity-60"
          >
            <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 rounded-lg border border-rose-500/30 px-3.5 py-2 text-sm font-medium text-rose-400 transition hover:bg-rose-500/10"
          >
            <LogOut size={15} /> Sign Out
          </button>
        </div>
      </header>

      {/* Status strip */}
      <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--bg)] px-5 py-1.5 text-xs">
        <span className="flex items-center gap-2 text-emerald-400">
          <span className="h-2 w-2 rounded-full bg-emerald-400" /> Real-time connection active
        </span>
        <span className="text-[var(--muted)]">
          Last updated: <span className="text-[var(--text)]">{formatDateTime(Date.now())}</span>
        </span>
      </div>

      <div className="flex flex-1">
        {/* Sidebar */}
        <aside className="w-60 border-r border-[var(--border)] bg-[var(--panel)] p-3">
          <nav className="space-y-1">
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                    isActive
                      ? "bg-[var(--accent)] text-white"
                      : "text-[var(--muted)] hover:bg-[var(--panel-2)] hover:text-[var(--text)]"
                  }`
                }
              >
                <Icon size={18} /> {label}
              </NavLink>
            ))}
          </nav>

          <div className="mt-6 rounded-lg border border-[var(--border)] bg-[var(--panel-2)] p-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text)]">
              <Bot size={14} className="text-[var(--accent)]" /> AI Assistant
            </div>
            <p className="mt-1 text-[11px] text-[var(--muted)]">Insights & Q&A arrive in Phase 6.</p>
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
