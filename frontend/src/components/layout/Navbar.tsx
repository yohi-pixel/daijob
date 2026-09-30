import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useSavedJobsStore } from '../../stores/savedJobsStore';
import { PixelSprite } from '../pixel/PixelSprite';
import { Icon } from '../common/Icon';
import { NAV_ITEMS } from './navItems';

interface NavbarProps {
  onAuthClick: () => void;
}

/**
 * 顶栏同时承担品牌与主导航 —— 原先左侧那根只有 4 项的图标栏去掉了，
 * 省下的 224px 全部还给职位列表。
 */
export function Navbar({ onAuthClick }: NavbarProps) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const savedCount = useSavedJobsStore((s) => s.saved.length);

  return (
    <nav className="bar-blur sticky top-0 z-50 border-b border-line bg-white/85">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-2 px-4 sm:gap-6 sm:px-6">
        <NavLink to="/jobs" className="flex shrink-0 items-center gap-2.5" aria-label="逮JOB 首页">
          <PixelSprite animate={false} scale={1} />
          <span className="text-[17px] font-semibold leading-none tracking-tight text-ink">
            逮JOB
          </span>
        </NavLink>

        <div className="hidden h-14 items-stretch md:flex">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `relative flex items-center gap-1.5 px-3 text-body transition-colors ${
                  isActive ? 'font-medium text-ink' : 'text-muted hover:text-ink'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon name={item.icon} size={17} />
                  <span>{item.label}</span>
                  {item.to === '/saved' && savedCount > 0 && (
                    <span className="num text-micro text-muted">{savedCount}</span>
                  )}
                  {isActive && (
                    <span className="absolute inset-x-3 bottom-0 h-[2px] rounded-full bg-ink" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-3">
          {user ? (
            <>
              <span className="hidden text-meta text-muted sm:block">{user.email}</span>
              <button
                type="button"
                onClick={logout}
                className="flex items-center gap-1.5 text-meta text-muted transition-colors hover:text-ink"
              >
                <Icon name="logout" size={16} />
                退出
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onAuthClick}
              className="rounded-md bg-primary px-3.5 py-2 text-meta font-medium text-on-primary transition-colors hover:bg-secondary-dim"
            >
              登录 / 注册
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
