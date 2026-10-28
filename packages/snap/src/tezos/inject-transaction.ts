import { rpcRequest, RpcUnavailableError } from '../utils/rpc';

export const injectTransaction = async (
  rawTransaction: string,
  nodeUrl: string,
): Promise<string> => {
  try {
    const hash = await rpcRequest(`${nodeUrl}injection/operation?chain=main`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(rawTransaction),
    });
    if (
      typeof hash !== 'string' ||
      !/^o[1-9A-HJ-NP-Za-km-z]{50}$/u.test(hash)
    ) {
      throw new RpcUnavailableError('Invalid injection response');
    }
    return hash;
  } catch (error) {
    if (error instanceof RpcUnavailableError) {
      throw new Error(
        'Broadcast outcome unknown. Check your account on-chain before sending again. The operation was not retried.',
      );
    }
    throw error;
  }
};
