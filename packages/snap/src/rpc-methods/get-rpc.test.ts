import chai, { expect } from 'chai';
import sinonChai from 'sinon-chai';
import chaiAsPromised from 'chai-as-promised';
import chaiBytes from 'chai-bytes';
import * as sinon from 'sinon';
import * as getRpcMethods from '../utils/get-rpc';
import { tezosGetRpc } from './get-rpc';

chai.use(chaiBytes);
chai.use(sinonChai);
chai.use(chaiAsPromised);

describe('Test function: getRpc', function () {
  afterEach(function () {
    sinon.restore();
  });

  it('should return mainnet RPC configuration', async function () {
    const data = {
      network: 'mainnet' as const,
      nodeUrl: 'https://mainnet.tezos.com/',
    };
    sinon
      .stub(getRpcMethods, 'getRpc')
      .returns(Promise.resolve({ ...data, useDefault: true }));

    const response = await tezosGetRpc();

    expect(response).to.deep.equal(data);
    expect(response.network).to.equal(data.network);
    expect(response.nodeUrl).to.equal(data.nodeUrl);
  });

  it('should return ghostnet RPC configuration', async function () {
    const data = {
      network: 'ghostnet' as const,
      nodeUrl: 'https://ghostnet.tezos.com/',
    };
    sinon.stub(getRpcMethods, 'getRpc').returns(Promise.resolve(data));

    const response = await tezosGetRpc();

    expect(response.network).to.equal(data.network);
    expect(response.nodeUrl).to.equal(data.nodeUrl);
  });

  it('should return shadownet RPC configuration', async function () {
    const data = {
      network: 'shadownet' as const,
      nodeUrl: 'https://shadownet.tezos.com/',
    };
    sinon.stub(getRpcMethods, 'getRpc').returns(Promise.resolve(data));

    const response = await tezosGetRpc();

    expect(response.network).to.equal(data.network);
    expect(response.nodeUrl).to.equal(data.nodeUrl);
  });

  it('should return custom RPC configuration', async function () {
    const data = {
      network: 'custom' as const,
      nodeUrl: 'https://custom.node.example.com/',
    };
    sinon.stub(getRpcMethods, 'getRpc').returns(Promise.resolve(data));

    const response = await tezosGetRpc();

    expect(response.network).to.equal(data.network);
    expect(response.nodeUrl).to.equal(data.nodeUrl);
  });
});
