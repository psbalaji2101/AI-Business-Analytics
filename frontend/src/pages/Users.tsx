import { useState, type FormEvent } from "react";
import { Plus, UserRound, UsersRound } from "lucide-react";
import { useCreateUser, useUsers } from "../api/hooks";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input, Spinner } from "../components/ui/Spinner";
import { errorMessage, useToast } from "../components/ui/Toast";
import { formatDateTime } from "../lib/utils";

export default function Users() {
  const { data: users, isLoading } = useUsers();
  const createUser = useCreateUser();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    try {
      const user = await createUser.mutateAsync({ email, password });
      toast.success(`${user.email} was added.`);
      setEmail("");
      setPassword("");
    } catch (error) {
      setFormError(errorMessage(error));
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-bold text-[var(--text)]">
          <UsersRound className="text-[var(--accent)]" size={24} /> User Management
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Create dashboard users and track when they last signed in.
        </p>
      </div>

      <Card className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--accent)]/15 text-[var(--accent)]">
            <UserRound size={17} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--text)]">Create user</h3>
            <p className="text-xs text-[var(--muted)]">The user can sign in with this email and password.</p>
          </div>
        </div>
        <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3">
          <label className="min-w-[220px] flex-1 text-xs font-medium text-[var(--muted)]">
            Email address
            <Input
              type="email"
              className="mt-1 w-full"
              placeholder="user@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label className="min-w-[220px] flex-1 text-xs font-medium text-[var(--muted)]">
            Password
            <Input
              type="password"
              className="mt-1 w-full"
              placeholder="Minimum 8 characters"
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          <Button type="submit" icon={<Plus size={15} />} disabled={createUser.isPending}>
            {createUser.isPending ? "Creating…" : "Create user"}
          </Button>
        </form>
        {formError && <p className="mt-3 text-sm text-rose-400">{formError}</p>}
      </Card>

      <Card>
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
          <h3 className="text-sm font-semibold text-[var(--text)]">Tracked users</h3>
          <span className="text-xs text-[var(--muted)]">{users?.length ?? 0} users</span>
        </div>
        {isLoading ? (
          <Spinner label="Loading users…" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-[var(--muted)]">
                  <th className="px-5 py-3">User</th>
                  <th className="px-5 py-3">Created</th>
                  <th className="px-5 py-3">Last sign-in</th>
                </tr>
              </thead>
              <tbody>
                {users?.map((user) => (
                  <tr key={user.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--panel-2)]">
                    <td className="px-5 py-3 font-medium text-[var(--text)]">{user.email}</td>
                    <td className="px-5 py-3 text-[var(--muted)]">{formatDateTime(user.created_at)}</td>
                    <td className="px-5 py-3 text-[var(--muted)]">
                      {user.last_login_at ? formatDateTime(user.last_login_at) : "Never signed in"}
                    </td>
                  </tr>
                ))}
                {!users?.length && (
                  <tr>
                    <td colSpan={3} className="px-5 py-12 text-center text-[var(--muted)]">No users yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
