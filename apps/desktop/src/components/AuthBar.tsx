import { useAuthStore } from "../stores/authStore";
import { useSettingsStore } from "../stores/settingsStore";
import { chatLimitFor } from "../lib/constants";

export function AuthBar() {
  const session = useAuthStore((s) => s.session);
  const isLoading = useAuthStore((s) => s.isLoading);
  const openSignIn = useAuthStore((s) => s.openSignIn);
  const logout = useAuthStore((s) => s.logout);
  const refreshTier = useAuthStore((s) => s.refreshTier);

  const { billingTier, serverChatCount } = useSettingsStore();
  const limit = chatLimitFor(billingTier);
  const remaining = Math.max(0, limit - serverChatCount);

  if (!session) {
    return (
      <div className="auth-bar">
        <span className="badge badge-free">free · {remaining}/{limit} left</span>
        <button onClick={openSignIn} disabled={isLoading} className="btn btn-primary">
          {isLoading ? "opening browser…" : "Sign in with PromptPack"}
        </button>
      </div>
    );
  }

  return (
    <div className="auth-bar">
      <div className="user-info">
        {session.image_url && <img src={session.image_url} alt="" className="avatar" />}
        <div className="user-meta">
          <span className="user-name">{session.name ?? session.email ?? "user"}</span>
          <span className={`badge badge-${billingTier}`}>
            {billingTier} · {remaining}/{limit} left
          </span>
        </div>
      </div>
      <div className="auth-actions">
        <button onClick={refreshTier} className="btn btn-ghost" title="Refresh tier">
          ↻
        </button>
        <button onClick={logout} className="btn btn-ghost">
          Sign out
        </button>
      </div>
    </div>
  );
}
