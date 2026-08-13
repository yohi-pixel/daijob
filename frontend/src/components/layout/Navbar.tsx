import { useAuthStore } from '../../stores/authStore';

interface NavbarProps {
  onAuthClick: () => void;
}

export function Navbar({ onAuthClick }: NavbarProps) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  return (
    <nav className="glass-nav fixed top-0 w-full z-50 border-b border-outline-variant/10 bg-surface/80">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">work</span>
          <span className="font-bold text-lg text-on-surface">YesJob</span>
        </div>
        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-on-surface-variant hidden sm:block">{user.email}</span>
              <button
                onClick={logout}
                className="text-sm text-on-surface-variant hover:text-error transition-colors"
              >
                退出
              </button>
            </div>
          ) : (
            <button
              onClick={onAuthClick}
              className="text-sm font-semibold text-on-primary punch-gradient px-4 py-2 rounded-lg shadow-sm"
            >
              登录 / 注册
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
