//howTorun.
//set the account.Json ( can be exported from PolkadotJs ) on this folder and name it with AccountAddress.json.
// for example, if you want to use the user with <address>, export the json with <address>.json ( password Mangata123 )
import { Keyring } from "@polkadot/api";
import BN from "bn.js";
import { waitNewBlock } from "../utils/eventListeners";
import { AssetWallet, User } from "../utils/User";
import fs from "fs";
import { testLog } from "../utils/Logger";
import { api, getApi, initApi } from "../utils/api";
import { signSendAndWaitToFinishTx } from "../utils/txHandler";
import { signTx } from "mangata-sdk";
import { MGA_ASSET_ID } from "../utils/Constants";
require("dotenv").config();

process.env.NODE_ENV = "test";
const sudoUserName = "//Maciatko";
//TODO: Add path to the node to get the genenis generated by previous step!

let sudo, keyring;
const uri = "ws://127.0.0.1:8844";

async function addUserAsCandidate(address: string) {
  keyring = new Keyring({ type: "sr25519" });

  const json = fs.readFileSync(address + ".json", {
    encoding: "utf8",
    flag: "r",
  });

  const testUser1 = new User(keyring, "aasd", JSON.parse(json));
  const user = testUser1;
  //    const pk = u8aToHex(user.keyRingPair.publicKey);
  //    const stringPk = pk.toString();
  keyring.addPair(user.keyRingPair);
  keyring.pairs[0].decodePkcs8("mangata123");
  sudo = new User(keyring, sudoUserName);
  keyring.addPair(sudo.keyRingPair);
  await testUser1.refreshAmounts(AssetWallet.BEFORE);

  const { nonce } = JSON.parse(
    JSON.stringify(await api!.query.system.account(sudo.keyRingPair.address))
  );
  await signTx(
    api!,
    api!.tx.sudo.sudo(
      api!.tx.tokens.mint(
        MGA_ASSET_ID,
        testUser1.keyRingPair.address,
        new BN("1000000000000")
      )
    )!,
    sudo.keyRingPair,
    { nonce: new BN(nonce) }
  );
  const nonce2 = JSON.parse(
    JSON.stringify(
      await await api!.query.system.account(sudo.keyRingPair.address)
    )
  ).nonce;
  await signTx(
    api!,
    api!.tx.sudo.sudo(
      api!.tx.tokens.mint(
        new BN(3),
        testUser1.keyRingPair.address,
        new BN("10000000000000000000")
      )
    ),
    sudo.keyRingPair,
    { nonce: new BN(nonce2) }
  );

  await waitNewBlock();
  await signSendAndWaitToFinishTx(
    api?.tx.parachainStaking.joinCandidates(
      new BN("10000000000000000000"),
      new BN(3),
      // @ts-ignore - Mangata bond operation has 4 params, somehow is inheriting the bond operation from polkadot :S
      new BN(3)
    ),
    testUser1.keyRingPair
  );
  await waitNewBlock();
  testLog.getLog().warn("done");
}
async function setKeys(address: string, keyString: string) {
  keyring = new Keyring({ type: "sr25519" });

  const json = fs.readFileSync(address + ".json", {
    encoding: "utf8",
    flag: "r",
  });
  const user = new User(keyring, "aasd", JSON.parse(json));
  //const pk = u8aToHex(user.keyRingPair.publicKey);

  keyring.addPair(user.keyRingPair);
  keyring.pairs[0].decodePkcs8("mangata123");

  await signSendAndWaitToFinishTx(
    api?.tx.session.setKeys(keyString, "0x00"),
    user.keyRingPair,
    false
  );
  await waitNewBlock();
  testLog.getLog().warn("done");
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const commandArguments = args.slice(1);
  try {
    getApi();
  } catch (e) {
    await initApi(uri);
  }
  //ts-node AttachNodeToParachain.ts candidate 5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY
  if (command.includes("candidate")) {
    testLog.getLog().info("add candidate to " + commandArguments);
    await addUserAsCandidate(commandArguments[0]);
  }
  //ts-node AttachNodeToParachain.ts setKeys 5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY "0x14e27b6f63c2bda95660f4f9e4b9bc44c264ff53974ec30d6e70212863774900aa7d4cb1c033c94c5e43a11663dd135312ac952390d44daf06d33db80ed17e21a673135fdcd8ef78760921a67e94fc47be6c38fa5cd26ee6daa0c67ddad77d032ea8dff6ef2c247031055272e7c7e891670e104116948780dadb14d8ee7f2a0f76e05564c6033b0b38d5c2e216ae66bafd74e08f112cf9003e9286d5bdb36857649eefa3b0c07abc361e89f7a7ca4d429cdc23710cf0e2b2e3ba982ef1ff8b5a02aec943eb0c864f62ba890fe16d4267b1c34c4dd374b3d81757364bf2c5b6aef0"
  if (command.includes("setKeys")) {
    testLog.getLog().info("setKeys to " + commandArguments);
    await setKeys(commandArguments[0], commandArguments[1]);
  }
}

main()
  .catch((error) => {
    testLog.getLog().error(error);
    process.exit(-1);
  })
  .then(() => {
    testLog.getLog().info("Done -> run Crl+C for api disconnect");
  });