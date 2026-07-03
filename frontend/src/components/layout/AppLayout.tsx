import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  BarChart3,
  Bot,
  LayoutDashboard,
  LineChart,
  LogOut,
  Moon,
  Package,
  RefreshCw,
  Sun,
  User,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../auth/AuthContext";
import { useTheme } from "../../theme/ThemeContext";
import { formatDateTime } from "../../lib/utils";

const navItems = [
  { to: "/dashboard", label: "Business Dashboard", icon: LayoutDashboard },
  { to: "/analytics", label: "Business Analytics", icon: LineChart },
  { to: "/asins", label: "Manage ASINs", icon: Package },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const handleLogout = () => {
    logout();
    navigate("/login");
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
            <h1 className="text-base font-bold leading-tight text-[var(--text)]">AI Business Analytics</h1>
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
            onClick={() => qc.invalidateQueries()}
            className="flex items-center gap-2 rounded-lg bg-[var(--accent)] px-3.5 py-2 text-sm font-medium text-white transition hover:bg-[var(--accent-2)]"
          >
            <RefreshCw size={15} /> Refresh
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
