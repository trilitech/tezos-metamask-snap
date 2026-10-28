import { panel, heading, text, copyable, divider } from '@metamask/snaps-ui';
import { SnapStorage } from '../types';
import { normalizeRpcUrl, verifyRpc } from '../utils/rpc';

export const tezosSetRpc = async (params: any) => {
  const { network, nodeUrl } = params ?? {};
  const normalisedNodeUrl = normalizeRpcUrl(nodeUrl);
  if (!['mainnet', 'ghostnet', 'shadownet', 'custom'].includes(network)) {
    throw new Error('Unsupported RPC network');
  }
  await verifyRpc(normalisedNodeUrl, network);

  const approved = await snap.request({
    method: 'snap_dialog',
    params: {
      type: 'confirmation',
      content: panel([
        heading('Set RPC'),
        text(`Do you want to set the RPC to the following address?`),
        divider(),
        text(`${network}`),
        copyable(nodeUrl),
      ]),
    },
  });

  if (!approved) {
    throw new Error('User rejected');
  }

  const newState: SnapStorage = {
    rpc: { network, nodeUrl: normalisedNodeUrl },
  };

  await snap.request({
    method: 'snap_manageState',
    params: {
      operation: 'update',
      newState,
    },
  });

  return {
    network,
    nodeUrl,
  };
};
