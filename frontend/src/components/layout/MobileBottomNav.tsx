import { NavLink } from 'react-router-dom';
import { useSavedJobsStore } from '../../stores/savedJobsStore';

const NAV_ITEMS = [
  { to: '/jobs', label: '发现', icon: 'search' },
  { to: '/map', label: '地图', icon: 'map' },
  { to: '/saved', label: '收藏', icon: 'bookmark' },
  { to: '/resume', label: '简历', icon: 'description' },
];

export function MobileBottomNav() {
  const savedCount = useSavedJobsStore((s) => s.saved.length);

  return (
    <nav className="md:hidden fixed bottom-0 w-full z-50 bg-surface border-t border-outline-variant/10 pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-4">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${
                isActive ? 'text-primary' : 'text-on-surface-variant'
              }`
            }
          >
            <span className="relative">
              <span className="material-symbols-outlined text-[22px]">{item.icon}</span>
              {item.to === '/saved' && savedCount > 0 && (
                <span className="absolute -top-1 -right-2 text-[10px] bg-primary text-on-primary px-1 rounded-full min-w-[16px] text-center">
                  {savedCount}
                </span>
              )}
            </span>
            {item.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
