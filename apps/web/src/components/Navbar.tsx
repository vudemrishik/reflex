import { useAuth } from "../context/AuthContext";
import { getGoogleLoginUrl } from "../api/client";

export function Navbar() {
  const { user, loading, logout } = useAuth();

  return (
    <header className="flex items-center justify-between py-5">
      <div className="flex items-center gap-2">
        <span className="text-2xl">⚡</span>
        <span className="text-xl font-black tracking-tight">
          REFLEX
        </span>
        <span className="ml-2 hidden rounded-full border border-white/15 px-2 py-0.5 font-mono text-[11px] text-white/50 sm:inline">
          1-sec higher number
        </span>
      </div>

      <div>
        {loading ? (
          <div className="h-9 w-24 animate-pulse rounded-full bg-white/10" />
        ) : user ? (
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className="text-sm font-semibold leading-tight">
                {user.display_name}
              </div>
              <div className="font-mono text-[11px] text-white/40">
                {user.email}
              </div>
            </div>
            {user.avatar_url && (
              <img
                src={user.avatar_url}
                alt={user.display_name}
                className="h-9 w-9 rounded-full border border-white/20"
              />
            )}
            <button
              onClick={logout}
              className="rounded-full border border-white/15 px-4 py-1.5 text-sm text-white/70 transition hover:border-white/30 hover:text-white"
            >
              Logout
            </button>
          </div>
        ) : (
          <a
            href={getGoogleLoginUrl()}
            className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-gray-900 transition hover:bg-gray-200"
          >
            <span className="font-bold text-[#4285F4]">G</span>
            Sign in with Google
          </a>
        )}
      </div>
    </header>
  );
}
