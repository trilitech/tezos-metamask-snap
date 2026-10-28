import { defaultSnapOrigin } from '../config';
import { GetSnapsResponse, Snap } from '../types';

/**
 * Get the installed snaps in MetaMask.
 *
 * @returns The snaps installed in MetaMask.
 */
export const getSnaps = async (): Promise<GetSnapsResponse> => {
  return (await window.ethereum.request({
    method: 'wallet_getSnaps',
  })) as unknown as GetSnapsResponse;
};

/**
 * Connect a snap to MetaMask.
 *
 * @param snapId - The ID of the snap.
 * @param params - The params to pass with the snap to connect.
 */
export const connectSnap = async (
  snapId: string = defaultSnapOrigin,
  params: Record<'version' | string, unknown> = {},
) => {
  await window.ethereum.request({
    method: 'wallet_requestSnaps',
    params: {
      [snapId]: params,
    },
  });
};

/**
 * Get the snap from MetaMask.
 *
 * @param version - The version of the snap to install (optional).
 * @returns The snap object returned by the extension.
 */
export const getSnap = async (version?: string): Promise<Snap | undefined> => {
  try {
    const snaps = await getSnaps();

    return Object.values(snaps).find(
      (snap) =>
        snap.id === defaultSnapOrigin && (!version || snap.version === version),
    );
  } catch (e) {
    console.log('Failed to obtain installed snap', e);
    return undefined;
  }
};

export const sendGetAccount = async () => {
  const result = await window.ethereum.request({
    method: 'wallet_invokeSnap',
    params: {
      snapId: defaultSnapOrigin,
      request: {
        method: 'tezos_getAccount',
      },
    },
  });

  console.log('tezos_getAccount', result);

  const publicKey: string = (result as any)?.publicKey;
  const address: string = (result as any)?.address;

  return { publicKey, address };
};

export const sendOperationRequest = async (address: string) => {
  const result = await window.ethereum.request({
    method: 'wallet_invokeSnap',
    params: {
      snapId: defaultSnapOrigin,
      request: {
        method: 'tezos_sendOperation',
        params: {
          payload: [
            {
              kind: 'transaction',
              destination: address,
              amount: '1',
            },
          ],
        },
      },
    },
  });

  console.log('tezos_sendOperation', result);

  return (result as any).opHash;
};

export const sendSignRequest = async () => {
  const result = await window.ethereum.request({
    method: 'wallet_invokeSnap',
    params: {
      snapId: defaultSnapOrigin,
      request: {
        method: 'tezos_signPayload',
        params: {
          payload:
            '05010000004254657a6f73205369676e6564204d6573736167653a206d79646170702e636f6d20323032312d30312d31345431353a31363a30345a2048656c6c6f20776f726c6421',
        },
      },
    },
  });

  console.log('tezos_signPayload', result);

  return (result as any).signature.prefixSig;
};

export const sendGetRpc = async () => {
  const result = await window.ethereum.request({
    method: 'wallet_invokeSnap',
    params: {
      snapId: defaultSnapOrigin,
      request: {
        method: 'tezos_getRpc',
      },
    },
  });

  console.log('tezos_getRpc', result);

  return result as any;
};

export const sendSetRpc = async () => {
  const result = await window.ethereum.request({
    method: 'wallet_invokeSnap',
    params: {
      snapId: defaultSnapOrigin,
      request: {
        method: 'tezos_setRpc',
        params: {
          network: 'mainnet', // "mainnet" | "ghostnet"
          nodeUrl: 'https://tezos-mainnet.octez.io/',
        },
      },
    },
  });

  console.log('tezos_setRpc', result);

  return result as any;
};

export const sendClearRpc = async () => {
  const result = await window.ethereum.request({
    method: 'wallet_invokeSnap',
    params: {
      snapId: defaultSnapOrigin,
      request: {
        method: 'tezos_clearRpc',
      },
    },
  });

  console.log('tezos_clearRpc', result);

  return result as any;
};

export const isLocalSnap = (snapId: string) => snapId.startsWith('local:');
