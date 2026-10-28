import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import * as sinon from 'sinon';
import { jsonOk } from '../../test/utils.test';
import { DEFAULT_NODE_URL, FALLBACK_NODE_URL } from '../constants';
import {
  CHAIN_IDS,
  rpcRequest,
  RPC_TIMEOUT_MS,
  verifyRpc,
  withRpc,
} from './rpc';

chai.use(chaiAsPromised);
const rpc = {
  network: 'mainnet' as const,
  nodeUrl: DEFAULT_NODE_URL,
  useDefault: true,
};
const header = () => ({
  hash: 'BLbfxzLVe4Wu25Wmz3MoDWp8c6HmEwKxfR3MC86FHiK12zNp4WK',
  chain_id: CHAIN_IDS.mainnet,
  timestamp: new Date().toISOString(),
});
const healthy = async (url: any) =>
  jsonOk(String(url).endsWith('/chain_id') ? CHAIN_IDS.mainnet : header());

describe('RPC transport and failover', function () {
  afterEach(function () {
    sinon.restore();
  });

  it('uses the independent mainnet node after a primary 503', async function () {
    const fetchStub = sinon
      .stub(global, 'fetch')
      .callsFake(async (url) =>
        String(url).startsWith(DEFAULT_NODE_URL)
          ? new Response('unavailable', { status: 503 })
          : healthy(url),
      );
    const action = sinon.stub().resolves('balance');
    expect(await withRpc(rpc, action)).to.deep.equal({
      value: 'balance',
      nodeUrl: FALLBACK_NODE_URL,
    });
    expect(action.callCount).to.equal(1);
    expect(action.firstCall.args[0]).to.equal(FALLBACK_NODE_URL);
    expect(fetchStub.callCount).to.equal(4);
  });

  it('bounds a stalled response body and fails over once', async function () {
    const clock = sinon.useFakeTimers();
    sinon.stub(global, 'fetch').callsFake(async (url) =>
      String(url).startsWith(DEFAULT_NODE_URL)
        ? ({
            ok: true,
            status: 200,
            json: () => new Promise(() => undefined),
          } as any)
        : healthy(url),
    );
    const result = withRpc(rpc, async () => 'ok');
    await clock.tickAsync(RPC_TIMEOUT_MS);
    expect((await result).nodeUrl).to.equal(FALLBACK_NODE_URL);
    expect(clock.countTimers()).to.equal(0);
  });

  it('fails clearly after both providers fail, and rejects a wrong-chain or stale fallback', async function () {
    const fetchStub = sinon.stub(global, 'fetch').rejects(new Error('offline'));
    const action = sinon.stub();
    await expect(withRpc(rpc, action)).to.be.rejectedWith('RPC unavailable');
    expect(fetchStub.callCount).to.equal(4);
    fetchStub.callsFake(async (url) =>
      String(url).startsWith(DEFAULT_NODE_URL)
        ? new Response('{}', { status: 429 })
        : jsonOk(
            String(url).endsWith('/chain_id')
              ? CHAIN_IDS.shadownet
              : { ...header(), chain_id: CHAIN_IDS.shadownet },
          ),
    );
    await expect(withRpc(rpc, action)).to.be.rejectedWith('RPC unavailable');
    fetchStub.callsFake(async (url) =>
      jsonOk(
        String(url).endsWith('/chain_id')
          ? CHAIN_IDS.mainnet
          : { ...header(), timestamp: '2000-01-01T00:00:00Z' },
      ),
    );
    await expect(withRpc(rpc, action)).to.be.rejectedWith('RPC unavailable');
    expect(action.callCount).to.equal(0);
  });

  it('does not fail over HTTP 400 or structured Tezos rejections, even with HTTP 500', async function () {
    const fetchStub = sinon.stub(global, 'fetch').callsFake(healthy);
    fetchStub
      .withArgs(`${DEFAULT_NODE_URL}simulate`)
      .callsFake(
        async () => new Response('invalid operation', { status: 400 }),
      );

    await expect(
      withRpc(rpc, async (url) => rpcRequest(`${url}simulate`)),
    ).to.be.rejectedWith('HTTP 400');

    fetchStub
      .withArgs(`${DEFAULT_NODE_URL}simulate`)
      .callsFake(
        async () =>
          new Response(
            JSON.stringify([
              { kind: 'temporary', id: 'proto.counter_in_the_past' },
            ]),
            { status: 500 },
          ),
      );

    await expect(
      withRpc(rpc, async (url) => rpcRequest(`${url}simulate`)),
    ).to.be.rejectedWith('RPC rejected the operation');

    expect(
      fetchStub
        .getCalls()
        .some((call) => String(call.args[0]).startsWith(FALLBACK_NODE_URL)),
    ).to.equal(false);
  });

  it('keeps explicit custom and testnet configurations on their selected node', async function () {
    const fetchStub = sinon.stub(global, 'fetch').rejects(new Error('offline'));
    await expect(
      withRpc(
        { network: 'custom', nodeUrl: 'https://private.example/' },
        async () => 'ok',
      ),
    ).to.be.rejectedWith('RPC unavailable');

    expect(
      fetchStub
        .getCalls()
        .every((call) =>
          String(call.args[0]).startsWith('https://private.example/'),
        ),
    ).to.equal(true);
    fetchStub.resetHistory();
    await expect(
      withRpc(
        { network: 'shadownet', nodeUrl: DEFAULT_NODE_URL, useDefault: true },
        async () => 'ok',
      ),
    ).to.be.rejectedWith('RPC unavailable');
    expect(fetchStub.callCount).to.equal(2);
    expect(
      fetchStub
        .getCalls()
        .some((call) => String(call.args[0]).startsWith(FALLBACK_NODE_URL)),
    ).to.equal(false);
  });

  it('handles malformed success bodies, JSON HTTP errors and a valid custom chain', async function () {
    const fetchStub = sinon
      .stub(global, 'fetch')
      .callsFake(async () => new Response('not json'));
    await expect(rpcRequest(DEFAULT_NODE_URL)).to.be.rejectedWith(
      'Invalid RPC response',
    );
    fetchStub.callsFake(async () => new Response('{}', { status: 403 }));
    await expect(rpcRequest(DEFAULT_NODE_URL)).to.be.rejectedWith('HTTP 403');
    fetchStub.callsFake(healthy);
    await verifyRpc(DEFAULT_NODE_URL, 'custom');
  });
});
