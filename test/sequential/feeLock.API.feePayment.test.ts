/*
 *
 * @group sequential
 * @group gassless
 */

import { Keyring, ApiPromise } from "@polkadot/api";
import { getApi, initApi, getMangataInstance } from "../../utils/api";
import { Assets } from "../../utils/Assets";
import { MGA_ASSET_ID, TUR_ASSET_ID } from "../../utils/Constants";
import { waitSudoOperataionSuccess } from "../../utils/eventListeners";
import { BN, toBN } from "@mangata-finance/sdk";
import { setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import { updateFeeLockMetadata, unlockFee } from "../../utils/tx";
import { AssetWallet, User } from "../../utils/User";
import {
  getEnvironmentRequiredVars,
  waitForNBlocks,
  feeLockErrors,
  getBlockNumber,
} from "../../utils/utils";
import { Xyk } from "../../utils/xyk";
import {
  addMgaToWhitelisted,
  clearMgaFromWhitelisted,
} from "../../utils/feeLockHelper";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(2500000);
process.env.NODE_ENV = "test";

const { sudo: sudoUserName } = getEnvironmentRequiredVars();
let testUser1: User;
let api: ApiPromise;
let sudo: User;
let keyring: Keyring;
let firstCurrency: BN;
let feeLockMetadata: any;
let periodLength: any;
let feeLockAmount: any;
const thresholdValue = new BN(30000);
const defaultCurrencyValue = new BN(10000000);
const defaultPoolVolumeValue = new BN(1000000);

async function checkErrorSellAsset(
  user: User,
  soldAssetId: any,
  boughtAssetId: any,
  reason: string,
  amount = new BN(1000)
) {
  let exception = false;
  const mangata = await getMangataInstance();
  const soldAssetIdString = soldAssetId.toString();
  const boughtAssetIdString = boughtAssetId.toString();

  await expect(
    mangata
      .sellAsset(
        user.keyRingPair,
        soldAssetIdString,
        boughtAssetIdString,
        amount,
        new BN(0)
      )
      .catch((reason) => {
        exception = true;
        throw new Error(reason.data);
      })
  ).rejects.toThrow(reason);

  expect(exception).toBeTruthy();
}

beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }
  keyring = new Keyring({ type: "sr25519" });

  // setup users
  sudo = new User(keyring, sudoUserName);

  firstCurrency = await Assets.issueAssetToUser(
    sudo,
    defaultCurrencyValue,
    sudo
  );
});

beforeEach(async () => {
  api = getApi();

  await setupApi();

  [testUser1] = setupUsers();

  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(firstCurrency, testUser1, defaultCurrencyValue),
    Assets.mintNative(sudo),
    Sudo.sudoAs(
      sudo,
      Xyk.createPool(
        MGA_ASSET_ID,
        defaultPoolVolumeValue,
        firstCurrency,
        defaultPoolVolumeValue
      )
    )
  );

  feeLockMetadata = JSON.parse(
    JSON.stringify(await api.query.feeLock.feeLockMetadata())
  );

  periodLength = feeLockMetadata.periodLength;
  feeLockAmount = feeLockMetadata.feeLockAmount;

  if (periodLength > 20) {
    await updateFeeLockMetadata(
      sudo,
      new BN(10),
      new BN(feeLockAmount),
      null,
      null
    );

    feeLockMetadata = JSON.parse(
      JSON.stringify(await api.query.feeLock.feeLockMetadata())
    );

    periodLength = feeLockMetadata.periodLength;
  }
});

test("gassless- GIVEN a feeLock configured (only Time and Amount ) WHEN the user swaps AND the user has not enough MGAs and has enough TURs THEN the extrinsic fails on submission", async () => {
  await clearMgaFromWhitelisted(api, thresholdValue, sudo);

  await Sudo.batchAsSudoFinalized(
    Assets.mintNative(testUser1, new BN(2)),
    Assets.mintToken(TUR_ASSET_ID, testUser1)
  );

  await checkErrorSellAsset(
    testUser1,
    firstCurrency,
    MGA_ASSET_ID,
    feeLockErrors.FeeLockingFail
  );
});

