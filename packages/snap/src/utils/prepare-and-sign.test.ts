import chai, { expect } from 'chai';
import * as sinon from 'sinon';
import sinonChai from 'sinon-chai';
import chaiAsPromised from 'chai-as-promised';
import chaiBytes from 'chai-bytes';
import { bip32Entropy } from '../../test/constants.test';
import { DEFAULT_NODE_URL, FALLBACK_NODE_URL } from '../constants';
import * as prepareOperationMethods from '../tezos/prepare-operations';
import * as injectTransactionMethods from '../tezos/inject-transaction';
import { jsonOk } from '../../test/utils.test';
import * as rpcMethods from './rpc';
import * as signMethods from './sign';
import { prepareAndSign } from './prepare-and-sign';

chai.use(chaiBytes);
chai.use(sinonChai);
chai.use(chaiAsPromised);

describe('Test function: prepareAndSign', function () {
  afterEach(function () {
    sinon.restore();
  });

  it('should sign operations', async function () {
    sinon.stub(rpcMethods, 'verifyRpc').resolves();
    const prepareOperationStub = sinon
      .stub(prepareOperationMethods, 'prepareOperations')
      .returns(Promise.resolve('0300aaff'));
    const injectTransactionStub = sinon
      .stub(injectTransactionMethods, 'injectTransaction')
      .returns(Promise.resolve('op...'));

    const hash = await prepareAndSign(
      [],
      { ed25519: bip32Entropy },
      { network: 'mainnet', nodeUrl: DEFAULT_NODE_URL },
    );

    expect(hash).to.equal('op...');

    expect(prepareOperationStub.callCount).to.equal(1);
    expect(injectTransactionStub.callCount).to.equal(1);
    expect(prepareOperationStub.firstCall.args[0]).to.deep.equal(
      'tz1bQrTEReXZKRwZWBy7gAJqbNCvrzqXzY1J',
    );

    expect(prepareOperationStub.firstCall.args[1]).to.deep.equal(
      'edpkvRupRPuHmoUx2zMgbDibs4KMD6ZwqEp6PePzSwhKkQ6pVxoU3u',
    );
    expect(prepareOperationStub.firstCall.args[2]).to.deep.equal([]);
    expect(prepareOperationStub.firstCall.args[3]).to.deep.equal(
      'https://tezos-mainnet.octez.io/',
    );

    expect(injectTransactionStub.firstCall.args[0]).to.deep.equal(
      '0300aaff4d81b9c84f8e12c12b1ba78c1b3a1e438080e851fee2110b3a82dc85d9d944433c602f83a7c58fa7227ee5ba9d24204cb97fa318b3030fc01a341369ff405805',
    );

    expect(injectTransactionStub.firstCall.args[1]).to.deep.equal(
      'https://tezos-mainnet.octez.io/',
    );
  });

  it('restarts the whole preparation on one node and block, preserves input and signs once', async function () {
    const branch = 'BLbfxzLVe4Wu25Wmz3MoDWp8c6HmEwKxfR3MC86FHiK12zNp4WK';
    const opHash = 'ooNDvTkYWi9ZkmEvyGnj3DpXzGFtLbek4MB8Mc6ZX2bPPeqMprB';
    const operations = [
      {
        kind: 'transaction',
        amount: '1',
        destination: 'tz1UNer1ijeE9ndjzSszRduR3CzX49hoBUB3',
      },
    ];
    const original = JSON.stringify(operations);
    const simulations: any[] = [];
    const fetchStub = sinon
      .stub(global, 'fetch')
      .callsFake(async (input, init) => {
        const url = String(input);
        if (url.endsWith('/chain_id')) {
          return jsonOk(rpcMethods.CHAIN_IDS.mainnet);
        }

        if (url.endsWith('/header')) {
          return jsonOk({
            hash: branch,
            chain_id: rpcMethods.CHAIN_IDS.mainnet,
            timestamp: new Date().toISOString(),
          });
        }

        if (url.endsWith('/hash')) {
          return jsonOk(branch);
        }

        if (url.endsWith('/counter')) {
          return jsonOk(url.startsWith(DEFAULT_NODE_URL) ? '10' : '20');
        }

        if (url.endsWith('/manager_key')) {
          return jsonOk('edpk...');
        }

        if (url.endsWith('/balance')) {
          return jsonOk('1000');
        }

        if (url.endsWith('/run_operation')) {
          const body = JSON.parse(init?.body as string);
          simulations.push(body);
          if (url.startsWith(DEFAULT_NODE_URL)) {
            return new Response('{}', { status: 503 });
          }
          return jsonOk({
            contents: [
              {
                metadata: {
                  operation_result: {
                    status: 'applied',
                    consumed_milligas: '1000000',
                  },
                },
              },
            ],
          });
        }

        if (url.includes('/injection/')) {
          return jsonOk(opHash);
        }
        throw new Error('Unexpected RPC path');
      });
    const signSpy = sinon.spy(signMethods, 'sign');
    const result = await prepareAndSign(
      operations,
      { ed25519: bip32Entropy },
      { network: 'mainnet', nodeUrl: DEFAULT_NODE_URL, useDefault: true },
    );
    expect(result).to.equal(opHash);
    expect(
      simulations.map((body) => body.operation.contents[0].counter),
    ).to.deep.equal(['11', '21']);
    expect(JSON.stringify(operations)).to.equal(original);
    expect(signSpy.callCount).to.equal(1);
    const calls = fetchStub.getCalls().map((call) => String(call.args[0]));
    expect(
      calls
        .filter(
          (url) => url.includes('/context/') || url.endsWith('/run_operation'),
        )
        .every((url) => url.includes(`/blocks/${branch}/`)),
    ).to.equal(true);

    expect(calls.filter((url) => url.includes('/injection/'))).to.deep.equal([
      `${FALLBACK_NODE_URL}injection/operation?chain=main`,
    ]);
  });

  it('never prepares, signs or broadcasts again after an ambiguous injection', async function () {
    sinon.stub(rpcMethods, 'verifyRpc').resolves();
    const prepareStub = sinon
      .stub(prepareOperationMethods, 'prepareOperations')
      .resolves('0300aaff');
    const signSpy = sinon.spy(signMethods, 'sign');
    const fetchStub = sinon
      .stub(global, 'fetch')
      .rejects(new Error('response lost'));
    await expect(
      prepareAndSign(
        [],
        { ed25519: bip32Entropy },
        { network: 'mainnet', nodeUrl: DEFAULT_NODE_URL, useDefault: true },
      ),
    ).to.be.rejectedWith('Broadcast outcome unknown');
    expect(prepareStub.callCount).to.equal(1);
    expect(signSpy.callCount).to.equal(1);
    expect(fetchStub.callCount).to.equal(1);
  });
});
