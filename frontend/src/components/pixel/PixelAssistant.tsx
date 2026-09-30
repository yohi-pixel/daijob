import { useState } from 'react';
import { PixelSprite } from './PixelSprite';
import { ChatWindow } from './ChatWindow';
import { Modal } from '../common/Modal';
import { useInvite } from '../../hooks/useInvite';
import { useAuthStore } from '../../stores/authStore';
import { extractResume } from '../../services/aiApi';
import { useResumeStore } from '../../stores/resumeStore';
import { OLD_TYPE_MAP } from '../../lib/resumeCompat';
import type { ModuleType, SerializedModuleData } from '../../types/resume';

/**
 * 像素精灵全局组件：浮窗精灵 + 对话窗口 + 邀请码门禁 + 简历提取。
 * 挂载于 main.tsx，独立于路由。
 */
export function PixelAssistant() {
  const [open, setOpen] = useState(false);
  const [talking, setTalking] = useState(false);
  const [extractOpen, setExtractOpen] = useState(false);
  const [extractModules, setExtractModules] = useState<Array<{ module_type: ModuleType; data: SerializedModuleData }>>([]);
  const [extractLoading, setExtractLoading] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);

  const user = useAuthStore((s) => s.user);
  const addModule = useResumeStore((s) => s.addModule);
  const invite = useInvite();

  const openAssistant = () => {
    if (!user) {
      alert('请先登录后再使用 AI 助手');
      return;
    }
    if (invite.needsVerification) {
      invite.setShowInput(true);
      return;
    }
    setOpen(true);
  };

  const handleProfileReady = () => {
    setTalking(true);
    setTimeout(() => setTalking(false), 3000);
  };

  const handleExtract = async () => {
    setExtractOpen(true);
    setExtractLoading(true);
    setExtractError(null);
    try {
      const res = await extractResume();
      const mapped = (res.modules ?? [])
        .map((m) => ({
          module_type: OLD_TYPE_MAP[m.type] ?? m.type,
          data: m.data ?? {},
        }))
        .filter((m): m is { module_type: ModuleType; data: SerializedModuleData } => Boolean(OLD_TYPE_MAP[m.module_type as string] ?? ['basic_info', 'experience', 'education', 'award', 'skill', 'summary'].includes(m.module_type)));
      setExtractModules(mapped);
    } catch (e) {
      setExtractError(e instanceof Error ? e.message : '提取失败');
    } finally {
      setExtractLoading(false);
    }
  };

  const saveExtracted = () => {
    let saved = 0;
    let skipped = 0;
    extractModules.forEach((m) => {
      try {
        addModule(m.module_type, m.data, []);
        saved++;
      } catch {
        skipped++;
      }
    });
    setExtractOpen(false);
    alert(`已导入 ${saved} 个模块${skipped > 0 ? `，${skipped} 个因配额跳过` : ''}`);
  };

  return (
    <>
      {/* 邀请码输入 */}
      <Modal open={invite.showInput} onClose={() => invite.setShowInput(false)} title="输入邀请码">
        <InviteForm
          pending={invite.pending}
          error={invite.error}
          onSubmit={async (code) => {
            const ok = await invite.submitCode(code);
            if (ok) setOpen(true);
          }}
        />
      </Modal>

      {/* 简历提取模态框 */}
      <Modal open={extractOpen} onClose={() => setExtractOpen(false)} title="从对话提取简历模块">
        <div className="p-5 space-y-4">
          {extractLoading && <p className="text-sm text-on-surface-variant">提取中…</p>}
          {extractError && <p className="text-xs text-error bg-error-container/20 rounded-lg px-3 py-2">{extractError}</p>}
          {!extractLoading && !extractError && (
            <>
              {extractModules.length === 0 ? (
                <p className="text-sm text-on-surface-variant">没有从对话中提取到简历模块，先和小逮聊聊你的经历吧</p>
              ) : (
                <div className="space-y-2">
                  {extractModules.map((m, i) => (
                    <div key={i} className="flex items-center gap-2 bg-surface-container-low rounded-lg px-3 py-2">
                      <span className="text-xs bg-surface-container text-ink px-2 py-0.5 rounded-full shrink-0">
                        {m.module_type}
                      </span>
                      <span className="text-xs text-on-surface-variant truncate">
                        {JSON.stringify(m.data).slice(0, 60)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {extractModules.length > 0 && (
                <button
                  onClick={saveExtracted}
                  className="w-full bg-primary text-on-primary font-semibold py-2.5 rounded-xl text-sm"
                >
                  保存到简历库
                </button>
              )}
            </>
          )}
        </div>
      </Modal>

      {/* 精灵 + 窗口 */}
      {open && (
        <ChatWindow onClose={() => setOpen(false)} onProfileReady={handleProfileReady} onExtract={handleExtract} />
      )}
      <div className="fixed bottom-6 right-6 z-[110]">
        <div className="relative">
          <PixelSprite talking={talking} onClick={openAssistant} />
          {!open && (
            <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-error rounded-full animate-pulse" />
          )}
        </div>
      </div>
    </>
  );
}

function InviteForm({
  pending,
  error,
  onSubmit,
}: {
  pending: boolean;
  error: string | null;
  onSubmit: (code: string) => Promise<void>;
}) {
  const [code, setCode] = useState('');
  return (
    <div className="p-5 space-y-4">
      <p className="text-xs text-on-surface-variant">AI 功能需要邀请码，输入后即可使用求职助手</p>
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="请输入邀请码"
        className="w-full rounded-lg border border-line px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
      {error && <p className="text-xs text-error">{error}</p>}
      <button
        onClick={() => onSubmit(code)}
        disabled={pending || !code.trim()}
        className="w-full bg-primary text-on-primary font-semibold py-2.5 rounded-xl text-sm disabled:opacity-50"
      >
        {pending ? '验证中…' : '验证'}
      </button>
    </div>
  );
}
