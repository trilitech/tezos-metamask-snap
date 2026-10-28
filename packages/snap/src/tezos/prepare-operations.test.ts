import chai, { expect } from 'chai';
import sinonChai from 'sinon-chai';
import chaiAsPromised from 'chai-as-promised';
import chaiBytes from 'chai-bytes';
import * as sinon from 'sinon';
import { jsonOk } from '../../test/utils.test';
import { DEFAULT_NODE_URL } from '../constants';
import {
  handleDelegationOperation,
  handleOriginationOperation,
  handleRevealOperation,
  handleTransactionOperation,
  prepareOperations,
} from './prepare-operations';
import {
  TezosDelegationOperation,
  TezosOperation,
  TezosOperationType,
  TezosOriginationOperation,
  TezosRevealOperation,
  TezosTransactionOperation,
} from './types';
import * as estimateFeeMethods from './estimate-fee';
import * as getBalanceMethods from './get-balance-of-address';

chai.use(chaiBytes);
chai.use(sinonChai);
chai.use(chaiAsPromised);

const setupFetchStubs = (address: string, blockHash: string) => {
  const fetchStub = sinon.stub(global, 'fetch');

  const fetchCounterStub = fetchStub
    .withArgs(
      `${DEFAULT_NODE_URL}chains/main/blocks/${blockHash}/context/contracts/${address}/counter`,
    )
    .returns(jsonOk('13186806'));

  const fetchHeadStub = fetchStub
    .withArgs(`${DEFAULT_NODE_URL}chains/main/blocks/head/hash`)
    .returns(jsonOk(blockHash));

  const fetchManagerStub = fetchStub
    .withArgs(
      `${DEFAULT_NODE_URL}chains/main/blocks/${blockHash}/context/contracts/${address}/manager_key`,
    )
    .returns(jsonOk('edpkuwYWCugiYG7nMnVUdopFmyc3sbMSiLqsJHTQgGtVhtSdLSw6HG'));

  const balanceStub = sinon
    .stub(getBalanceMethods, 'getBalanceOfAddress')
    .returns(Promise.resolve('1000'));

  return {
    fetchStub,
    fetchCounterStub,
    fetchHeadStub,
    fetchManagerStub,
    balanceStub,
  };
};

const assertPrepareOperationResponse = ({
  fetchStub,
  fetchCounterStub,
  fetchHeadStub,
  fetchManagerStub,
  feeStub,
}: {
  fetchStub: sinon.SinonStub;
  fetchCounterStub: sinon.SinonStub;
  fetchHeadStub: sinon.SinonStub;
  fetchManagerStub: sinon.SinonStub;
  feeStub: sinon.SinonStub;
}) => {
  expect(fetchStub.callCount).to.equal(3);

  expect(fetchCounterStub.callCount).to.equal(1);
  expect(fetchCounterStub.firstCall.args[0]).to.deep.equal(
    'https://tezos-mainnet.octez.io/chains/main/blocks/BLbfxzLVe4Wu25Wmz3MoDWp8c6HmEwKxfR3MC86FHiK12zNp4WK/context/contracts/tz1UNer1ijeE9ndjzSszRduR3CzX49hoBUB3/counter',
    'fetchCounterStub',
  );

  expect(fetchHeadStub.callCount).to.equal(1);
  expect(fetchHeadStub.firstCall.args[0]).to.deep.equal(
    'https://tezos-mainnet.octez.io/chains/main/blocks/head/hash',
    'fetchHeadStub',
  );

  expect(fetchManagerStub.callCount).to.equal(1);
  expect(fetchManagerStub.firstCall.args[0]).to.deep.equal(
    'https://tezos-mainnet.octez.io/chains/main/blocks/BLbfxzLVe4Wu25Wmz3MoDWp8c6HmEwKxfR3MC86FHiK12zNp4WK/context/contracts/tz1UNer1ijeE9ndjzSszRduR3CzX49hoBUB3/manager_key',
    'fetchManagerStub',
  );

  expect(feeStub.callCount).to.equal(1);
};

