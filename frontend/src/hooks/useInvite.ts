import { useCallback, useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { verifyInvite } from '../services/aiApi';

/**
 * 邀请码验证门禁：未验证时返回 needsVerification=true，
 * submitCode 调后端 verify-invite，成功写 authStore。
 * 用户主动取消时可通过 cancel 重置。
 */
export function useInvite() {
  const inviteVerified = useAuthStore((s) => s.inviteVerified);
  const setInviteVerified = useAuthStore((s) => s.setInviteVerified);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showInput, setShowInput] = useState(false);

  const submitCode = useCallback(
    async (code: string) => {
      setPending(true);
      setError(null);
      try {
        await verifyInvite(code);
        setInviteVerified(true);
        setShowInput(false);
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : '邀请码验证失败');
        return false;
      } finally {
        setPending(false);
      }
    },
    [setInviteVerified],
  );

  return {
    inviteVerified,
    needsVerification: !inviteVerified,
    showInput,
    setShowInput,
    submitCode,
    pending,
    error,
  };
}
