import {getApi, initApi} from "../utils/api";
import { calcuate_mint_liquidity_price_local, calcuate_burn_liquidity_price_local, calculate_sell_price_local, calculate_buy_price_local, calculate_sell_price_rpc, calculate_buy_price_rpc, getUserAssets, getBalanceOfAsset, getBalanceOfPool, getNextAssetId, getLiquidityAssetId, getAssetSupply, balanceTransfer, getSudoKey, sudoIssueAsset, transferAsset, createPool, sellAsset, buyAsset, mintLiquidity, burnLiquidity} from '../utils/tx'
import {waitNewBlock, expectEvent, getEventResult, ExtrinsicResult, EventResult} from '../utils/eventListeners'
import BN from 'bn.js'
import { Keyring } from '@polkadot/api'
import {AssetWallet, User} from "../utils/User";
import { validateAssetsWithValues, validateEmptyAssets } from "../utils/validators";
import { Assets } from "../utils/Assets";


jest.spyOn(console, 'log').mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = 'test';

var testUser1 : User;
var testUser2 : User;
var pallet : User;

var keyring : Keyring;
var firstCurrency :BN;
var secondCurrency :BN;

// Assuming the pallet's AccountId
const pallet_address = process.env.TEST_PALLET_ADDRESS;
const defaultCurrecyValue = 250000;


beforeAll( async () => {
	try {
		getApi();
	  } catch(e) {
		await initApi();
	}

})

beforeEach( async () => {
	await waitNewBlock();
	keyring = new Keyring({ type: 'sr25519' });

	// setup users
	testUser1 = new User(keyring);
	testUser2 = new User(keyring);
	// build Maciatko, he is sudo. :S
	const sudo = new User(keyring, '//Maciatko');
	
	// setup Pallet.
	pallet = new User(keyring);
	pallet.addFromAddress(keyring,pallet_address);
	
	//add two curerncies and balance to testUser:
	[firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(testUser1, 2, [defaultCurrecyValue,defaultCurrecyValue +1] );
	await testUser1.addBalance();
	await testUser1.createPoolToAsset(new BN(50000), new BN(50000), firstCurrency, secondCurrency);

	// add users to pair.
	keyring.addPair(testUser1.keyRingPair);
	keyring.addPair(testUser2.keyRingPair);
	keyring.addPair(sudo.keyRingPair);
	keyring.addPair(pallet.keyRingPair);

	// check users accounts.
	await waitNewBlock();
	pallet.addAssets([firstCurrency, secondCurrency]);
	testUser2.addAssets([firstCurrency, secondCurrency]);
	await pallet.refreshAmounts(AssetWallet.BEFORE);
	await testUser1.refreshAmounts(AssetWallet.BEFORE);
	await testUser2.refreshAmounts(AssetWallet.BEFORE);
});

test('xyk-pallet - AssetsOperation: buyAsset [maxAmountIn = 1M], buy asset', async() => {

	var poolBalanceBefore = await getBalanceOfPool(firstCurrency, secondCurrency);

	var amount = new BN(10000);
	var buyPriceLocal = calculate_buy_price_local(poolBalanceBefore[0], poolBalanceBefore[1], amount);
	var buyPriceRpc = await calculate_buy_price_rpc(poolBalanceBefore[0], poolBalanceBefore[1], amount);
	expect(buyPriceLocal).toEqual(buyPriceRpc);

	console.log("Bob: buying asset " + secondCurrency + ", selling asset " + firstCurrency);
	const soldAssetId = firstCurrency;
	const boughtAssetId = secondCurrency;
  	const eventPromise = getEventResult("xyk", "AssetsSwapped", 14);
  	buyAsset(testUser1.keyRingPair, soldAssetId, boughtAssetId, amount, new BN(1000000));
  	const eventResult = await eventPromise;
	expect(eventResult.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

	await testUser1.refreshAmounts(AssetWallet.AFTER);
	await testUser2.refreshAmounts(AssetWallet.AFTER);
	await pallet.refreshAmounts(AssetWallet.AFTER);

	testUser1.validateWalletIncreased(boughtAssetId, amount);
	testUser1.validateWalletReduced(soldAssetId, buyPriceLocal);
	testUser2.validateWalletsUnmodified();
	pallet.validateWalletIncreased(soldAssetId,buyPriceLocal);
	pallet.validateWalletReduced(boughtAssetId,amount);
	var pool_balance = await getBalanceOfPool(firstCurrency, secondCurrency);
	expect	([	poolBalanceBefore[0].add(buyPriceLocal),	poolBalanceBefore[1].sub(amount)	])
	.toEqual(pool_balance);

});

test('xyk-pallet - AssetsOperation: buyAsset [maxAmountIn = 1M], sell a bought asset', async() =>{

	var amount = new BN(10000);

	console.log("buying asset " + secondCurrency + ", selling asset " + firstCurrency);
	var soldAssetId = firstCurrency;
	var boughtAssetId = secondCurrency;
	await testUser1.buyAssets(soldAssetId, boughtAssetId, amount);
	
	var poolBalanceBefore = await getBalanceOfPool(secondCurrency, firstCurrency);
	var buyPriceLocal = calculate_buy_price_local(poolBalanceBefore[0], poolBalanceBefore[1], amount);
	var buypriceRpc = await calculate_buy_price_rpc(poolBalanceBefore[0], poolBalanceBefore[1], amount);
	expect(buyPriceLocal).toEqual(buypriceRpc);

	await testUser1.refreshAmounts(AssetWallet.BEFORE);
	await testUser2.refreshAmounts(AssetWallet.BEFORE);
	await pallet.refreshAmounts(AssetWallet.BEFORE);
	
	soldAssetId = secondCurrency;
	boughtAssetId = firstCurrency;
	//buy asset swiching the assetIds
	await testUser1.buyAssets( soldAssetId, boughtAssetId, amount);

	await testUser1.refreshAmounts(AssetWallet.AFTER);
	await testUser2.refreshAmounts(AssetWallet.AFTER);
	await pallet.refreshAmounts(AssetWallet.AFTER);

	testUser1.validateWalletIncreased(boughtAssetId, amount);
	testUser1.validateWalletReduced(soldAssetId, buyPriceLocal);
	testUser2.validateWalletsUnmodified();
	pallet.validateWalletIncreased(soldAssetId,buyPriceLocal);
	pallet.validateWalletReduced(boughtAssetId,amount);
	var pool_balance = await getBalanceOfPool(secondCurrency, firstCurrency);
	expect	([	poolBalanceBefore[0].add(buyPriceLocal),	poolBalanceBefore[1].sub(amount)	])
	.toEqual(pool_balance);

});
