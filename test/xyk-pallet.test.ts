import {getApi, initApi} from "../utils/api";
// import { ApiPromise, WsProvider } from '@polkadot/api';
import {EventTest} from '../utils/actions';
import { getCurrentNonce, signTx, getBalanceOfAsset, getBalanceOfPool, getNextAssetId, getLiquidityAssetId, issueAsset, transferAsset, createPool, sellAsset, buyAsset, mintLiquidity, burnLiquidity} from '../utils/tx'
import {waitNewBlock, expectAssetIssued, expectPoolCreated, expectAssetsSwapped, expectSystemExtrinsicEvent, expectSystemExtrinsicEventDebug} from '../utils/eventListeners'
import BN from 'bn.js'
import { Keyring } from '@polkadot/api'
import {sleep} from "../utils/utils";

// function createApi (): Promise<ApiPromise> {
//   jest.setTimeout(30000);
//   process.env.NODE_ENV = 'test';
//
//   const wsProvider = new WsProvider('ws://127.0.0.1:9944');
//   // const provider = new WsProvider('wss://westend-rpc.polkadot.io/');
//   // const provider = new WsProvider('ws://127.0.0.1:9944/');
//
//   return new ApiPromise({
//
//     provider: wsProvider,
//     rpc: {
//       xyk: {
//         calculate_buy_price: {
//           description: '',
//           params: [
//             {
//               name: 'input_reserve',
//               type: 'Balance',
//             },
//             {
//               name: 'output_reserve',
//               type: 'Balance',
//             },
//             {
//               name: 'sell_amount',
//               type: 'Balance',
//             },
//           ],
//           type: 'Balance',
//         },
//         calculate_sell_price: {
//           description: '',
//           params: [
//             {
//               name: 'input_reserve',
//               type: 'Balance',
//             },
//             {
//               name: 'output_reserve',
//               type: 'Balance',
//             },
//             {
//               name: 'sell_amount',
//               type: 'Balance',
//             },
//           ],
//           type: 'Balance',
//         },
//       },
//     },
//     types: {
//       // mapping the actual specified address format
//       Address: 'AccountId',
//       // mapping the lookup
//       LookupSource: 'AccountId',
//
//       AssetInfo: {
//         name: 'Option<Vec<u8>>',
//         symbol: 'Option<Vec<u8>>',
//         description: 'Option<Vec<u8>>',
//         decimals: 'Option<u32>',
//       },
//
//       AppId: '[u8; 20]',
//       Message: {
//         payload: 'Vec<u8>',
//         verification: 'VerificationInput',
//       },
//       VerificationInput: {
//         _enum: {
//           Basic: 'VerificationBasic',
//           None: null,
//         },
//       },
//       VerificationBasic: {
//         blockNumber: 'u64',
//         eventIndex: 'u32',
//       },
//       TokenId: 'H160',
//       BridgedAssetId: 'H160',
//       AssetAccountData: {
//         free: 'U256',
//       },
//       EthereumHeader: {
//         parentHash: 'H256',
//         timestamp: 'u64',
//         number: 'u64',
//         author: 'H160',
//         transactionsRoot: 'H256',
//         ommersHash: 'H256',
//         extraData: 'Vec<u8>',
//         stateRoot: 'H256',
//         receiptsRoot: 'H256',
//         logBloom: 'Bloom',
//         gasUsed: 'U256',
//         gasLimit: 'U256',
//         difficulty: 'U256',
//         seal: 'Vec<Vec<u8>>',
//       },
//       Bloom: {
//         _: '[u8; 256]',
//       },
//     },
//   }).isReady;
// }

