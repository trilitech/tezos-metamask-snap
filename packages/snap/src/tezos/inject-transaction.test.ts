import chai, { expect } from 'chai';
import sinonChai from 'sinon-chai';
import chaiAsPromised from 'chai-as-promised';
import chaiBytes from 'chai-bytes';
import * as sinon from 'sinon';
import { jsonOk } from '../../test/utils.test';
import { injectTransaction } from './inject-transaction';

chai.use(chaiBytes);
chai.use(sinonChai);
chai.use(chaiAsPromised);

describe('Test function: injectTransaction', function () {
  afterEach(function () {
    sinon.restore();
  });

  it('should inject a transaction', async function () {
    const fetchStub = sinon
      .stub(global, 'fetch')
      .returns(jsonOk('ooNDvTkYWi9ZkmEvyGnj3DpXzGFtLbek4MB8Mc6ZX2bPPeqMprB'));

    const response = await injectTransaction(
      'rawTxPayload',
      'https://test.com/',
    );

    expect(response).to.equal(
      'ooNDvTkYWi9ZkmEvyGnj3DpXzGFtLbek4MB8Mc6ZX2bPPeqMprB',
    );
    expect(fetchStub.callCount).to.equal(1);
    expect(fetchStub.firstCall.args[0]).to.deep.equal(
      'https://test.com/injection/operation?chain=main',
    );
    expect(fetchStub.firstCall.args[1]?.method).to.deep.equal('POST');
    expect(fetchStub.firstCall.args[1]?.body).to.deep.equal('"rawTxPayload"');
  });

  it('should throw an error', async function () {
    const fetchStub = sinon
      .stub(global, 'fetch')
      .rejects(new Error('Node returned an error'));

    await expect(
      injectTransaction('invalidPayload', 'https://test.com/'),
    ).to.be.rejectedWith('Broadcast outcome unknown');

    expect(fetchStub.callCount).to.equal(1);
    expect(fetchStub.firstCall.args[0]).to.deep.equal(
      'https://test.com/injection/operation?chain=main',
    );
    expect(fetchStub.firstCall.args[1]?.method).to.deep.equal('POST');
    expect(fetchStub.firstCall.args[1]?.body).to.deep.equal('"invalidPayload"');
  });

  it('surfaces an invalid success response as uncertain and never retries it', async function () {
    const fetchStub = sinon
      .stub(global, 'fetch')
      .returns(jsonOk({ error: 'unexpected response' }));
    await expect(
      injectTransaction('signedBytes', 'https://test.com/'),
    ).to.be.rejectedWith('Broadcast outcome unknown');
    expect(fetchStub.callCount).to.equal(1);
  });
});
