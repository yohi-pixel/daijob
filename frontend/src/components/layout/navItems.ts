export interface NavItem {
  to: string;
  /** 桌面顶栏用 */
  label: string;
  /** 移动端底栏用（窄） */
  short: string;
  icon: string;
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/jobs', label: '发现职位', short: '发现', icon: 'search' },
  { to: '/explore', label: '滑动探索', short: '探索', icon: 'compass' },
  { to: '/saved', label: '我的收藏', short: '收藏', icon: 'bookmark_border' },
  { to: '/resume', label: '简历管理', short: '简历', icon: 'description' },
];
