import chai, { expect } from 'chai';
import * as sinon from 'sinon';
import sinonChai from 'sinon-chai';
import chaiAsPromised from 'chai-as-promised';
import chaiBytes from 'chai-bytes';
import { SnapStorage } from '../types';
import { SnapMock } from '../../test/snap.mock.test';
import { DEFAULT_NODE_URL, LEGACY_NODE_URL } from '../constants';
import { getRpc } from './get-rpc';

chai.use(chaiBytes);
chai.use(sinonChai);
chai.use(chaiAsPromised);

describe('Test function: getRpc', function () {
  const snapStub = new SnapMock();
  const state: SnapStorage = {
    rpc: {
      network: 'mainnet',
      nodeUrl: 'https://test.com/',
    },
  };

  beforeEach(async function () {
    (global as any).snap = snapStub;
  });

  afterEach(function () {
    snapStub.reset();
    sinon.restore();
  });

  it('should return the RPC storage defaults', async function () {
    const rpc = await getRpc();
    expect(rpc).to.deep.equal({
      network: 'mainnet',
      nodeUrl: DEFAULT_NODE_URL,
      useDefault: true,
    });
    expect(snapStub.rpcStubs.snap_manageState.callCount).to.equal(1);
    expect(snapStub.rpcStubs.snap_manageState.firstCall.args[0]).to.deep.equal({
      operation: 'get',
    });
  });

  it('should return the RPC storage', async function () {
    snapStub.rpcStubs.snap_manageState.resolves(state);

    const rpc = await getRpc();
    expect(rpc).to.deep.equal(state.rpc);
    expect(snapStub.rpcStubs.snap_manageState.callCount).to.equal(1);
    expect(snapStub.rpcStubs.snap_manageState.firstCall.args[0]).to.deep.equal({
      operation: 'get',
    });
  });

  it('resolves the exact saved mainnet Papers default without writing storage', async function () {
    snapStub.rpcStubs.snap_manageState.resolves({
      rpc: { network: 'mainnet', nodeUrl: LEGACY_NODE_URL },
    });

    expect(await getRpc()).to.deep.equal({
      network: 'mainnet',
      nodeUrl: DEFAULT_NODE_URL,
      useDefault: true,
    });
    expect(snapStub.rpcStubs.snap_manageState.callCount).to.equal(1);
  });

  it('preserves explicit Octez and non-mainnet Papers settings', async function () {
    const selected = { network: 'mainnet', nodeUrl: DEFAULT_NODE_URL };
    snapStub.rpcStubs.snap_manageState.resolves({ rpc: selected });
    expect(await getRpc()).to.deep.equal(selected);
    const custom = { network: 'custom', nodeUrl: LEGACY_NODE_URL };
    snapStub.rpcStubs.snap_manageState.resolves({ rpc: custom });
    expect(await getRpc()).to.deep.equal(custom);
    snapStub.rpcStubs.snap_manageState.resolves({
      rpc: { network: 'shadownet' },
    });
    await expect(getRpc()).to.be.rejectedWith('Missing RPC URL');
  });
});
