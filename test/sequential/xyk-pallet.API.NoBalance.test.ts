import {getApi, initApi} from "../../utils/api";
import { getBalanceOfPool, getCurrentNonce, getLiquidityAssetId, signTx} from '../../utils/tx'
import {waitNewBlock} from '../../utils/eventListeners'
import BN from 'bn.js'
import { Keyring } from '@polkadot/api'
import {AssetWallet, User} from "../../utils/User";
import { validateAssetsWithValues } from "../../utils/validators";
import { Assets } from "../../utils/Assets";
import { getEnvironmentRequiredVars } from "../../utils/utils";


jest.spyOn(console, 'log').mockImplementation(jest.fn());
jest.spyOn(console, 'error').mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = 'test';

var testUser1 : User;
var sudo : User;

var keyring : Keyring;
var firstCurrency :BN;
var secondCurrency :BN;
var first_asset_amount = new BN(50000);
var second_asset_amount = new BN(50000);
//creating pool
const pool_balance_before = [new BN(0), new BN(0)];

const {sudo:sudoUserName} = getEnvironmentRequiredVars();

const defaultCurrecyValue = 250000;

beforeAll( async () => {
	try {
		getApi();
		} catch(e) {
		await initApi();
	}


	await waitNewBlock();
	keyring = new Keyring({ type: 'sr25519' });

	// setup users
	testUser1 = new User(keyring);
	sudo = new User(keyring, sudoUserName);
	
	//add two curerncies and balance to testUser:
	[firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(testUser1, 2, [defaultCurrecyValue,defaultCurrecyValue +1], sudo);
	await testUser1.setBalance(sudo, 0 , Math.pow(10,11) );
	// add users to pair.
	keyring.addPair(testUser1.keyRingPair);
	keyring.addPair(sudo.keyRingPair);

	// check users accounts.
	await testUser1.refreshAmounts(AssetWallet.BEFORE);
	validateAssetsWithValues([testUser1.getAsset(firstCurrency)?.amountBefore!,testUser1.getAsset(secondCurrency)?.amountBefore! ], [defaultCurrecyValue, defaultCurrecyValue+1]);

})

test('xyk-pallet - Alternative  - No Balance for creating pool', async () => {
		let exception = false;
		const api = getApi();

		await expect( 
			signTx( 
				api?.tx.xyk.createPool(firstCurrency, first_asset_amount, secondCurrency, second_asset_amount), 
				testUser1.keyRingPair,
				await  getCurrentNonce(testUser1.keyRingPair.address))
				.catch((reason) => {
					exception = true;
					throw new Error(reason);
				})
		).rejects
		.toThrow('1010: Invalid Transaction: Inability to pay some fees , e.g. account balance too low')
		expect(exception).toBeTruthy();
});

afterEach(async () => {

	var liquidity_asset_id = await getLiquidityAssetId(firstCurrency, secondCurrency);

	testUser1.addAsset(liquidity_asset_id, new BN(0));
	//validate
	await testUser1.refreshAmounts(AssetWallet.AFTER);

	await testUser1.validateWalletsUnmodified();

	var pool_balance = await getBalanceOfPool(firstCurrency, secondCurrency);
	expect([pool_balance_before[0], pool_balance_before[1]]).toEqual(pool_balance);
	const balance = await getBalanceOfPool(secondCurrency, firstCurrency);
	expect([pool_balance_before[0], pool_balance_before[1]]).toEqual([balance[1], balance[0]]);

	expect(liquidity_asset_id).toEqual(new BN(0));

})
