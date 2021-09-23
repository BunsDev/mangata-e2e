import { Keyring } from "@polkadot/api";
import { KeyringPair } from "@polkadot/keyring/types";
import BN from "bn.js";
import { v4 as uuid } from "uuid";
import { ExtrinsicResult, waitNewBlock } from "./eventListeners";
import { testLog } from "./Logger";
import {
  balanceTransfer,
  buyAsset,
  createPool,
  getAccountInfo,
  getAllAssets,
  getUserAssets,
  mintAsset,
  mintLiquidity,
  sellAsset,
  transferAll,
} from "./tx";
import { getEventResultFromTxWait } from "./txHandler";
import { MAX_BALANCE, MGA_ASSET_ID } from "./Constants";

export enum AssetWallet {
  BEFORE,
  AFTER,
}

export class User {
  /**
   * class that represent the user and wallet.
   */
  keyRingPair: KeyringPair;
  name: String;
  keyring: Keyring;
  assets: Asset[];

  constructor(keyring: Keyring, name = "", json: any = undefined) {
    let autoGenerated = false;
    if (!name) {
      name = "//testUser_" + uuid();
      autoGenerated = true;
    }
    this.name = name;
    this.keyring = keyring;
    if (json) {
      this.keyRingPair = keyring.createFromJson(json);
    } else {
      this.keyRingPair = keyring.createFromUri(name);
    }
    this.assets = [];
    if (autoGenerated)
      testLog
        .getLog()
        .info(`name: ${this.name}, address: ${this.keyRingPair.address}`);
  }

  addFromMnemonic(keyring: Keyring, mnemonic: string) {
    this.keyRingPair = keyring.addFromMnemonic(mnemonic);
    this.name = "mnemonic_created_account";
  }

  addFromAddress(keyring: Keyring, address: string) {
    this.keyRingPair = keyring.addFromAddress(address);
    this.name = "addres_created_account";
  }

  addAsset(currecncyId: any, amountBefore = new BN(0)) {
    const asset = new Asset(currecncyId, amountBefore);
    if (
      this.assets.find((asset) => asset.currencyId === currecncyId) ===
      undefined
    ) {
      this.assets.push(asset);
    }
  }
  addAssets(currencyIds: any[]) {
    currencyIds.forEach((element) => {
      this.addAsset(element);
    });
  }
  getAsset(currecncyId: any) {
    return this.assets.find((asset) => asset.currencyId === currecncyId);
  }
  async refreshAmounts(beforeOrAfter: AssetWallet = AssetWallet.BEFORE) {
    const currencies = this.assets.map((asset) => new BN(asset.currencyId));
    const assetValues = await getUserAssets(
      this.keyRingPair.address,
      currencies
    );

    for (let index = 0; index < this.assets.length; index++) {
      if (beforeOrAfter === AssetWallet.BEFORE)
        this.assets[index].amountBefore = assetValues[index];
      else this.assets[index].amountAfter = assetValues[index];
    }
  }

  async buyAssets(
    soldAssetId: BN,
    boughtAssetId: BN,
    amount: BN,
    maxExpected = new BN(1000000)
  ) {
    await buyAsset(
      this.keyRingPair,
      soldAssetId,
      boughtAssetId,
      amount,
      maxExpected
    ).then((result) => {
      const eventResponse = getEventResultFromTxWait(result, [
        "xyk",
        "AssetsSwapped",
        this.keyRingPair.address,
      ]);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });
  }

  async mint(assetId: BN, user: User, amount: BN) {
    await waitNewBlock();

    await mintAsset(
      this.keyRingPair,
      assetId,
      user.keyRingPair.address,
      amount
    ).then((result) => {
      const eventResponse = getEventResultFromTxWait(result, [
        "tokens",
        "Minted",
        user.keyRingPair.address,
      ]);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });
    await waitNewBlock();
  }

  async sellAssets(soldAssetId: BN, boughtAssetId: BN, amount: BN) {
    await sellAsset(
      this.keyRingPair,
      soldAssetId,
      boughtAssetId,
      amount,
      new BN(0)
    ).then((result) => {
      const eventResponse = getEventResultFromTxWait(result, [
        "xyk",
        "AssetsSwapped",
        this.keyRingPair.address,
      ]);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });
    await waitNewBlock();
  }
  async mintLiquidity(
    firstCurrency: BN,
    secondCurrency: BN,
    firstCurrencyAmount: BN,
    secondCurrencyAmount: BN = new BN(MAX_BALANCE)
  ) {
    await mintLiquidity(
      this.keyRingPair,
      firstCurrency,
      secondCurrency,
      firstCurrencyAmount,
      secondCurrencyAmount
    ).then((result) => {
      const eventResponse = getEventResultFromTxWait(result, [
        "xyk",
        "LiquidityMinted",
        this.keyRingPair.address,
      ]);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });
    await waitNewBlock();
  }

  async removeTokens() {
    //TODO: find a proper way to clean all the user tokens in one shot!
    const assets = await getAllAssets(this.keyRingPair.address);
    for (let index = 0; index < assets.length; index++) {
      const assetId = assets[index];
      await transferAll(
        this.keyRingPair,
        assetId,
        process.env.E2E_XYK_PALLET_ADDRESS
      );
    }
  }
  async createPoolToAsset(
    first_asset_amount: BN,
    second_asset_amount: BN,
    firstCurrency: BN,
    secondCurrency: BN
  ) {
    await createPool(
      this.keyRingPair,
      firstCurrency,
      first_asset_amount,
      secondCurrency,
      second_asset_amount
    ).then((result) => {
      const eventResponse = getEventResultFromTxWait(result, [
        "xyk",
        "PoolCreated",
        this.keyRingPair.address,
      ]);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });
    await waitNewBlock();
  }

  async addBalance(
    user: string = "//Alice",
    amount: number = Math.pow(10, 11)
  ) {
    await balanceTransfer(
      new User(this.keyring, user).keyRingPair,
      this.keyRingPair.address,
      amount
    ).then((result) => {
      const eventResponse = getEventResultFromTxWait(result, [
        "balances",
        "Transfer",
        this.keyRingPair.address,
      ]);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });

    await this.waitUntilBalanceIsNotZero();
  }

  async addMGATokens(
    sudo: User,
    amountFree: BN = new BN(Math.pow(10, 11).toString())
  ) {
    await sudo.mint(MGA_ASSET_ID, this, amountFree);
  }
  async getUserAccountInfo() {
    const accountInfo = await getAccountInfo(this.keyRingPair.address);
    return accountInfo;
  }
  async waitUntilBalanceIsNotZero() {
    let amount = "0";
    do {
      await waitNewBlock();
      const accountData = await this.getUserAccountInfo();
      amount = accountData.free;
    } while (amount === "0");
  }
}

export class Asset {
  amountBefore: BN;
  amountAfter: BN;
  currencyId: BN;

  constructor(
    currencyId: BN,
    amountBefore = new BN(0),
    amountAfter = new BN(0)
  ) {
    this.currencyId = currencyId;
    this.amountBefore = amountBefore;
    this.amountAfter = amountAfter;
  }
}
