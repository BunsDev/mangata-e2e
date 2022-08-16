/*
 *
 * @group ci
 */
import { getApi, initApi } from "../../utils/api";
import { getAllAssetsInfo } from "../../utils/tx";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";

beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }
});

test("xyk-CI - AssetInfo contains assets for MGA, mKSM, mBTC and mUSD", async () => {
  const assetsInfo = await getAllAssetsInfo();
  expect(assetsInfo).not.toBeUndefined();

  expect(
    assetsInfo.findIndex((asset) => asset.name === "Mangata")
  ).toBeGreaterThanOrEqual(0);
  expect(
    assetsInfo.findIndex((asset) => asset.symbol === "MGA")
  ).toBeGreaterThanOrEqual(0);

  expect(
    assetsInfo.findIndex((asset) => asset.name === "mKSM")
  ).toBeGreaterThanOrEqual(0);
  expect(
    assetsInfo.findIndex((asset) => asset.symbol === "mKSM")
  ).toBeGreaterThanOrEqual(0);

  expect(
    assetsInfo.findIndex((asset) => asset.name === "mBTC")
  ).toBeGreaterThanOrEqual(0);
  expect(
    assetsInfo.findIndex((asset) => asset.symbol === "mBTC")
  ).toBeGreaterThanOrEqual(0);

  expect(
    assetsInfo.findIndex((asset) => asset.name === "mUSD")
  ).toBeGreaterThanOrEqual(0);
  expect(
    assetsInfo.findIndex((asset) => asset.symbol === "mUSD")
  ).toBeGreaterThanOrEqual(0);
  
});
