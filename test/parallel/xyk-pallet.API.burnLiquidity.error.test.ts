import {getApi, initApi} from "../../utils/api";
import { getBalanceOfPool, getLiquidityAssetId, burnLiquidity, getBalanceOfAsset} from '../../utils/tx'
import {waitNewBlock, ExtrinsicResult} from '../../utils/eventListeners'
import BN from 'bn.js'
import { Keyring } from '@polkadot/api'
import {AssetWallet, User} from "../../utils/User";
import { validateUnmodified } from "../../utils/validators";
import { Assets } from "../../utils/Assets";
import { getEnvironmentRequiredVars, UserCreatesAPoolAndMintliquidity } from "../../utils/utils";
import { getEventResultFromTxWait } from "../../utils/txHandler";

const {sudo:sudoUserName} = getEnvironmentRequiredVars();

jest.spyOn(console, 'log').mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = 'test';

const defaultCurrecyValue = 250000;

describe('xyk-pallet - Burn liquidity tests: BurnLiquidity Errors:', () => {
	
	var testUser1 : User;
	var sudo : User;

	var keyring : Keyring;
	var firstCurrency :BN;
	var secondCurrency :BN;

	beforeAll( async () => {
		try {
			getApi();
		  } catch(e) {
			await initApi();
		}
	});

	beforeEach(async () => {
		await waitNewBlock();
		keyring = new Keyring({ type: 'sr25519' });
	
		// setup users
		testUser1 = new User(keyring);
	
		sudo = new User(keyring, sudoUserName);
		
		// add users to pair.
		keyring.addPair(testUser1.keyRingPair);
		keyring.addPair(sudo.keyRingPair);
		await testUser1.setBalance(sudo);

	});

	test('Burn liquidity assets that does not belong to any pool', async () => {
		await testUser1.setBalance(sudo);
		const [firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(testUser1, [defaultCurrecyValue, defaultCurrecyValue], sudo);
		await burnLiquidity(testUser1.keyRingPair, firstCurrency, secondCurrency, new BN(1))
		.then(
			(result) => {
				const eventResponse = getEventResultFromTxWait(result);
				expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
				expect(eventResponse.data).toEqual(3);
			}
		);
		
	});

	test('Burn liquidity  for more assets than the liquidity pool has issued', async () => {
		const poolAmount = new BN(defaultCurrecyValue).div(new BN(2));
		[firstCurrency,secondCurrency] = await UserCreatesAPoolAndMintliquidity(testUser1, sudo, new BN(defaultCurrecyValue),poolAmount);
		let poolBalance = await getBalanceOfPool(firstCurrency,secondCurrency);
		const liquidityAssetId = await getLiquidityAssetId(firstCurrency, secondCurrency);
		const liquidityBalance = await getBalanceOfAsset(liquidityAssetId, testUser1.keyRingPair.address);
		await testUser1.refreshAmounts(AssetWallet.BEFORE);
		
		await burnLiquidity(testUser1.keyRingPair, firstCurrency,secondCurrency, liquidityBalance.add(new BN(1)))
		.then(
			(result) => {
				const eventResponse = getEventResultFromTxWait(result);
				expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
				expect(eventResponse.data).toEqual(2);
			}
		);


		await validateUnmodified(firstCurrency,secondCurrency,testUser1,poolBalance);

	});

	test('Burn someone else liquidities', async () => {
		//create a new user
		const testUser2 = new User(keyring);
		keyring.addPair(testUser2.keyRingPair);
		await testUser2.setBalance(sudo);
		[firstCurrency,secondCurrency] = await UserCreatesAPoolAndMintliquidity(testUser1, sudo, new BN(defaultCurrecyValue));
		
		const liquidityAssetId = await getLiquidityAssetId(firstCurrency, secondCurrency);
		testUser1.addAsset(liquidityAssetId);
		const aFewAssetsToBurn = new BN(1000);

		await burnLiquidity(testUser2.keyRingPair, firstCurrency,secondCurrency, aFewAssetsToBurn )
		.then(
			(result) => {
				const eventResponse = getEventResultFromTxWait(result);
				expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
				expect(eventResponse.data).toEqual(2);
			}
		);

	});

});



