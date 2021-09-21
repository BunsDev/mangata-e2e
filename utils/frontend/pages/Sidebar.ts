import { WithdrawModal } from "./WithdrawModal";
import { By, until, WebDriver } from "selenium-webdriver";
import { FIVE_MIN } from "../../Constants";
import { sleep } from "../../utils";
import {
  buildDataTestIdXpath,
  clickElement,
  getText,
  waitForElement,
  waitForElementToDissapear,
} from "../utils/Helper";
import { DepositModal } from "./DepositModal";

const DIV_META_NOT_FOUND = "extensionMetamask-extensionNotFound";
const DIV_POLK_NOT_FOUND = "extensionPolkadot-extensionNotFound";
const BTN_INSTALL_META = "extensionMetamask-extensionNotFound-installBtn";
const BTN_INSTALL_POLK = "extensionPolkadot-extensionNotFound-installBtn";

const DOT_META_OK = "connect-metamaskGreenDot";
const BTN_META_DEPOSIT = "bridge-showDepositModalBtn";
const BTN_META_WITHDRAW = "bridge-showWithdrawModalBtn";

const DOT_POLK_OK = "connect-polkadotGreenDot";
const DIV_FAUCET_READY = "faucet-isReady-header";
const LBL_TOKEN_AMOUNT = "wallet-tokensAmount";

const SPINNER_LOADING = `//*[@class = 'Sidebar__loading']`;
const BTN_POOL_OVERVIEW = `poolsOverview-item-tkn1-tkn2`;
const BTN_REMOVE_LIQUIDITY = `poolDetail-removeBtn`;
const LBL_TOKEN_NAME = "wallet-asset-tokenName";
const DIV_ASSETS_ITEM_VALUE = `//div[@class = 'AssetBox' and //*[text()='tokenName']]/span[@class='value']`;

export class Sidebar {
  driver: WebDriver;

  constructor(driver: WebDriver) {
    this.driver = driver;
  }

  async isConnectMetamaskVisible() {
    throw new Error("Method not implemented.");
  }
  async isPolkadotExtensionOK() {
    return await this.areVisible([
      DOT_POLK_OK,
      LBL_TOKEN_AMOUNT,
      DIV_FAUCET_READY,
    ]);
  }

  async isMetamaskExtensionOK() {
    return await this.areVisible([
      DOT_META_OK,
      BTN_META_DEPOSIT,
      BTN_META_WITHDRAW,
    ]);
  }

  async isMetamaskExtensionNotFoundDisplayed() {
    const notInstalledXpath = buildDataTestIdXpath(DIV_META_NOT_FOUND);
    const displayed = await this.isDisplayed(notInstalledXpath);
    return displayed;
  }
  async isPolkExtensionNotFoundDisplayed() {
    const notInstalledXpath = buildDataTestIdXpath(DIV_POLK_NOT_FOUND);
    const displayed = await this.isDisplayed(notInstalledXpath);
    return displayed;
  }

  async isMetamaskInstallBtnDisplayed() {
    const notInstalledXpath = buildDataTestIdXpath(BTN_INSTALL_META);
    const displayed = await this.isDisplayed(notInstalledXpath);
    return displayed;
  }
  async isPolkInstallBtnDisplayed() {
    const notInstalledXpath = buildDataTestIdXpath(BTN_INSTALL_POLK);
    const displayed = await this.isDisplayed(notInstalledXpath);
    return displayed;
  }

  async waitForLoad() {
    return new Promise<void>(async (resolve, reject) => {
      setTimeout(() => {
        reject("TIMEOUT: Waiting for " + SPINNER_LOADING + " to dissapear");
      }, 20000);
      await waitForElementToDissapear(this.driver, SPINNER_LOADING);
      resolve();
    });
  }

