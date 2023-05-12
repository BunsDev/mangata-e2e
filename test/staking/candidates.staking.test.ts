/*
 *
 * @group parallel
 */
import { getApi, initApi } from "../../utils/api";
import { User } from "../../utils/User";
import { expectMGAExtrinsicSuDidSuccess } from "../../utils/eventListeners";
import { BN, signTx } from "@mangata-finance/sdk";
import { setupUsers, setupApi } from "../../utils/setup";
import { Staking, tokenOriginEnum } from "../../utils/Staking";
import { Sudo } from "../../utils/sudo";
import { Assets } from "../../utils/Assets";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { testLog } from "../../utils/Logger";
import { getUserBalanceOfToken } from "../../utils/utils";
import { hexToBn } from "@polkadot/util";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(3500000);
process.env.NODE_ENV = "test";

let testUser1: User;
let testUser2: User;
let testUser3: User;
let minStk: BN;
beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }
  [testUser1] = setupUsers();
  await setupApi();
  minStk = new BN(
    (await getApi()).consts.parachainStaking.minCandidateStk.toString()
  );
  await Sudo.batchAsSudoFinalized(
    Assets.mintNative(testUser1, minStk.muln(1000)),
    Assets.mintNative(testUser2, minStk.muln(1000)),
    Assets.mintNative(testUser3, minStk.muln(1000))
  );
});

describe("Test candidates actions", () => {
  beforeEach(async () => {});
  it("A user can become a candidate by joining As candidate with 2x MGX", async () => {
    const extrinsic = await Staking.joinAsCandidate(
      minStk.muln(2),
      MGA_ASSET_ID,
      tokenOriginEnum.AvailableBalance
    );
    const events = await Sudo.asSudoFinalized(
      Sudo.sudoAs(testUser1, extrinsic)
    );
    const event = expectMGAExtrinsicSuDidSuccess(events);
    testLog.getLog().info(event);
    const isUserInCandidateList = await Staking.isUserInCandidateList(
      testUser1.keyRingPair.address
    );
    expect(isUserInCandidateList).toBeTruthy();

    const userBalance = await getUserBalanceOfToken(MGA_ASSET_ID, testUser1);
    const total = hexToBn(JSON.parse(userBalance).free).add(
      hexToBn(JSON.parse(userBalance).reserved)
    );
    expect(total).bnEqual(minStk.muln(1000));
    expect(userBalance.reserved).bnEqual(minStk.muln(2));
  });
  it("A candidate can choose an aggregator when the aggregator choose the candidate", async () => {
    const aggregator = testUser3;
    const extrinsic = await Staking.joinAsCandidate(
      minStk.muln(2),
      MGA_ASSET_ID,
      tokenOriginEnum.AvailableBalance
    );
    const events = await Sudo.asSudoFinalized(
      Sudo.sudoAs(testUser2, extrinsic)
    );
    const event = expectMGAExtrinsicSuDidSuccess(events);
    testLog.getLog().info(event);

    const aggregationExtrinsic = Staking.updateCandidateAggregator(aggregator);
    await signTx(await getApi(), aggregationExtrinsic, testUser2.keyRingPair);
    //TODO:
    //validate that error
    //aggregators select candidate
    //validate that updateCandidateAggregator now works.
  });
});
