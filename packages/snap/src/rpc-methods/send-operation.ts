import { panel, heading, text, copyable, divider } from '@metamask/snaps-ui';
import { getWallet } from '../utils/get-wallet';
import { prepareAndSign } from '../utils/prepare-and-sign';
import { FALLBACK_NODE_URL } from '../constants';
import { usesDefaultRpc } from '../utils/rpc';
import { getRpc } from '../utils/get-rpc';

export const tezosSendOperation = async (params: any) => {
  const { payload } = params;
  const wallet = await getWallet();
  const rpc = await getRpc();

  const approved = await snap.request({
    method: 'snap_dialog',
    params: {
      type: 'confirmation',
      content: panel([
        heading('Sign Operation'),
        text('Do you want to sign the following payload?'),
        copyable(JSON.stringify(payload, null, 2)),
        divider(),
        text(`The operation will be submitted to the following node:`),
        copyable(rpc.nodeUrl),
        ...(usesDefaultRpc(rpc)
          ? [
              text(
                'If preparation fails, this mainnet provider may prepare and submit the operation:',
              ),
              copyable(FALLBACK_NODE_URL),
            ]
          : []),
      ]),
    },
  });

  if (!approved) {
    throw new Error('User rejected');
  }

  return { opHash: await prepareAndSign(payload, wallet, rpc) };
};
