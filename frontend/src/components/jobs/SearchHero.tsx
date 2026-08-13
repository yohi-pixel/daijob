import { useState } from 'react';

interface SearchHeroProps {
  keyword: string;
  onSearch: (q: string) => void;
}

const HOT_QUERIES = ['后端开发', '算法', '前端', '产品经理', '数据分析'];

export function SearchHero({ keyword, onSearch }: SearchHeroProps) {
  const [input, setInput] = useState(keyword);

  const submit = (q: string) => {
    setInput(q);
    onSearch(q);
  };

  return (
    <div className="bg-surface px-4 pt-6 pb-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-on-surface-variant text-[20px]">
              search
            </span>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit(input)}
              placeholder="搜索职位、技能、公司…"
              className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest pl-11 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <button
            onClick={() => submit(input)}
            className="punch-gradient text-on-primary font-semibold px-5 py-3 rounded-xl text-sm shadow-sm"
          >
            搜索
          </button>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {HOT_QUERIES.map((q) => (
            <button
              key={q}
              onClick={() => submit(q)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                keyword === q
                  ? 'bg-primary-container/30 border-primary/40 text-on-primary-container'
                  : 'border-outline-variant text-on-surface-variant hover:border-primary/40 hover:text-primary'
              }`}
            >
              {q}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
