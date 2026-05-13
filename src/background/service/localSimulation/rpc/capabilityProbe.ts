import { INTERNAL_REQUEST_SESSION } from '@/constant';
import providerController from '../../../controller/provider/controller';

interface ProbeEntry {
  supported: boolean;
  ts: number;
}

const TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, ProbeEntry>();

export const probeDebugTraceCall = async (
  chainServerId: string
): Promise<boolean> => {
  const cached = cache.get(chainServerId);
  if (cached && Date.now() - cached.ts < TTL_MS) return cached.supported;

  try {
    const res = await providerController.ethRpc(
      {
        data: {
          method: 'debug_traceCall',
          params: [
            {
              from: '0x0000000000000000000000000000000000000000',
              to: '0x000000000000000000000000000000000000dEaD',
              value: '0x0',
            },
            'latest',
            {
              tracer: 'prestateTracer',
              tracerConfig: { diffMode: true },
            },
          ],
        },
        session: INTERNAL_REQUEST_SESSION,
      } as any,
      chainServerId
    );
    const ok = !!res && typeof res === 'object';
    cache.set(chainServerId, { supported: ok, ts: Date.now() });
    return ok;
  } catch (e) {
    cache.set(chainServerId, { supported: false, ts: Date.now() });
    return false;
  }
};

export const invalidateProbe = (chainServerId?: string) => {
  if (chainServerId) cache.delete(chainServerId);
  else cache.clear();
};
