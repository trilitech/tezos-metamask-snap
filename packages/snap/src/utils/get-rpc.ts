import { DEFAULT_NODE_URL, LEGACY_NODE_URL } from '../constants';
import { Network, SnapStorage } from '../types';
import { RpcConfig } from './rpc';

export const getRpc = async (): Promise<RpcConfig> => {
  const persistedData = await snap.request({
    method: 'snap_manageState',
    params: { operation: 'get' },
  });

  const typedData: SnapStorage = persistedData as any;

  const network: Network = typedData?.rpc?.network ?? 'mainnet';
  const storedUrl = typedData?.rpc?.nodeUrl;
  const useDefault =
    network === 'mainnet' &&
    (storedUrl === undefined || storedUrl === LEGACY_NODE_URL);
  const nodeUrl = useDefault ? DEFAULT_NODE_URL : storedUrl;
  if (!nodeUrl) {
    throw new Error('Missing RPC URL for the selected network');
  }

  return {
    network,
    nodeUrl,
    ...(useDefault ? { useDefault: true } : {}),
  };
};
