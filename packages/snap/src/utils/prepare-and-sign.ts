import { injectTransaction } from '../tezos/inject-transaction';
import { prepareOperations } from '../tezos/prepare-operations';
import { getSigner } from './get-signer';
import { sign } from './sign';
import { RpcConfig, withRpc } from './rpc';

export const prepareAndSign = async (
  operations: any[],
  node: { ed25519: any },
  rpc: RpcConfig,
) => {
  const operationWatermark = new Uint8Array([3]);

  const signer = await getSigner(node);

  const address = await signer.publicKeyHash();
  const publicKey = await signer.publicKey();
  const { value: forged, nodeUrl } = await withRpc(rpc, (url) =>
    prepareOperations(
      address,
      publicKey,
      JSON.parse(JSON.stringify(operations)),
      url,
    ),
  );

  const signed = await sign(forged, operationWatermark, node);

  return injectTransaction(signed.signature.sbytes, nodeUrl);
};