  async withdrawAllAssetsToMetaMask(tokenName: string) {
    await this.clickOnWithdrawToEth();
    const withdrawModal = new WithdrawModal(this.driver);
    await withdrawModal.selectToken(tokenName);
    await withdrawModal.selectMax();
    await withdrawModal.clickContinue();
    await withdrawModal.confirmAndSign();
  }
  async clickOnDepositToMangata() {
    const locator = buildDataTestIdXpath(BTN_META_DEPOSIT);
    await clickElement(this.driver, locator);
  }
  async clickOnWithdrawToEth() {
    const locator = buildDataTestIdXpath(BTN_META_WITHDRAW);
    await clickElement(this.driver, locator);
  }
  async waitForTokenToAppear(tokenName: string) {
    const xpath = buildDataTestIdXpath(
      this.buildTokenAvailableTestId(tokenName)
    );
    await waitForElement(this.driver, xpath, FIVE_MIN);
  }
  async getTokenAmount(tokenName: string) {
    await this.waitForTokenToAppear(tokenName);
    const tokenValueXpath = `//*[@data-testid='wallet-asset-${tokenName}']//span[@class='value']`;
    const value = await (
      await this.driver.findElement(By.xpath(tokenValueXpath))
    ).getText();
    return value;
  }
  private buildTokenAvailableTestId(asseName1: string) {
    return `wallet-asset-${asseName1}`;
  }

  private async isDisplayed(elementXpath: string) {
    try {
      await waitForElement(this.driver, elementXpath, 2000);
      const displayed = await (
        await this.driver.findElement(By.xpath(elementXpath))
      ).isDisplayed();
      return displayed;
    } catch (Error) {
      return false;
    }
  }
  private async areVisible(listDataTestIds: string[]) {
    const promises: Promise<Boolean>[] = [];
    listDataTestIds.forEach((dataTestId) => {
      promises.push(this.isDisplayed(buildDataTestIdXpath(dataTestId)));
    });
    const allVisible = await Promise.all(promises);
    return allVisible.every((elem) => elem === true);
  }
  async clickOnLiquidityPool(poolAsset1Name: string, poolAsset2Name: string) {
    let xpath = buildDataTestIdXpath(
      BTN_POOL_OVERVIEW.replace("tkn1", poolAsset1Name).replace(
        "tkn2",
        poolAsset2Name
      )
    );
    const displayed = await this.isDisplayed(xpath);
    if (!displayed) {
      //lets try in the other way around.
      xpath = buildDataTestIdXpath(
        BTN_POOL_OVERVIEW.replace("tkn1", poolAsset2Name).replace(
          "tkn2",
          poolAsset1Name
        )
      );
    }
    await clickElement(this.driver, xpath);
    await sleep(2000);
  }

  async clickOnRemoveLiquidity() {
    const xpath = buildDataTestIdXpath(BTN_REMOVE_LIQUIDITY);
    await clickElement(this.driver, xpath);
  }

  async waitUntilTokenAvailable(assetName: string, timeout = FIVE_MIN) {
    const xpath = buildDataTestIdXpath(
      LBL_TOKEN_NAME.replace("tokenName", assetName)
    );
    await this.driver.wait(until.elementLocated(By.xpath(xpath)), timeout);
  }
  async getAssetValue(assetName: string) {
    const xpath = DIV_ASSETS_ITEM_VALUE.replace("tokenName", assetName);
    await waitForElement(this.driver, xpath);
    const value = await (
      await this.driver.findElement(By.xpath(xpath))
    ).getText();
    return value;
  }
  private buildPoolDataTestId(asseName1: string, assetName2: string) {
    return `poolsOverview-item-${asseName1}-${assetName2}`;
  }
  async isLiquidityPoolVisible(asset1Name: string, asset2Name: string) {
    return await this.isDisplayed(
      buildDataTestIdXpath(this.buildPoolDataTestId(asset1Name, asset2Name))
    );
  }

  async getAssetValueInvested(assetName: string) {
    const LBL_TOKEN_AMOUNT_INVESTED = `//*[contains(@data-testid,'poolDetail') and span[text()='${assetName}']]`;
    const value = await getText(this.driver, LBL_TOKEN_AMOUNT_INVESTED);
    return value;
  }
  async depositAseetsFromMetamask(metaAssetName: string, amount: string) {
    await this.clickOnDepositToMangata();
    const modal = new DepositModal(this.driver);
    await modal.selectToken(metaAssetName);
    await modal.enterValue(amount);
    await modal.clickContinue();
    await modal.confirmAndSign();
  }
  async waitForTokenToDissapear(assetName: string, timeout = FIVE_MIN) {
    const xpath = buildDataTestIdXpath(
      LBL_TOKEN_NAME.replace("tokenName", assetName)
    );
    await waitForElementToDissapear(this.driver, xpath);
  }
}