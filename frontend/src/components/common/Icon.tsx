import type { ReactNode } from 'react';

/**
 * 自绘线条图标集。
 *
 * 替换掉原先挂在 fonts.googleapis.com 的 Material Symbols 图标字体：
 * 一是不再依赖外部域名（那个域名在部分网络不可达时，全站图标会退化成裸文字），
 * 二是自绘可以统一 1.75px 描边与圆头圆角，跟这套「墨 + 信号」的视觉对齐。
 *
 * 所有图标 24×24 视觉栅格，stroke 用 currentColor，默认纯装饰（aria-hidden）。
 * 若图标是按钮里唯一的内容，请在按钮上加 aria-label。
 */

const open = (
  <>
    <path d="M4.2 9.9 20.5 3.5l-6.7 17-2.6-7.8z" />
    <path d="M11.2 12.7 20.5 3.5" />
  </>
);

const PATHS: Record<string, ReactNode> = {
  // —— 导航与检索 ——
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.3 15.3 20 20" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M15.8 8.2 10.6 10.6 8.2 15.8 13.4 13.4z" />
    </>
  ),
  map: (
    <>
      <path d="M9 4.5 3.5 6.8v13L9 17.4l6 2.4 5.5-2.3v-13L15 6.9z" />
      <path d="M9 4.5v12.9" />
      <path d="M15 6.9v12.9" />
    </>
  ),
  bookmark_border: <path d="M7 4.5h10a1 1 0 0 1 1 1V20l-6-4-6 4V5.5a1 1 0 0 1 1-1z" />,
  description: (
    <>
      <path d="M6.5 3.5h7l5 5v12h-12z" />
      <path d="M13.5 3.5v5h5" />
      <path d="M9.5 13h5" />
      <path d="M9.5 16.5h3.5" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8.5" r="4" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </>
  ),

  // —— 动作 ——
  close: (
    <>
      <path d="M6 6 18 18" />
      <path d="M18 6 6 18" />
    </>
  ),
  check: <path d="M5 12.5 10 17.5 19 7" />,
  plus: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  edit: (
    <>
      <path d="M4.5 19.5h4L19.5 8.5l-4-4L4.5 15.5z" />
      <path d="M14.5 5.5l4 4" />
    </>
  ),
  copy: (
    <>
      <rect x="8.5" y="8.5" width="11" height="11" rx="2" />
      <path d="M15.5 8.5V6.5a2 2 0 0 0-2-2h-6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
    </>
  ),
  delete: (
    <>
      <path d="M4.5 6.8h15" />
      <path d="M9.5 6.8V5.2A1.2 1.2 0 0 1 10.7 4h2.6a1.2 1.2 0 0 1 1.2 1.2v1.6" />
      <path d="M6.6 6.8 7.5 19.6h9L17.4 6.8" />
      <path d="M10.5 10.4v5.6" />
      <path d="M13.5 10.4v5.6" />
    </>
  ),
  send: open,
  refresh: (
    <>
      <path d="M20 12a8 8 0 1 1-2.4-5.7" />
      <path d="M20 4.2v4.6h-4.6" />
    </>
  ),
  filter: (
    <>
      <path d="M4 6.5h16" />
      <path d="M7 12h10" />
      <path d="M10 17.5h4" />
    </>
  ),
  tune: (
    <>
      <path d="M4 8h16" />
      <path d="M4 16h16" />
      <circle cx="9" cy="8" r="2" />
      <circle cx="15" cy="16" r="2" />
    </>
  ),
  external: (
    <>
      <path d="M4.5 7.5v12h12v-4" />
      <path d="M13.5 4.5h6v6.5" />
      <path d="M19.5 4.5 11.5 12.5" />
    </>
  ),
  download: (
    <>
      <path d="M12 4v11" />
      <path d="M7.5 10.8 12 15.3l4.5-4.5" />
      <path d="M5 19.5h14" />
    </>
  ),
  logout: (
    <>
      <path d="M14.5 7.5V6a2 2 0 0 0-2-2h-6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-1.5" />
      <path d="M10 12h10" />
      <path d="M17 9l3 3-3 3" />
    </>
  ),

  // —— 方向 ——
  chevron_down: <path d="M6.5 9.5 12 15 17.5 9.5" />,
  chevron_up: <path d="M6.5 14.5 12 9 17.5 14.5" />,
  chevron_left: <path d="M14.5 6 8.5 12l6 6" />,
  chevron_right: <path d="M9.5 6l6 6-6 6" />,
  arrow_back: (
    <>
      <path d="M19.5 12H4.5" />
      <path d="M11 5.5 4.5 12 11 18.5" />
    </>
  ),
  expand: (
    <>
      <path d="M4.5 9.5V4.5h5" />
      <path d="M14.5 4.5h5v5" />
      <path d="M19.5 14.5v5h-5" />
      <path d="M9.5 19.5h-5v-5" />
    </>
  ),
  collapse: (
    <>
      <path d="M9.5 4.5v5h-5" />
      <path d="M14.5 4.5v5h5" />
      <path d="M9.5 19.5v-5h-5" />
      <path d="M14.5 19.5v-5h5" />
    </>
  ),

  // —— 状态与元信息 ——
  bolt: <path d="M13.2 3 6.6 13.4h4.3L10.4 21l6.9-10.6h-4.4z" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5.4l3.6 2.2" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s6.5-6.2 6.5-10.5a6.5 6.5 0 1 0-13 0C5.5 14.8 12 21 12 21z" />
      <circle cx="12" cy="10.4" r="2.4" />
    </>
  ),
  error: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V13" />
      <circle cx="12" cy="16.4" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  inbox: (
    <>
      <rect x="4.5" y="5.5" width="15" height="13" rx="2" />
      <path d="M4.5 13h4.2l1.4 2.4h4.8L16.3 13h3.2" />
    </>
  ),
  work: (
    <>
      <rect x="3.5" y="8.5" width="17" height="11" rx="2" />
      <path d="M9 8.5V6.2A1.2 1.2 0 0 1 10.2 5h3.6A1.2 1.2 0 0 1 15 6.2v2.3" />
      <path d="M3.5 13.2h17" />
    </>
  ),
  smart_toy: (
    <>
      <rect x="4.5" y="8" width="15" height="11.5" rx="3.5" />
      <path d="M12 8V5.4" />
      <circle cx="12" cy="4.3" r="1.2" />
      <circle cx="9.3" cy="13.6" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="14.7" cy="13.6" r="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  picture_as_pdf: (
    <>
      <path d="M6.5 3.5h7l5 5v12h-12z" />
      <path d="M13.5 3.5v5h5" />
      <path d="M9.5 12.5h5" />
      <path d="M9.5 16h5" />
      <path d="M9.5 19.5h3" />
    </>
  ),
  explore_off: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M15.8 8.2 10.6 10.6 8.2 15.8 13.4 13.4z" />
      <path d="M4.2 4.2 19.8 19.8" />
    </>
  ),

  // —— 勾选（筛选项）——
  check_box: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M8 12.4 10.8 15.2 16 9.4" />
    </>
  ),
  check_box_outline_blank: <rect x="4" y="4" width="16" height="16" rx="3" />,

  unknown: <circle cx="12" cy="12" r="8.5" />,
};

