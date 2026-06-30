import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3 } from "lucide-react";
import { useAuth } from "./AuthContext";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch {
      setError("Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[var(--bg)]">
      {/* Left brand panel */}
      <div className="hidden w-1/2 flex-col justify-between bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)] p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-white/15">
            <BarChart3 size={22} />
          </div>
          <div>
            <div className="text-lg font-bold leading-tight">ASIN Tracker</div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-white/70">
              Kratos Analytics
            </div>
          </div>
        </div>
        <div>
          <h1 className="text-4xl font-bold leading-tight">
            One dashboard for your entire Amazon catalog.
          </h1>
          <p className="mt-4 max-w-md text-white/80">
            Track ASINs, monitor pricing & ratings, and get AI-powered insights — all in one place.
          </p>
        </div>
        <div className="text-sm text-white/60">© {new Date().getFullYear()} Kratos Analytics</div>
      </div>

      {/* Login form */}
      <div className="flex w-full items-center justify-center p-8 lg:w-1/2">
        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-5">
          <div>
            <h2 className="text-2xl font-bold text-[var(--text)]">Sign in</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Welcome back. Please enter your details.
            </p>
          </div>

          {error && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-400">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-[var(--text)]">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--panel-2)] px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--muted)] outline-none focus:border-[var(--accent)]"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text)]">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--panel-2)] px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--muted)] outline-none focus:border-[var(--accent)]"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[var(--accent)] py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--accent-2)] disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