test("gassless- GIVEN a feeLock configured (only Time and Amount )  WHEN the user swaps AND the user does not have enough MGAs THEN the extrinsic fails on submission", async () => {
  await clearMgaFromWhitelisted(api, thresholdValue, sudo);

  await testUser1.addMGATokens(sudo, new BN(2));

  await checkErrorSellAsset(
    testUser1,
    firstCurrency,
    MGA_ASSET_ID,
    feeLockErrors.FeeLockingFail
  );
});

test("gassless- Given a feeLock correctly configured (only Time and Amount ) WHEN the user swaps AND the user has enough MGAs THEN the extrinsic is correctly submitted", async () => {
  await clearMgaFromWhitelisted(api, thresholdValue, sudo);

  await testUser1.addMGATokens(sudo);
  testUser1.addAsset(MGA_ASSET_ID);
  testUser1.addAsset(firstCurrency);

  const sellAssetsValue = thresholdValue.add(new BN(5));

  await testUser1.refreshAmounts(AssetWallet.BEFORE);
  await testUser1.sellAssets(MGA_ASSET_ID, firstCurrency, sellAssetsValue);
  await testUser1.refreshAmounts(AssetWallet.AFTER);

  const firstCurrencyDeposit = testUser1
    .getAsset(firstCurrency)
    ?.amountAfter.free!.sub(
      testUser1.getAsset(firstCurrency)?.amountBefore.free!
    );

  const tokenFees = testUser1
    .getAsset(MGA_ASSET_ID)
    ?.amountAfter.reserved!.sub(
      testUser1.getAsset(MGA_ASSET_ID)?.amountBefore.reserved!
    );

  const userMgaFees = testUser1
    .getAsset(MGA_ASSET_ID)
    ?.amountAfter.free!.sub(
      testUser1.getAsset(MGA_ASSET_ID)?.amountBefore.free!
    )
    .add(new BN(sellAssetsValue));

  expect(firstCurrencyDeposit).bnGt(new BN(0));
  expect(tokenFees).bnEqual(new BN(0));
  expect(userMgaFees).bnEqual(new BN(0));
});

test("gassless- GIVEN a feeLock configured WHEN a swap happens THEN fees are not charged but locked instead", async () => {
  await addMgaToWhitelisted(api, thresholdValue, sudo);

  await testUser1.addMGATokens(sudo);
  testUser1.addAsset(MGA_ASSET_ID);

  const sellAssetsValue = thresholdValue.sub(new BN(5));

  await testUser1.refreshAmounts(AssetWallet.BEFORE);
  await testUser1.sellAssets(MGA_ASSET_ID, firstCurrency, sellAssetsValue);
  await testUser1.refreshAmounts(AssetWallet.AFTER);

  const tokenFees = testUser1
    .getAsset(MGA_ASSET_ID)
    ?.amountAfter.reserved!.sub(
      testUser1.getAsset(MGA_ASSET_ID)?.amountBefore.reserved!
    );

  const userMgaFees = testUser1
    .getAsset(MGA_ASSET_ID)
    ?.amountAfter.free!.sub(
      testUser1.getAsset(MGA_ASSET_ID)?.amountBefore.free!
    )
    .add(new BN(feeLockAmount))
    .add(new BN(sellAssetsValue));

  expect(tokenFees).bnEqual(new BN(feeLockAmount));
  expect(userMgaFees).bnEqual(new BN(0));
});

test("gassless- GIVEN a correct config for gassless swaps WHEN the user runs unlock-fee THEN fees are not charged for token unlockFee", async () => {
  await addMgaToWhitelisted(api, thresholdValue, sudo);

  await testUser1.addMGATokens(sudo);
  testUser1.addAsset(MGA_ASSET_ID);

  const sellAssetsValue = thresholdValue.sub(new BN(5));

  await testUser1.refreshAmounts(AssetWallet.BEFORE);
  await testUser1.sellAssets(MGA_ASSET_ID, firstCurrency, sellAssetsValue);
  await waitForNBlocks(periodLength);
  await unlockFee(testUser1);
  await testUser1.refreshAmounts(AssetWallet.AFTER);

  const tokenBlocked = testUser1.getAsset(MGA_ASSET_ID)?.amountAfter.reserved!;

  const userMgaFees = testUser1
    .getAsset(MGA_ASSET_ID)
    ?.amountAfter.free!.sub(
      testUser1.getAsset(MGA_ASSET_ID)?.amountBefore.free!
    )
    .add(new BN(sellAssetsValue));

  expect(tokenBlocked).bnEqual(new BN(0));
  expect(userMgaFees).bnEqual(new BN(0));
});