describe('Test function: prepareOperations', function () {
  afterEach(function () {
    sinon.restore();
  });

  it('should prepare an operation', async function () {
    const address = 'tz1UNer1ijeE9ndjzSszRduR3CzX49hoBUB3';
    const blockHash = 'BLbfxzLVe4Wu25Wmz3MoDWp8c6HmEwKxfR3MC86FHiK12zNp4WK';

    const {
      fetchStub,
      fetchCounterStub,
      fetchHeadStub,
      fetchManagerStub,
      balanceStub,
    } = setupFetchStubs(address, blockHash);

    const feeStub = sinon
      .stub(estimateFeeMethods, 'estimateAndReplaceLimitsAndFee')
      .returns(
        Promise.resolve({
          branch: 'BLbfxzLVe4Wu25Wmz3MoDWp8c6HmEwKxfR3MC86FHiK12zNp4WK',
          contents: [
            {
              kind: 'transaction',
              amount: '1',
              destination: 'tz1UNer1ijeE9ndjzSszRduR3CzX49hoBUB3',
              source: 'tz1UNer1ijeE9ndjzSszRduR3CzX49hoBUB3',
              counter: '13186807',
              fee: '454',
              gas_limit: '1001',
              storage_limit: '0',
            } as TezosTransactionOperation,
          ],
        }),
      );

    const response = await prepareOperations(
      address,
      'edpkuwYWCugiYG7nMnVUdopFmyc3sbMSiLqsJHTQgGtVhtSdLSw6HG',
      [
        {
          kind: TezosOperationType.TRANSACTION,
          amount: '1',
          destination: address,
        } as TezosTransactionOperation,
      ],
      DEFAULT_NODE_URL,
    );

    expect(response).to.equal(
      '74b00cb4900aba5612890c2e794955137e4291a14d79c43dd5803bb4085e4abd6c005fd0a7ece135cecfd71fcf78cf6656d5047fb980c603f7eda406e907000100005fd0a7ece135cecfd71fcf78cf6656d5047fb98000',
    );

    assertPrepareOperationResponse({
      feeStub,
      fetchStub,
      fetchCounterStub,
      fetchHeadStub,
      fetchManagerStub,
    });

    expect(balanceStub.callCount).to.equal(1);
  });

  it('should return other operation types unmodified', async function () {
    const address = 'tz1UNer1ijeE9ndjzSszRduR3CzX49hoBUB3';
    const blockHash = 'BLbfxzLVe4Wu25Wmz3MoDWp8c6HmEwKxfR3MC86FHiK12zNp4WK';

    const {
      fetchStub,
      fetchCounterStub,
      fetchHeadStub,
      fetchManagerStub,
      balanceStub,
    } = setupFetchStubs(address, blockHash);

    const feeStub = sinon
      .stub(estimateFeeMethods, 'estimateAndReplaceLimitsAndFee')
      .returns(
        Promise.resolve({
          branch: 'BLbfxzLVe4Wu25Wmz3MoDWp8c6HmEwKxfR3MC86FHiK12zNp4WK',
          contents: [
            {
              kind: TezosOperationType.BALLOT,
              source: address,
              period: 98,
              proposal: 'PtNairobiyssHuh87hEhfVBGCVrK3WnS8Z2FT4ymB5tAa4r1nQf',
              ballot: 'yay',
            } as TezosOperation,
          ],
        }),
      );

    const response = await prepareOperations(
      address,
      'edpkuwYWCugiYG7nMnVUdopFmyc3sbMSiLqsJHTQgGtVhtSdLSw6HG',
      [
        {
          kind: TezosOperationType.BALLOT,
          source: address,
          period: 98,
          proposal: 'PtNairobiyssHuh87hEhfVBGCVrK3WnS8Z2FT4ymB5tAa4r1nQf',
          ballot: 'yay',
        } as TezosOperation,
      ],
      DEFAULT_NODE_URL,
    );

    expect(response).to.equal(
      '74b00cb4900aba5612890c2e794955137e4291a14d79c43dd5803bb4085e4abd06005fd0a7ece135cecfd71fcf78cf6656d5047fb98000000062d9b8c2314cc05ffa3fc655a98bb87155be4cf7ce67fee6b594ea9302e8655df200',
    );

    assertPrepareOperationResponse({
      feeStub,
      fetchStub,
      fetchCounterStub,
      fetchHeadStub,
      fetchManagerStub,
    });

    expect(balanceStub.callCount).to.equal(0);
  });

  describe('Internal function: handleRevealOperation', function () {
    it('should handle a reveal operation', async function () {
      const address = 'tz1UNer1ijeE9ndjzSszRduR3CzX49hoBUB3';

      const response = await handleRevealOperation(
        {
          kind: TezosOperationType.REVEAL,
          public_key: 'edpk...',
        } as TezosRevealOperation,
        address,
        '1',
        '2',
        '3',
        '4',
      );

      expect(response).to.deep.equal({
        kind: 'reveal',
        public_key: 'edpk...',
        source: 'tz1UNer1ijeE9ndjzSszRduR3CzX49hoBUB3',
        counter: '1',
        fee: '2',
        gas_limit: '3',
        storage_limit: '4',
      });
    });

    it('should reject a reveal operation without public_key', async function () {
      const address = 'tz1UNer1ijeE9ndjzSszRduR3CzX49hoBUB3';

      await expect(
        handleRevealOperation(
          {
            kind: TezosOperationType.REVEAL,
          } as TezosRevealOperation,
          address,
          '1',
          '2',
          '3',
          '4',
        ),
      ).to.be.rejectedWith('property "public_key" was not defined');
    });
  });

  describe('Internal function: handleDelegationOperation', function () {
    it('should handle a delegate operation', async function () {
      const address = 'tz1UNer1ijeE9ndjzSszRduR3CzX49hoBUB3';

      const response = await handleDelegationOperation(
        {
          kind: TezosOperationType.DELEGATION,
        } as TezosDelegationOperation,
        address,
        '1',
        '2',
        '3',
        '4',
      );

      expect(response).to.deep.equal({
        kind: 'delegation',
        source: 'tz1UNer1ijeE9ndjzSszRduR3CzX49hoBUB3',
        counter: '1',
        fee: '2',
        gas_limit: '3',
        storage_limit: '4',
      });
    });
  });

  describe('Internal function: handleTransactionOperation', function () {
    it('should handle a transaction operation', async function () {
      const address = 'tz1UNer1ijeE9ndjzSszRduR3CzX49hoBUB3';

      const response = await handleTransactionOperation(
        {
          kind: TezosOperationType.TRANSACTION,
          amount: '1',
          destination: address,
        } as TezosTransactionOperation,
        address,
        '1',
        '2',
      );

      expect(response).to.deep.equal({
        kind: 'transaction',
        amount: '1',
        destination: address,
        source: 'tz1UNer1ijeE9ndjzSszRduR3CzX49hoBUB3',
        counter: '1',
        fee: '2',
        gas_limit: '1040000',
        storage_limit: '60000',
      });
    });

    it('should reject a transaction operation without amount', async function () {
      const address = 'tz1UNer1ijeE9ndjzSszRduR3CzX49hoBUB3';

      await expect(
        handleTransactionOperation(
          {
            kind: TezosOperationType.TRANSACTION,
            destination: address,
          } as TezosTransactionOperation,
          address,
          '1',
          '2',
        ),
      ).to.be.rejectedWith('property "amount" was not defined');
    });

    it('should reject a transaction operation without destination', async function () {
      const address = 'tz1UNer1ijeE9ndjzSszRduR3CzX49hoBUB3';

      await expect(
        handleTransactionOperation(
          {
            kind: TezosOperationType.TRANSACTION,
            amount: '1',
          } as TezosTransactionOperation,
          address,
          '1',
          '2',
        ),
      ).to.be.rejectedWith('property "destination" was not defined');
    });
  });

  describe('Internal function: handleOriginationOperation', function () {
    it('should handle a transaction operation', async function () {
      const address = 'tz1UNer1ijeE9ndjzSszRduR3CzX49hoBUB3';

      const response = await handleOriginationOperation(
        {
          kind: TezosOperationType.ORIGINATION,
          balance: '1',
          script: address,
        } as TezosOriginationOperation,
        address,
        '1',
        '2',
      );

      expect(response).to.deep.equal({
        kind: 'origination',
        balance: '1',
        script: address,
        source: 'tz1UNer1ijeE9ndjzSszRduR3CzX49hoBUB3',
        counter: '1',
        fee: '2',
        gas_limit: '1040000',
        storage_limit: '60000',
      });
    });

    it('should reject a transaction operation without balance', async function () {
      const address = 'tz1UNer1ijeE9ndjzSszRduR3CzX49hoBUB3';

      await expect(
        handleOriginationOperation(
          {
            kind: TezosOperationType.ORIGINATION,
            script: address,
          } as TezosOriginationOperation,
          address,
          '1',
          '2',
        ),
      ).to.be.rejectedWith('property "balance" was not defined');
    });

    it('should reject a transaction operation without script', async function () {
      const address = 'tz1UNer1ijeE9ndjzSszRduR3CzX49hoBUB3';

      await expect(
        handleOriginationOperation(
          {
            kind: TezosOperationType.ORIGINATION,
            balance: '1',
          } as TezosOriginationOperation,
          address,
          '1',
          '2',
        ),
      ).to.be.rejectedWith('property "script" was not defined');
    });
  });
});
