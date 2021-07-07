/* eslint-disable no-loop-func */
import {getApi, initApi} from "../../../../utils/api";
import {waitNewBlock, ExtrinsicResult} from '../../../../utils/eventListeners'
import BN from 'bn.js'
import { Keyring } from '@polkadot/api'
import {User} from "../../../../utils/User";
import { Assets } from "../../../../utils/Assets";
import { getEnvironmentRequiredVars } from "../../../../utils/utils";
import { getEventResultFromTxWait } from "../../../../utils/txHandler";
import { transferAsset } from "../../../../utils/tx";

const {sudo:sudoUserName} = getEnvironmentRequiredVars();

jest.spyOn(console, 'log').mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = 'test';

describe('xyk-pallet - Burn liquidity tests: when burning liquidity you can', () => {
	
	var testUser1 : User;
	var testUser2 : User;
	var sudo : User;

	var keyring : Keyring;
	var firstCurrency :BN;
	var secondCurrency :BN;

	//creating pool
	
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
		testUser2 = new User(keyring);
	
		sudo = new User(keyring, sudoUserName);
		
		// add users to pair.
		keyring.addPair(testUser1.keyRingPair);
		keyring.addPair(testUser2.keyRingPair);
		keyring.addPair(sudo.keyRingPair);
		[firstCurrency,secondCurrency] = await Assets.setupUserWithCurrencies(testUser1, [20000000,20000000], sudo);
		await sudo.mint(firstCurrency,testUser2,new BN(20000000));
		await sudo.mint(secondCurrency,testUser2,new BN(20000000));
		await testUser1.setBalance(sudo);
		await testUser2.setBalance(sudo);


	});

	test('Test0', async () => {
		while(true){
			
			await transferAsset(testUser1.keyRingPair, firstCurrency, testUser2.keyRingPair.address, new BN(100000))
			.then(
				(result) => {
					const eventResponse = getEventResultFromTxWait(result, ["tokens", "Transferred", testUser1.keyRingPair.address]);
					expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
				}
			);
			await transferAsset(testUser2.keyRingPair, firstCurrency, testUser1.keyRingPair.address, new BN(100000))
			.then(
				(result) => {
					const eventResponse = getEventResultFromTxWait(result, ["tokens", "Transferred", testUser1.keyRingPair.address]);
					expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
				}
			);
		}
	});
});