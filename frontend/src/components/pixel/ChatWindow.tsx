import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSSE } from '../../hooks/useSSE';
import { SSE_ENDPOINTS, recommendJobs } from '../../services/aiApi';
import { buildResumeContext } from '../../lib/resumeText';
import { readResumeModules } from '../../lib/resumeCompat';
import { useAuthStore } from '../../stores/authStore';
import type { ChatMessage } from '../../types/ai';
import type { JobSummary } from '../../types/job';

interface ChatWindowProps {
  onClose: () => void;
  onProfileReady: () => void;
  onExtract: () => void;
}

/**
 * 像素精灵对话窗口：SSE 多轮对话 + 画像收集 + 岗位推荐。
 * 首条消息注入简历上下文（修复旧版 m.type 失效 bug）。
 */
export function ChatWindow({ onClose, onProfileReady, onExtract }: ChatWindowProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [profileReady, setProfileReady] = useState(false);
  const [recommendations, setRecommendations] = useState<JobSummary[]>([]);
  const [recommendLoading, setRecommendLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  const { status, start, abort } = useSSE({
    url: SSE_ENDPOINTS.chat,
    onContent: (delta) => {
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.role === 'assistant') {
          const updated = [...prev];
          updated[updated.length - 1] = { ...last, content: last.content + delta };
          return updated;
        }
        return [...prev, { role: 'assistant', content: delta }];
      });
    },
    onProfileReady: () => {
      setProfileReady(true);
      onProfileReady();
      loadRecommendations();
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => () => abort(), [abort]);

  const loadRecommendations = async () => {
    setRecommendLoading(true);
    try {
      const res = await recommendJobs(5);
      setRecommendations(res.jobs ?? []);
    } catch {
      /* ignore */
    } finally {
      setRecommendLoading(false);
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || status === 'streaming' || status === 'loading') return;
    setInput('');
    const isFirst = messages.length === 0;
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    // 首条消息附带简历上下文
    const context = isFirst ? buildResumeContext(readResumeModules()) : '';
    await start({ message: text, session_id: '', context });
  };

  const busy = status === 'streaming' || status === 'loading';

  return (
    <div
      className={`fixed z-[120] bg-surface shadow-2xl rounded-2xl flex flex-col overflow-hidden transition-all ${
        expanded
          ? 'inset-2 md:inset-6'
          : 'bottom-24 right-4 md:right-6 w-[calc(100vw-2rem)] max-w-[360px] h-[480px] max-h-[70vh]'
      }`}
    >
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-3 bg-primary text-on-primary">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">smart_toy</span>
          <span className="text-sm font-semibold">小逮 · 求职助手</span>
          {user && <span className="text-[11px] opacity-70">{user.email}</span>}
        </div>
        <div className="flex gap-1">
          <button onClick={() => setExpanded((e) => !e)} className="p-1 rounded hover:bg-on-primary/10">
            <span className="material-symbols-outlined text-[18px]">{expanded ? 'close_fullscreen' : 'open_in_full'}</span>
          </button>
          <button onClick={onClose} className="p-1 rounded hover:bg-on-primary/10">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      </div>

      {/* 消息区 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-surface-container-lowest/50">
        {messages.length === 0 && (
          <div className="text-center py-8 text-sm text-on-surface-variant">
            <p>你好！我是小逮 👋</p>
            <p className="mt-1 text-xs">告诉我你的求职意向、技能和经历，</p>
            <p className="text-xs">我帮你匹配合适的岗位并优化简历。</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'bg-primary text-on-primary rounded-br-sm'
                  : 'bg-surface border border-outline-variant/30 rounded-bl-sm text-on-surface'
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div className="bg-surface border border-outline-variant/30 px-4 py-2.5 rounded-2xl rounded-bl-sm">
              <span className="inline-flex gap-1">
                <span className="w-1.5 h-1.5 bg-primary/50 rounded-full animate-bounce" />
                <span className="w-1.5 h-1.5 bg-primary/50 rounded-full animate-bounce [animation-delay:0.15s]" />
                <span className="w-1.5 h-1.5 bg-primary/50 rounded-full animate-bounce [animation-delay:0.3s]" />
              </span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 推荐区 */}
      {profileReady && (
        <div className="border-t border-outline-variant/20 bg-surface-container-low p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-on-surface">为你推荐的岗位</p>
            <div className="flex gap-2">
              <button
                onClick={onExtract}
                className="text-[11px] text-primary font-medium hover:underline"
              >
                保存简历
              </button>
              <button
                onClick={() => setProfileReady(false)}
                className="text-[11px] text-on-surface-variant hover:text-on-surface"
              >
                收起
              </button>
            </div>
          </div>
          {recommendLoading ? (
            <p className="text-xs text-on-surface-variant">推荐中…</p>
          ) : recommendations.length === 0 ? (
            <p className="text-xs text-on-surface-variant">暂无推荐，继续聊聊获取更精准结果</p>
          ) : (
            <div className="space-y-1.5 max-h-36 overflow-y-auto">
              {recommendations.map((j) => (
                <button
                  key={j.id}
                  onClick={() => {
                    navigate(`/jobs/${j.id}`);
                    onClose();
                  }}
                  className="w-full text-left bg-surface rounded-lg px-3 py-2 hover:border-primary/40 border border-transparent transition-colors"
                >
                  <p className="text-xs font-medium text-on-surface truncate">{j.title}</p>
                  <p className="text-[11px] text-on-surface-variant truncate">
                    {j.company} {j.work_city && `· ${j.work_city}`}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 输入区 */}
      <div className="flex items-center gap-2 p-3 border-t border-outline-variant/20">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder={busy ? '正在回复…' : '聊聊你的求职情况…'}
          disabled={busy}
          className="flex-1 rounded-xl border border-outline-variant px-3.5 py-2.5 text-sm bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
        />
        <button
          onClick={send}
          disabled={busy || !input.trim()}
          className="p-2.5 rounded-xl punch-gradient text-on-primary disabled:opacity-40 shrink-0"
        >
          <span className="material-symbols-outlined text-[20px]">send</span>
        </button>
      </div>
    </div>
  );
}
