import chai, { expect } from 'chai';
import sinonChai from 'sinon-chai';
import chaiAsPromised from 'chai-as-promised';
import chaiBytes from 'chai-bytes';
import * as sinon from 'sinon';
import { jsonOk } from '../../test/utils.test';
import { DEFAULT_NODE_URL } from '../constants';
import {
  estimateAndReplaceLimitsAndFee,
  sumUpInternalFees,
} from './estimate-fee';
import { TezosOperationType, TezosTransactionOperation } from './types';

chai.use(chaiBytes);
chai.use(sinonChai);
chai.use(chaiAsPromised);

describe('Test function: estimateFee', function () {
  afterEach(function () {
    sinon.restore();
  });

  it('should estimate the fee', async function () {
    const address = 'tz1UNer1ijeE9ndjzSszRduR3CzX49hoBUB3';
    const blockHash = 'BLbfxzLVe4Wu25Wmz3MoDWp8c6HmEwKxfR3MC86FHiK12zNp4WK';

    const fetchStub = sinon.stub(global, 'fetch');

    const fetchHeaderStub = fetchStub
      .withArgs(`${DEFAULT_NODE_URL}chains/main/blocks/head/header`)
      .returns(
        jsonOk({
          protocol: 'PtMumbai2TmsJHNGRkD8v8YDbtao7BLUC3wjASn1inAKLFCjaH1',
          chain_id: 'NetXdQprcVkpaWU',
          hash: 'BM9ZS9x59tNxAiZh86NKQNHcFs7WBqNpWuwKszg2mL2pYq3uP83',
          level: 3625334,
          proto: 16,
          predecessor: 'BKzW3ru6BZXDwSC8SaNtKtLudNu1S4v4Z6JYcfMgZh4hC1ajdEe',
          timestamp: '2023-05-31T08:07:41Z',
          validation_pass: 4,
          operations_hash:
            'LLob1HWWXBkWhxub1KLz8uJybvV8NS6CjceERBCwVM4t4RsJgrrcn',
          fitness: ['02', '00375176', '', 'ffffffff', '00000000'],
          context: 'CoVU7W1UKmcRT6JQbdmvZKgB34pkLFGaHN9xcrr7Xw7VxNfqH8L5',
          payload_hash: 'vh26LAp4YnqpJsc8g7fmAH12jL2q4WYBQdZuGtZ4iue9HVqzMyc1',
          payload_round: 0,
          proof_of_work_nonce: '5977cc1594af0400',
          liquidity_baking_toggle_vote: 'pass',
          signature:
            'sigYGVjZwn5yJ3SxYWEWNbvWj2RMDjAbQc9xba3hiVgUcLY8gyzvDUHb79ywewfnWnUNb8SRMsq32xopkmNi4miq4ST3ZzDF',
        }),
      );

    const fetchOperationStub = fetchStub
      .withArgs(
        `${DEFAULT_NODE_URL}chains/main/blocks/head/helpers/scripts/run_operation`,
      )
      .returns(
        jsonOk({
          contents: [
            {
              kind: 'transaction',
              source: 'tz1UNer1ijeE9ndjzSszRduR3CzX49hoBUB3',
              fee: '0',
              counter: '13186807',
              gas_limit: '1040000',
              storage_limit: '60000',
              amount: '1',
              destination: 'tz1UNer1ijeE9ndjzSszRduR3CzX49hoBUB3',
              metadata: {
                operation_result: {
                  status: 'applied',
                  balance_updates: [
                    {
                      kind: 'contract',
                      contract: 'tz1UNer1ijeE9ndjzSszRduR3CzX49hoBUB3',
                      change: '-1',
                      origin: 'block',
                    },
                    {
                      kind: 'contract',
                      contract: 'tz1UNer1ijeE9ndjzSszRduR3CzX49hoBUB3',
                      change: '1',
                      origin: 'block',
                    },
                  ],
                  consumed_milligas: '1000040',
                },
              },
            },
          ],
          signature:
            'sigUHx32f9wesZ1n2BWpixXz4AQaZggEtchaQNHYGRCoWNAXx45WGW2ua3apUUUAGMLPwAU41QoaFCzVSL61VaessLg4YbbP',
        }),
      );

    const response = await estimateAndReplaceLimitsAndFee(
      {
        branch: blockHash,
        contents: [
          {
            kind: TezosOperationType.TRANSACTION,
            amount: '1',
            destination: address,
            source: 'tz1UNer1ijeE9ndjzSszRduR3CzX49hoBUB3',
            counter: '13186807',
            fee: '0',
            gas_limit: '1040000',
            storage_limit: '60000',
          } as TezosTransactionOperation,
        ],
      },
      DEFAULT_NODE_URL,
    );

    expect(response).to.deep.equal({
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
    });

    expect(fetchStub.callCount).to.equal(2, 'fetchStub');
    expect(fetchHeaderStub.callCount).to.equal(1, 'fetchHeaderStub');
    expect(fetchHeaderStub.firstCall.args[0]).to.deep.equal(
      'https://tezos-mainnet.octez.io/chains/main/blocks/head/header',
    );
    expect(fetchOperationStub.callCount).to.equal(1, 'fetchOperationStub');
    expect(fetchOperationStub.firstCall.args[0]).to.deep.equal(
      'https://tezos-mainnet.octez.io/chains/main/blocks/head/helpers/scripts/run_operation',
    );
  });

  it('should sum up internal fees', async function () {
    const fees = sumUpInternalFees({
      balance_updates: [],
      operation_result: {
        status: 'ok',
        balance_updates: [],
        consumed_milligas: '1',
      },
      internal_operation_results: [
        {
          result: {
            consumed_milligas: '2',
            paid_storage_size_diff: '3',
            originated_contracts: ['KT1...'],
            allocated_destination_contract: true,
          },
        },
      ],
    });

    expect(fees).to.deep.equal({
      gasLimit: 1,
      storageLimit: 517,
    });
  });

  it('should throw an error if there is an internal error', async function () {
    expect(() =>
      sumUpInternalFees({
        balance_updates: [],
        operation_result: {
          status: 'ok',
          balance_updates: [],
          consumed_milligas: '1',
        },
        internal_operation_results: [
          { result: { errors: 'test', consumed_milligas: '2' } },
        ],
      }),
    ).to.throw('An internal operation produced an error "test"');
  });
});
