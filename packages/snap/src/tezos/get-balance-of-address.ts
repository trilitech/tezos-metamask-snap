import { rpcRequest, RpcUnavailableError } from '../utils/rpc';

export const getBalanceOfAddress = async (
  address: string,
  nodeUrl: string,
  block = 'head',
): Promise<string> => {
  const data = await rpcRequest(
    `${nodeUrl}chains/main/blocks/${block}/context/contracts/${address}/balance`,
  );
  // Unallocated implicit accounts return "0". An HTTP 404 alone is not proof
  // of a zero balance (it can also be a proxy or missing-block response).
  if (typeof data !== 'string' || !/^\d+$/u.test(data)) {
    throw new RpcUnavailableError('Invalid RPC balance');
  }
  return data;
};
