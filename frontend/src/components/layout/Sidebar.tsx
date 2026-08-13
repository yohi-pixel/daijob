import { NavLink } from 'react-router-dom';
import { useSavedJobsStore } from '../../stores/savedJobsStore';

interface SidebarProps {
  onAuthClick: () => void;
}

const NAV_ITEMS = [
  { to: '/jobs', label: '发现职位', icon: 'search' },
  { to: '/map', label: '地图模式', icon: 'map' },
  { to: '/saved', label: '我的收藏', icon: 'bookmark' },
  { to: '/resume', label: '简历管理', icon: 'description' },
];

export function Sidebar({ onAuthClick }: SidebarProps) {
  const savedCount = useSavedJobsStore((s) => s.saved.length);

  return (
    <aside className="hidden md:flex w-56 shrink-0 flex-col gap-1 p-4 border-r border-outline-variant/10 sticky top-16 self-start h-[calc(100vh-4rem)]">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              isActive
                ? 'bg-primary-container/20 text-on-primary-container'
                : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
            }`
          }
        >
          <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
          <span>{item.label}</span>
          {item.to === '/saved' && savedCount > 0 && (
            <span className="ml-auto text-xs bg-primary-container/30 text-on-primary-container px-2 py-0.5 rounded-full">
              {savedCount}
            </span>
          )}
        </NavLink>
      ))}
      <div className="mt-auto pt-4">
        <button
          onClick={onAuthClick}
          className="w-full text-sm text-on-surface-variant hover:text-primary transition-colors text-left px-4 py-2"
        >
          账号设置
        </button>
      </div>
    </aside>
  );
}
