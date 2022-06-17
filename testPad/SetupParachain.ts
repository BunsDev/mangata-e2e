//howTorun: ts-node SetupParachain.ts
import { Keyring } from "@polkadot/api";
import { BN } from "@polkadot/util";
import { waitNewBlock } from "../utils/eventListeners";
import { User, AssetWallet } from "../utils/User";
import fs from "fs";
import { signTx } from "@mangata-finance/sdk";
import { testLog } from "../utils/Logger";
import { ApiPromise, WsProvider } from "@polkadot/api";
import { getApi, initApi } from "../utils/api";
require("dotenv").config();

process.env.NODE_ENV = "test";
const user = "//Alice";
const sudoUserName = "//Maciatko";
//TODO: Add path to the node to get the genenis generated by previous step!
const pathToFiles = "/home/goncer/runner/mangata-node/";

let testUser1: User, sudo, keyring;
const uri = "ws://127.0.0.1:9944";
async function main() {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }
  const wsProvider = new WsProvider(uri);
  const api = await ApiPromise.create({
    provider: wsProvider,
  });
  const paraId = 2000;
  keyring = new Keyring({ type: "sr25519" });
  sudo = new User(keyring, sudoUserName);
  testUser1 = new User(keyring, user);
  await fs.writeFileSync(
    testUser1.keyRingPair.address + ".json",
    JSON.stringify(testUser1.keyRingPair.toJson("mangata123"))
  );
  await fs.writeFileSync(
    sudo.keyRingPair.address + ".json",
    JSON.stringify(sudo.keyRingPair.toJson("mangata123"))
  );
  // add users to pair.
  keyring.addPair(testUser1.keyRingPair);
  keyring.addPair(sudo.keyRingPair);
  await testUser1.refreshAmounts(AssetWallet.BEFORE);

  try {
    await signTx(api, api.tx.registrar.reserve(), testUser1.keyRingPair);
  } catch (error) {}
  await waitNewBlock();
  const genesis = fs
    .readFileSync(pathToFiles + "para-2000-genesis_mangata_dev_v4")
    .toString();
  const wasm = fs
    .readFileSync(pathToFiles + "para-2000-wasm_mangata_dev_v4")
    .toString();

  const scheduleParaInit = api.tx.parasSudoWrapper.sudoScheduleParaInitialize(
    new BN(paraId),
    {
      genesisHead: genesis,
      validationCode: wasm,
      parachain: true,
    }
  );
  await api.tx.sudo.sudo(scheduleParaInit).signAndSend(testUser1.keyRingPair);
  await waitNewBlock();
}

main()
  .catch((error) => {
    testLog.getLog().error(error);
    process.exit(-1);
  })
  .then(() => {
    testLog
      .getLog()
      .info(
        "Setup complete! wait ~ 2mins! \n " +
          `https://polkadot.js.org/apps/?rpc=${uri}#/extrinsics`
      );
  });
