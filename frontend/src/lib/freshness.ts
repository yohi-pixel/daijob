/**
 * 新鲜度：秋招里判断一条岗位该不该点开，第一问是「还新吗」。
 *
 * 实测数据分布（13352 条）：7 天内仅 1.6%，22 天以上 73%，无时间 20%。
 * 所以这个信号会亮在一个很小的少数上 —— 这正是信号该有的样子。
 */

export type FreshTone = 'signal' | 'muted' | 'unknown';

export interface Freshness {
  /** 相对标签，例如「刚发布」「12 天前」「时间未知」 */
  label: string;
  tone: FreshTone;
  /** 是否够新，值得用信号黄 */
  isFresh: boolean;
  days: number | null;
  /** 精确日期，给 title 属性用；无法解析时为空串 */
  exact: string;
  /** 紧凑日期：当年 MM-DD，跨年 YYYY-MM。成列等宽，可以竖着比。 */
  short: string;
}

const FRESH_DAYS = 7;

function parse(value: string | null | undefined): Date | null {
  if (!value) return null;
  const s = String(value).trim();
  if (!s || s === 'None' || s === 'null') return null;
  // 后端统一为 'YYYY-MM-DD HH:mm:ss'；兼容带 T 的 ISO 写法与纯日期
  const normalized = s.includes('T') ? s : s.replace(' ', 'T');
  const d = new Date(normalized);
  if (!Number.isNaN(d.getTime())) return d;
  const fallback = new Date(s.slice(0, 10));
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

export function getFreshness(
  publishTime: string | null | undefined,
  now: Date = new Date(),
): Freshness {
  const unknown: Freshness = {
    label: '时间未知',
    tone: 'unknown',
    isFresh: false,
    days: null,
    exact: '',
    short: '—',
  };

  const d = parse(publishTime);
  if (!d) return unknown;

  const days = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  const exact = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
  const short = d.getFullYear() === now.getFullYear() ? exact.slice(5) : exact.slice(0, 7);

  // 未来时间属于源站数据异常，不当作「新」使用
  if (days < 0) return { ...unknown, exact, short };

  const mk = (label: string, tone: FreshTone): Freshness => ({
    label,
    tone,
    isFresh: tone === 'signal',
    days,
    exact,
    short,
  });

  if (days === 0) return mk('刚发布', 'signal');
  if (days <= FRESH_DAYS) return mk(`${days} 天前`, 'signal');
  if (days <= 30) return mk(`${days} 天前`, 'muted');
  if (days <= 365) return mk(`${Math.round(days / 30)} 个月前`, 'muted');
  return mk(`${Math.round(days / 365)} 年前`, 'muted');
}
