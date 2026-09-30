import { useState } from 'react';
import { Icon } from '../common/Icon';

interface SearchBarProps {
  keyword: string;
  onSearch: (q: string) => void;
}

/**
 * 检索框。原先居中在 max-w-3xl、而列表左对齐在 max-w-7xl —— 两条轴线。
 * 现在与列表同轴，宽度按可读性封顶，不跟着三列栅格拉满。
 */
export function SearchBar({ keyword, onSearch }: SearchBarProps) {
  const [input, setInput] = useState(keyword);

  const submit = (q: string) => {
    setInput(q);
    onSearch(q);
  };

  return (
    <div className="flex w-full max-w-[34rem] items-center gap-2">
      <div className="relative min-w-0 flex-1">
        <Icon
          name="search"
          size={17}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
        />
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit(input)}
          placeholder="搜索职位、公司、技能"
          aria-label="搜索职位"
          className="h-9 w-full rounded-md border border-line bg-surface pl-9 pr-3 text-body text-ink placeholder:text-muted focus:border-ink focus:outline-none focus:ring-0"
        />
      </div>
      <button
        type="button"
        onClick={() => submit(input)}
        className="h-9 shrink-0 rounded-md bg-primary px-4 text-body font-medium text-on-primary transition-colors hover:bg-secondary-dim"
      >
        搜索
      </button>
    </div>
  );
}
