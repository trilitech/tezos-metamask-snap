import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import * as sinon from 'sinon';
import { SnapMock } from '../../test/snap.mock.test';
import { jsonOk } from '../../test/utils.test';
import { CHAIN_IDS } from '../utils/rpc';
import { tezosSetRpc } from './set-rpc';

chai.use(chaiAsPromised);

const header = {
  hash: 'BLbfxzLVe4Wu25Wmz3MoDWp8c6HmEwKxfR3MC86FHiK12zNp4WK',
  chain_id: CHAIN_IDS.mainnet,
};

describe('Test function: setRpc', function () {
  const snapStub = new SnapMock();
  beforeEach(function () {
    (global as any).snap = snapStub;
    snapStub.rpcStubs.snap_dialog.resolves(true);
  });

  afterEach(function () {
    snapStub.reset();
    sinon.restore();
  });

  it('accepts nodeUrl, normalizes storage, and preserves the response shape and confirmation', async function () {
    const data = { network: 'mainnet', nodeUrl: 'https://TEST.com/rpc//' };
    const fetchStub = sinon
      .stub(global, 'fetch')
      .callsFake(async (url) =>
        jsonOk(String(url).endsWith('/chain_id') ? CHAIN_IDS.mainnet : header),
      );
    expect(await tezosSetRpc(data)).to.deep.equal(data);
    expect(fetchStub.firstCall.args[0]).to.equal(
      'https://test.com/rpc/chains/main/chain_id',
    );
    expect(snapStub.rpcStubs.snap_dialog.callCount).to.equal(1);
    expect(snapStub.rpcStubs.snap_manageState.firstCall.args[0]).to.deep.equal({
      operation: 'update',
      newState: {
        rpc: { network: 'mainnet', nodeUrl: 'https://test.com/rpc/' },
      },
    });
  });

  it('clearly rejects missing, legacy and malformed parameters before any request', async function () {
    const fetchStub = sinon.stub(global, 'fetch');
    await expect(tezosSetRpc(undefined)).to.be.rejectedWith('Provide nodeUrl');
    await expect(
      tezosSetRpc({ network: 'mainnet', rpcUrl: 'https://test.com' }),
    ).to.be.rejectedWith('not rpcUrl');

    await expect(tezosSetRpc({ nodeUrl: 42 })).to.be.rejectedWith(
      'Provide nodeUrl',
    );

    await expect(tezosSetRpc({ nodeUrl: 'https://' })).to.be.rejectedWith(
      'Invalid RPC URL',
    );

    await expect(
      tezosSetRpc({ nodeUrl: 'http://test.com' }),
    ).to.be.rejectedWith('https://');

    await expect(
      tezosSetRpc({ nodeUrl: 'https://test.com/?key=secret' }),
    ).to.be.rejectedWith('query');

    await expect(
      tezosSetRpc({ nodeUrl: 'https://test.com', network: 'unknown' }),
    ).to.be.rejectedWith('Unsupported RPC network');
    expect(fetchStub.callCount).to.equal(0);
    expect(snapStub.rpcStubs.snap_manageState.callCount).to.equal(0);
  });

  it('does not save HTTP errors, invalid responses, wrong networks or rejected confirmations', async function () {
    const data = { network: 'mainnet', nodeUrl: 'https://test.com/' };
    const fetchStub = sinon
      .stub(global, 'fetch')
      .callsFake(async () => new Response('{}', { status: 503 }));
    await expect(tezosSetRpc(data)).to.be.rejectedWith('HTTP 503');
    fetchStub.callsFake(async () => jsonOk({}));
    await expect(tezosSetRpc(data)).to.be.rejectedWith('Invalid RPC response');
    fetchStub.callsFake(async (url) =>
      jsonOk(
        String(url).endsWith('/chain_id')
          ? CHAIN_IDS.shadownet
          : { ...header, chain_id: CHAIN_IDS.shadownet },
      ),
    );
    await expect(tezosSetRpc(data)).to.be.rejectedWith('not on mainnet');
    fetchStub.callsFake(async (url) =>
      jsonOk(String(url).endsWith('/chain_id') ? CHAIN_IDS.mainnet : header),
    );
    snapStub.rpcStubs.snap_dialog.resolves(false);
    await expect(tezosSetRpc(data)).to.be.rejectedWith('User rejected');
    expect(snapStub.rpcStubs.snap_manageState.callCount).to.equal(0);
  });
});