test("gassless- High-value swaps are rejected from the txn pool if they would fail before the percentage fee is charged", async () => {
  await addMgaToWhitelisted(api, thresholdValue, sudo);

  await testUser1.addMGATokens(sudo);

  await checkErrorSellAsset(
    testUser1,
    MGA_ASSET_ID,
    firstCurrency,
    feeLockErrors.SwapApprovalFail,
    toBN("1", 26)
  );
});

test("gassless- For low-value swaps, token reservation status and pallet storage are altered in accordance with the timeout mechanism", async () => {
  const api = getApi();

  async function checkAccountFeeLockData(
    totalAmountValue: any,
    lastBlockValue: any
  ) {
    const accountFeeLockData = JSON.parse(
      JSON.stringify(
        await api.query.feeLock.accountFeeLockData(
          testUser1.keyRingPair.address
        )
      )
    );
    expect(new BN(accountFeeLockData.totalFeeLockAmount)).bnEqual(
      new BN(totalAmountValue)
    );
    expect(new BN(accountFeeLockData.lastFeeLockBlock)).bnEqual(
      new BN(lastBlockValue)
    );
  }

  await addMgaToWhitelisted(api, thresholdValue, sudo);

  await testUser1.addMGATokens(sudo);
  testUser1.addAsset(MGA_ASSET_ID);
  await checkAccountFeeLockData(0, 0);

  const sellAssetsValue = thresholdValue.sub(new BN(5));
  await testUser1.sellAssets(MGA_ASSET_ID, firstCurrency, sellAssetsValue);
  const lockDataBlockNumber = await getBlockNumber();
  await waitForNBlocks(periodLength);
  await checkAccountFeeLockData(feeLockAmount, lockDataBlockNumber);

  await unlockFee(testUser1);
  await checkAccountFeeLockData(0, 0);
});

test("gassless- High-value swaps when successful are not charged txn fee or token timedout, but the percentage fee is charged", async () => {
  const secondCurrency = await Assets.issueAssetToUser(
    sudo,
    defaultCurrencyValue,
    sudo
  );

  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(secondCurrency, sudo, defaultCurrencyValue),
    Assets.mintToken(secondCurrency, testUser1, defaultCurrencyValue),
    Assets.mintNative(testUser1),
    Sudo.sudoAs(
      sudo,
      Xyk.createPool(
        firstCurrency,
        defaultPoolVolumeValue,
        secondCurrency,
        defaultPoolVolumeValue
      )
    )
  );

  testUser1.addAsset(MGA_ASSET_ID);
  testUser1.addAsset(firstCurrency);
  testUser1.addAsset(secondCurrency);

  const updateMgaTimeoutMetadata = await updateFeeLockMetadata(
    sudo,
    new BN(periodLength),
    new BN(feeLockAmount),
    thresholdValue,
    [
      [MGA_ASSET_ID, true],
      [firstCurrency, true],
    ]
  );
  await waitSudoOperataionSuccess(updateMgaTimeoutMetadata);

  const sellAssetsValue = thresholdValue.add(new BN(5));

  await testUser1.refreshAmounts(AssetWallet.BEFORE);
  await testUser1.sellAssets(firstCurrency, secondCurrency, sellAssetsValue);
  await testUser1.refreshAmounts(AssetWallet.AFTER);

  const userMgaFees = testUser1
    .getAsset(MGA_ASSET_ID)
    ?.amountAfter.free!.sub(
      testUser1.getAsset(MGA_ASSET_ID)?.amountBefore.free!
    );

  expect(userMgaFees).bnEqual(new BN(0));
});
