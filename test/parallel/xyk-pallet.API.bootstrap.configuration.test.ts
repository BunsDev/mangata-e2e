/*
 *
 * @group bootstrap
 * @group parallel
 */
import { getApi, initApi } from "../../utils/api";
import {
  scheduleBootstrap,
  provisionBootstrap,
  claimRewardsBootstrap,
  finalizeBootstrap,
} from "../../utils/tx";
import { EventResult, ExtrinsicResult } from "../../utils/eventListeners";
import { BN } from "@polkadot/util";
import { Keyring } from "@polkadot/api";
import { User } from "../../utils/User";
import { getEnvironmentRequiredVars, waitForNBlocks } from "../../utils/utils";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { toBN } from "@mangata-finance/sdk";
import { Assets } from "../../utils/Assets";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.spyOn(console, "error").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";

let testUser1: User;
let sudo: User;
let keyring: Keyring;
let bootstrapPhase: any;
let bootstrapCurrency: any;
let bootstrapPool: any;
let eventResponse: EventResult;

const { sudo: sudoUserName } = getEnvironmentRequiredVars();
const waitingPeriod = 20;
const bootstrapPeriod = 40;

beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }

  keyring = new Keyring({ type: "sr25519" });

  // setup users
  sudo = new User(keyring, sudoUserName);
  testUser1 = new User(keyring);

  // add users to pair.
  keyring.addPair(sudo.keyRingPair);
  keyring.addPair(testUser1.keyRingPair);

  bootstrapCurrency = await Assets.issueAssetToUser(sudo, toBN("1", 20), sudo);

  //add MGA tokens for users.
  await sudo.addMGATokens(sudo);
  await testUser1.addMGATokens(sudo);

  const api = getApi();

  bootstrapPhase = await api.query.bootstrap.phase();
  if (bootstrapPhase.toString() === "BeforeStart") {
  } else {
    // eslint-disable-next-line jest/no-jasmine-globals
    fail("system is not ready for the bootstrap");
  }
});

test("xyk-pallet - Check non-sudo user cannot start bootstrap", async () => {
  // check that non-sudo user can not start bootstrap
  await sudo.mint(bootstrapCurrency, testUser1, toBN("1", 20));
  const nonSudoBootstrap = await scheduleBootstrap(
    testUser1,
    MGA_ASSET_ID,
    bootstrapCurrency,
    waitingPeriod,
    bootstrapPeriod
  );
  eventResponse = getEventResultFromMangataTx(nonSudoBootstrap);
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
  expect(eventResponse.data).toContain("RequireSudo");
});

test("xyk-pallet - Check happy path", async () => {
  // check that sudo user can start bootstrap
  await sudo.mint(bootstrapCurrency, testUser1, toBN("1", 20));
  const sudoBootstrap = await scheduleBootstrap(
    sudo,
    MGA_ASSET_ID,
    bootstrapCurrency,
    waitingPeriod,
    bootstrapPeriod
  );
  eventResponse = getEventResultFromMangataTx(sudoBootstrap);
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

  // check that user can not make provision before bootstrap
  const api = getApi();

  bootstrapPhase = await api.query.bootstrap.phase();
  if (bootstrapPhase.toString() === "BeforeStart") {
    const provisionBeforeStart = await provisionBootstrap(
      testUser1,
      bootstrapCurrency
    );
    eventResponse = getEventResultFromMangataTx(provisionBeforeStart);
    // eslint-disable-next-line jest/no-conditional-expect
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    // eslint-disable-next-line jest/no-conditional-expect
    expect(eventResponse.data).toContain("Unauthorized");
  } else {
    // eslint-disable-next-line jest/no-jasmine-globals
    fail("bootstrap should be in the phase BeforeStart");
  }

  await waitForNBlocks(waitingPeriod);

  // check that user can make provision while bootstrap running
  bootstrapPhase = await api.query.bootstrap.phase();
  if (bootstrapPhase.toString() === "Public") {
    // new token must participate in provision as first
    const provisionPublicBootstrapCurrency = await provisionBootstrap(
      testUser1,
      bootstrapCurrency
    );
    eventResponse = getEventResultFromMangataTx(
      provisionPublicBootstrapCurrency
    );
    // eslint-disable-next-line jest/no-conditional-expect
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

    // we need to add MGA token in the provision for creating a pool
    const provisionPublicMGA = await provisionBootstrap(
      testUser1,
      MGA_ASSET_ID
    );
    eventResponse = getEventResultFromMangataTx(provisionPublicMGA);
    // eslint-disable-next-line jest/no-conditional-expect
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  } else {
    // eslint-disable-next-line jest/no-jasmine-globals
    fail("bootstrap should be in the phase Public");
  }

  await waitForNBlocks(bootstrapPeriod);

  // check that user can not make provision after bootstrap
  bootstrapPhase = await api.query.bootstrap.phase();
  if (bootstrapPhase.toString() === "Finished") {
    const provisionFinished = await provisionBootstrap(
      testUser1,
      bootstrapCurrency
    );
    eventResponse = getEventResultFromMangataTx(provisionFinished);
    // eslint-disable-next-line jest/no-conditional-expect
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    // eslint-disable-next-line jest/no-conditional-expect
    expect(eventResponse.data).toContain("Unauthorized");
  } else {
    // eslint-disable-next-line jest/no-jasmine-globals
    fail("bootstrap should be in the phase Finished");
  }

  // Check existing pool
  bootstrapPool = await api.query.xyk.pools([MGA_ASSET_ID, bootstrapCurrency]);
  expect(bootstrapPool[0]).bnGt(new BN(0));
  expect(bootstrapPool[1]).bnGt(new BN(0));

  // need claim liquidity token before finalizing
  const claimRewards = await claimRewardsBootstrap(testUser1);
  eventResponse = getEventResultFromMangataTx(claimRewards);
  // eslint-disable-next-line jest/no-conditional-expect
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

  // finalaze bootstrap
  const bootstrapFinalize = await finalizeBootstrap(sudo);
  eventResponse = getEventResultFromMangataTx(bootstrapFinalize);
  // eslint-disable-next-line jest/no-conditional-expect
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

  bootstrapPhase = await api.query.bootstrap.phase();
  if (bootstrapPhase.toString() === "BeforeStart") {
  } else {
    // eslint-disable-next-line jest/no-jasmine-globals
    fail("system should be ready for the next bootstrap");
  }
});
