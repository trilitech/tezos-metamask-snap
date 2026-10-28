import { DEFAULT_NODE_URL, FALLBACK_NODE_URL } from '../constants';
import { Network } from '../types';

export type RpcConfig = {
  network: Network;
  nodeUrl: string;
  useDefault?: boolean;
};

export const CHAIN_IDS = {
  mainnet: 'NetXdQprcVkpaWU',
  ghostnet: 'NetXnHfVqm9iesp',
  shadownet: 'NetXsqzbfFenSTS',
};
export const RPC_TIMEOUT_MS = 5000;

export class RpcUnavailableError extends Error {}

export const normalizeRpcUrl = (nodeUrl: unknown): string => {
  if (typeof nodeUrl !== 'string' || !nodeUrl) {
    throw new Error('Provide nodeUrl as a non-empty HTTPS URL (not rpcUrl).');
  }
  let url: URL;
  try {
    url = new URL(nodeUrl);
  } catch {
    throw new Error('Invalid RPC URL');
  }

  if (url.protocol !== 'https:') {
    throw new Error('RPC URL needs to start with https://');
  }

  if (url.username || url.password || url.search || url.hash) {
    throw new Error('RPC URL must not include credentials, query or fragment');
  }
  url.pathname = `${url.pathname.replace(/\/+$/u, '')}/`;
  return url.toString();
};

// Covers both receiving headers and reading the body; cancels timed-out requests.
export const rpcRequest = async (
  url: string,
  init?: RequestInit,
): Promise<any> => {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      (async () => {
        let response: Response;
        try {
          response = await fetch(url, { ...init, signal: controller.signal });
        } catch {
          throw new RpcUnavailableError('RPC connection failed');
        }
        const retryable = response.status === 429 || response.status >= 500;
        let data: any;
        try {
          data = await response.json();
        } catch {
          if (response.ok || retryable) {
            throw new RpcUnavailableError('Invalid RPC response');
          }
          throw new Error(`RPC rejected the request (HTTP ${response.status})`);
        }
        // Octez can return structured operation rejections with HTTP 500.
        const tezosError =
          Array.isArray(data) &&
          data.some(
            (entry) =>
              typeof entry?.id === 'string' && typeof entry?.kind === 'string',
          );
        if (tezosError) {
          throw new Error(
            'RPC rejected the operation. Check the operation and account state.',
          );
        }

        if (!response.ok) {
          if (retryable) {
            throw new RpcUnavailableError(
              `RPC unavailable (HTTP ${response.status})`,
            );
          }
          throw new Error(`RPC rejected the request (HTTP ${response.status})`);
        }
        return data;
      })(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new RpcUnavailableError('RPC request timed out'));
          controller.abort();
        }, RPC_TIMEOUT_MS);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
};

export const verifyRpc = async (
  nodeUrl: string,
  network: Network,
  fresh = false,
) => {
  const [chainId, header] = await Promise.all([
    rpcRequest(`${nodeUrl}chains/main/chain_id`),
    rpcRequest(`${nodeUrl}chains/main/blocks/head/header`),
  ]);
  if (
    typeof chainId !== 'string' ||
    !/^Net[1-9A-HJ-NP-Za-km-z]{12}$/u.test(chainId) ||
    typeof header?.hash !== 'string' ||
    !/^B[1-9A-HJ-NP-Za-km-z]{50}$/u.test(header.hash) ||
    header.chain_id !== chainId
  ) {
    throw new RpcUnavailableError('Invalid RPC response');
  }

  if (network !== 'custom' && chainId !== CHAIN_IDS[network]) {
    throw new RpcUnavailableError(`RPC is not on ${network}`);
  }

  if (fresh) {
    const age = Date.now() - Date.parse(header.timestamp);
    if (!Number.isFinite(age) || age > 120000 || age < -30000) {
      throw new RpcUnavailableError(
        'RPC head is stale or has an invalid timestamp',
      );
    }
  }
};

export const usesDefaultRpc = (rpc: RpcConfig) =>
  rpc.useDefault === true &&
  rpc.network === 'mainnet' &&
  rpc.nodeUrl === DEFAULT_NODE_URL;

// Only read-only preparation belongs here. Signing and injection must stay outside.
export const withRpc = async <T>(
  rpc: RpcConfig,
  action: (nodeUrl: string) => Promise<T>,
): Promise<{ value: T; nodeUrl: string }> => {
  const urls = usesDefaultRpc(rpc)
    ? [DEFAULT_NODE_URL, FALLBACK_NODE_URL]
    : [normalizeRpcUrl(rpc.nodeUrl)];
  for (const nodeUrl of urls) {
    try {
      await verifyRpc(nodeUrl, rpc.network, usesDefaultRpc(rpc));
      return { value: await action(nodeUrl), nodeUrl };
    } catch (error) {
      if (!(error instanceof RpcUnavailableError)) {
        throw error;
      }
    }
  }
  throw new Error(
    'RPC unavailable or on the wrong network. Check your RPC settings or try again later.',
  );
};
