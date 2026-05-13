import { useEffect, useState } from 'react';

interface UseGasOverspendAckInput {
  gasLimit: string | undefined;
  checkErrors: Array<{ code: number; level?: string; msg: string }>;
}

interface UseGasOverspendAckResult {
  warning: string | null;
  acknowledged: boolean;
  setAcknowledged: (next: boolean) => void;
  blockSubmit: boolean;
}

// Pulls the 10x-overspend warning (code 3007, level 'warn') out of the
// checkErrors stream and owns the user-ack lifecycle: ack is reset whenever
// the gas limit changes by *numeric* value (not raw hex string), so price-
// tier changes that resend the same gasLimit don't reset a valid ack.
// SignTx and SignTestnetTx share this hook to keep their submit gating in
// sync.
export const useGasOverspendAck = ({
  gasLimit,
  checkErrors,
}: UseGasOverspendAckInput): UseGasOverspendAckResult => {
  const [acknowledged, setAcknowledged] = useState(false);
  const warning =
    checkErrors.find((e) => e.code === 3007 && e.level === 'warn')?.msg || null;
  const gasLimitNumber = Number(gasLimit || 0);
  useEffect(() => {
    setAcknowledged(false);
  }, [gasLimitNumber]);
  return {
    warning,
    acknowledged,
    setAcknowledged,
    blockSubmit: !!warning && !acknowledged,
  };
};
