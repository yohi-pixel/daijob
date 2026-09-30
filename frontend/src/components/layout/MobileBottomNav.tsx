import { NavLink } from 'react-router-dom';
import { useSavedJobsStore } from '../../stores/savedJobsStore';
import { Icon } from '../common/Icon';
import { NAV_ITEMS } from './navItems';

export function MobileBottomNav() {
  const savedCount = useSavedJobsStore((s) => s.saved.length);

  return (
    <nav className="fixed bottom-0 z-50 w-full border-t border-line bg-white/95 bar-blur pb-[env(safe-area-inset-bottom)] md:hidden">
      <div className="grid grid-cols-4">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 pb-2 pt-2.5 text-micro transition-colors ${
                isActive ? 'font-medium text-ink' : 'text-muted'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className="relative">
                  <Icon name={item.icon} size={21} strokeWidth={isActive ? 2 : 1.6} />
                  {item.to === '/saved' && savedCount > 0 && (
                    <span className="num absolute -right-2.5 -top-1 min-w-[15px] rounded-full bg-primary px-1 text-center text-[10px] leading-[15px] text-on-primary">
                      {savedCount}
                    </span>
                  )}
                </span>
                {item.short}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