test('xyk-pallet test', async () => {
	jest.setTimeout(3000000);
  process.env.NODE_ENV = 'test';

	try {
    getApi();
  } catch(e) {
    await initApi();
  }
  // const api = await createApi();
	// console.log('Hi!!!!!!');
	// await EventTest(new BN(0),new BN(1));
	// console.log('HEY!!!!!!');

	const keyring = new Keyring({ type: 'sr25519' })
  const alice = keyring.addFromUri('//Alice')
  const bob = keyring.addFromUri('//Bob')
  const charlie = keyring.addFromUri('//Charlie')

  const nextAssetId = await getNextAssetId()
  const firstAssetId = new BN(nextAssetId.toString())
  const secondAssetId = firstAssetId.add(new BN(1))

	//issue asset 1
   console.log("Alice: issuing asset " + firstAssetId)
   var systemExtrinsicEventPromise = expectSystemExtrinsicEventDebug("assets","Issued")
   issueAsset(alice, new BN(200000))
   var systemExtrinsicResponse = await systemExtrinsicEventPromise
   // console.log(systemExtrinsicResponse)
	 expect(systemExtrinsicResponse).toEqual('system.ExtrinsicSuccess');

   await waitNewBlock()

   //issue asset 2
  console.log("Alice: issuing asset " + secondAssetId)
  systemExtrinsicEventPromise = expectSystemExtrinsicEventDebug("assets","Issued")
  issueAsset(alice, new BN(100000))
  systemExtrinsicResponse = await systemExtrinsicEventPromise
  // console.log(systemExtrinsicResponse)
	expect(systemExtrinsicResponse).toEqual('system.ExtrinsicSuccess');

  await waitNewBlock()

  console.log("Alice: creating pool " + firstAssetId + " - " + secondAssetId)
  systemExtrinsicEventPromise = expectSystemExtrinsicEventDebug("xyk","PoolCreated")
  createPool(alice, firstAssetId, new BN(50000), secondAssetId, new BN(50000))
  systemExtrinsicResponse = await systemExtrinsicEventPromise
  // console.log(systemExtrinsicResponse)
	expect(systemExtrinsicResponse).toEqual('system.ExtrinsicSuccess');

	await waitNewBlock()

  console.log("Alice: minting liquidity " + firstAssetId + " - " + secondAssetId)
  systemExtrinsicEventPromise = expectSystemExtrinsicEventDebug("xyk", "LiquidityMinted")
  mintLiquidity(alice, firstAssetId, secondAssetId, new BN(30000))
  systemExtrinsicResponse = await systemExtrinsicEventPromise
  // console.log(systemExtrinsicResponse)
	expect(systemExtrinsicResponse).toEqual('system.ExtrinsicSuccess');

  await waitNewBlock()

	console.log("Alice: transfering asset " + firstAssetId + " to Bob")
	// systemExtrinsicEventPromise = expectSystemExtrinsicEvent()
	systemExtrinsicEventPromise = expectSystemExtrinsicEventDebug("assets", "Transferred")
	transferAsset(alice, firstAssetId, bob.address, new BN(100000))
	systemExtrinsicResponse = await systemExtrinsicEventPromise
	// console.log(systemExtrinsicResponse)
	expect(systemExtrinsicResponse).toEqual('system.ExtrinsicSuccess');

	await waitNewBlock()

  console.log("Bob: selling asset " + firstAssetId + ", buying asset " + secondAssetId)
	var soldAssetId = firstAssetId;
	var boughtAssetId = secondAssetId;
  systemExtrinsicEventPromise = expectSystemExtrinsicEventDebug("xyk", "AssetsSwapped")
  sellAsset(bob, soldAssetId, boughtAssetId, new BN(30000), new BN(0))
  systemExtrinsicResponse = await systemExtrinsicEventPromise
  // console.log(systemExtrinsicResponse)
	expect(systemExtrinsicResponse).toEqual('system.ExtrinsicSuccess');

	await waitNewBlock()

  console.log("Bob: selling asset " + secondAssetId + ", buying asset " + firstAssetId)
	soldAssetId = secondAssetId;
	boughtAssetId = firstAssetId;
  systemExtrinsicEventPromise = expectSystemExtrinsicEventDebug("xyk", "AssetsSwapped")
  sellAsset(bob, soldAssetId, boughtAssetId, new BN(20000), new BN(0))
  systemExtrinsicResponse = await systemExtrinsicEventPromise
  // console.log(systemExtrinsicResponse)
	expect(systemExtrinsicResponse).toEqual('system.ExtrinsicSuccess');

	await waitNewBlock()

  console.log("Bob: buying asset " + secondAssetId + ", selling asset " + firstAssetId)
	soldAssetId = firstAssetId;
	boughtAssetId = secondAssetId;
  systemExtrinsicEventPromise = expectSystemExtrinsicEventDebug("xyk", "AssetsSwapped")
  buyAsset(bob, soldAssetId, boughtAssetId, new BN(10000), new BN(1000000))
  systemExtrinsicResponse = await systemExtrinsicEventPromise
  // console.log(systemExtrinsicResponse)
	expect(systemExtrinsicResponse).toEqual('system.ExtrinsicSuccess');

	await waitNewBlock()

  console.log("Bob: buying asset " + firstAssetId + ", selling asset " + secondAssetId)
	soldAssetId = firstAssetId;
	boughtAssetId = secondAssetId;
  systemExtrinsicEventPromise = expectSystemExtrinsicEventDebug("xyk", "AssetsSwapped")
  buyAsset(bob, soldAssetId, boughtAssetId, new BN(20000), new BN(1000000))
  systemExtrinsicResponse = await systemExtrinsicEventPromise
  // console.log(systemExtrinsicResponse)
	expect(systemExtrinsicResponse).toEqual('system.ExtrinsicSuccess');

	await waitNewBlock()

  console.log("Alice: burning liquidity " + firstAssetId + " - " + secondAssetId)
  systemExtrinsicEventPromise = expectSystemExtrinsicEventDebug("xyk", "LiquidityBurned")
  burnLiquidity(alice, firstAssetId, secondAssetId, new BN(20000))
  systemExtrinsicResponse = await systemExtrinsicEventPromise
  // console.log(systemExtrinsicResponse)
	expect(systemExtrinsicResponse).toEqual('system.ExtrinsicSuccess');


	await waitNewBlock()

  console.log("Alice: burning all liquidity " + firstAssetId + " - " + secondAssetId)
  systemExtrinsicEventPromise = expectSystemExtrinsicEventDebug("xyk", "LiquidityBurned")
	let liquidity_asset_id = new BN(await getLiquidityAssetId(firstAssetId, secondAssetId));
	let liquidity_asset_amount = await getBalanceOfAsset(liquidity_asset_id, alice);
  burnLiquidity(alice, firstAssetId, secondAssetId, liquidity_asset_amount)
  systemExtrinsicResponse = await systemExtrinsicEventPromise
  // console.log(systemExtrinsicResponse)
	expect(systemExtrinsicResponse).toEqual('system.ExtrinsicSuccess');


});