/** 实心填充的图标（未描边） */
const SOLID = new Set(['bookmark']);

PATHS.bookmark = <path d="M7 4.5h10a1 1 0 0 1 1 1V20l-6-4-6 4V5.5a1 1 0 0 1 1-1z" />;

/** 旧 Material Symbols 名 → 本图标集（便于整站替换时不漏） */
const ALIAS: Record<string, string> = {
  expand_more: 'chevron_down',
  expand_less: 'chevron_up',
  keyboard_arrow_down: 'chevron_down',
  keyboard_arrow_up: 'chevron_up',
  filters: 'filter',
  filter_list: 'filter',
  close_fullscreen: 'collapse',
  open_in_full: 'expand',
  briefcase: 'work',
  doc: 'description',
  file_text: 'description',
  robot: 'smart_toy',
  send_plane: 'send',
  back: 'arrow_back',
  x: 'close',
  warning: 'error',
  alert: 'error',
  caret_down: 'chevron_down',
  caret_up: 'chevron_up',
  check_square: 'check_box',
  square: 'check_box_outline_blank',
  location: 'pin',
  open_in_new: 'external',
};

export interface IconProps {
  name: string;
  size?: number;
  className?: string;
  strokeWidth?: number;
}

export function Icon({ name, size = 20, className, strokeWidth = 1.75 }: IconProps) {
  const key = PATHS[name] ? name : ALIAS[name] ?? 'unknown';
  const solid = SOLID.has(key);

  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill={solid ? 'currentColor' : 'none'}
      stroke={solid ? 'none' : 'currentColor'}
      strokeWidth={solid ? 0 : strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={{ flexShrink: 0 }}
    >
      {PATHS[key]}
    </svg>
  );
}

export default Icon;
