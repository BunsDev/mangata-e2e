/*
 *
 * @group parallel
 */
import { getApi, initApi } from "../../utils/api";
import { BN } from "@polkadot/util";
import { User } from "../../utils/User";
import { setupApi, setupAPoolForUsers, Extrinsic } from "../../utils/setup";
import { BN_ONE, BN_HUNDRED } from "@mangata-finance/sdk";
import { BN_MILLION } from "@mangata-finance/sdk";
import { Xyk } from "../../utils/xyk";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);
const ERROR_MSG = "Tipping is not allowed for swaps and multiswaps";
let users: User[] = [];
let tokenIds: BN[] = [];
let swapOperations: { [K: string]: Extrinsic } = {};

describe("Tips - Tips are not allowed for swaps", () => {
  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
    await setupApi();
    ({ users, tokenIds } = await setupAPoolForUsers(users));
    swapOperations = {
      multiswapSellAsset: Xyk.multiswapSellAsset(tokenIds, BN_HUNDRED, BN_ONE),
      multiswapBuyAsset: Xyk.multiswapBuyAsset(
        tokenIds,
        BN_HUNDRED,
        BN_MILLION
      ),
      sellAsset: Xyk.sellAsset(tokenIds[0], tokenIds[1], BN_HUNDRED, BN_ONE),
      buyAsset: Xyk.buyAsset(tokenIds[0], tokenIds[1], BN_HUNDRED, BN_MILLION),
    };
  });
  it.each(["multiswapSellAsset", "multiswapBuyAsset", "sellAsset", "buyAsset"])(
    "%s tips operations are forbidden",
    async (operation) => {
      const extrinsic = swapOperations[operation];
      let exception = false;
      let exceptionData = "";
      await expect(
        extrinsic
          .signAndSend(users[0].keyRingPair, {
            tip: new BN(100001000),
          })
          .catch((reason) => {
            exception = true;
            exceptionData = reason.data;
            throw new Error(reason.data);
          })
      ).rejects.toThrow(ERROR_MSG);
      expect(exceptionData).toEqual(ERROR_MSG);
      expect(exception).toBeTruthy();
    }
  );
});
