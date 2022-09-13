/* eslint-disable no-console */
import BN from "bn.js";
import fs from "fs";
import { testLog } from "../utils/Logger";
import { getMangataInstance } from "../utils/api";

async function main() {
  const users = [
    "5FLSigC9HGRKVhB9FiEo4Y3koPsNmBmLJbpXg2mp1hXcS59Y",
    "5DAAnrj7VHTznn2AWBemMuyBwZWs6FNFjdyVXUeYum3PTXFy",
    "5HGjWAeFDfFCWPsjFQdVV2Msvz2XtMktvgocEZcCj68kUMaw",
    "5CiPPseXPECbkjWCa6MnjNokrgYjMqmKndv2rSnekmSK2DjL",
  ];
  const liq = process.env.liq ? process.env.liq : 8;
  const liqId = new BN(liq);
  const mangata = await getMangataInstance("ws://127.0.0.1:8844");
  // const provider = new WsProvider("ws://127.0.0.1:8844");
  //const api = await new ApiPromise(options({ provider })).isReady;
  const api = await mangata.getApi();
  api.query.issuance.promotedPoolsRewardsV2(liqId).then((value) => {
    console.log(`${JSON.stringify(value.toHuman())}`);
  });
  await api.rpc.chain.subscribeNewHeads((header) => {
    users.forEach((user) => {
      api.query.xyk.rewardsInfo(user, liqId).then((value) => {
        console.log(`RW_info: ${JSON.stringify(value.toHuman())}}`);
      });
    });
    users.forEach((user) => {
      mangata
        .calculateRewardsAmountV2(user, liqId.toString())
        .then((result: any) => {
          if (result.toString() === "0")
            console.log("foo: " + liq + "-" + JSON.stringify(result));
          if (result.toString() !== "0") {
            const str = `${user}:${header.number}:${(
              result as any
            ).toString()}`;

            const plott = `${header.number},${(result as any).toString()} \n`;

            fs.appendFile(
              `/home/goncer/projects/mangata-e2e/${liqId}_${user}.txt`,
              plott,
              function (err) {
                if (err) throw err;
              }
            );
            console.log(str);
          }
        });
    });
  });
  //await api.disconnect();
}

main().catch((error) => {
  testLog.getLog().error(error);
  process.exit(-1);
});
