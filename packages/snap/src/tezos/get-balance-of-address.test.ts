import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import * as sinon from 'sinon';
import { jsonOk } from '../../test/utils.test';
import { getBalanceOfAddress } from './get-balance-of-address';

chai.use(chaiAsPromised);

describe('Test function: getBalanceOfAddress', function () {
  afterEach(function () {
    sinon.restore();
  });

  it('returns a validated balance including a genuine zero', async function () {
    const fetchStub = sinon
      .stub(global, 'fetch')
      .callsFake(async () => jsonOk('1000000'));
    expect(await getBalanceOfAddress('tz1...', 'https://test.com/')).to.equal(
      '1000000',
    );

    expect(fetchStub.firstCall.args[0]).to.equal(
      'https://test.com/chains/main/blocks/head/context/contracts/tz1.../balance',
    );
    fetchStub.callsFake(async () => jsonOk('0'));
    expect(await getBalanceOfAddress('tz1...', 'https://test.com/')).to.equal(
      '0',
    );
  });

  it('never turns network failures, HTTP errors or malformed balances into zero', async function () {
    const fetchStub = sinon.stub(global, 'fetch').rejects(new Error('offline'));
    await expect(
      getBalanceOfAddress('tz1...', 'https://test.com/'),
    ).to.be.rejectedWith('RPC connection failed');
    fetchStub.callsFake(async () => new Response('Not found', { status: 404 }));
    await expect(
      getBalanceOfAddress('tz1...', 'https://test.com/'),
    ).to.be.rejectedWith('HTTP 404');
    fetchStub.callsFake(async () => jsonOk({ error: 'unavailable' }));
    await expect(
      getBalanceOfAddress('tz1...', 'https://test.com/'),
    ).to.be.rejectedWith('Invalid RPC balance');
  });
});
