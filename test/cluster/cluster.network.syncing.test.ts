/*
 * @group cluster
 *
 * eslint-disable no-loop-func
 * eslint-disable no-console
 */
import { intersection } from "lodash";
import { spawn, Worker } from "threads";

import { initApi } from "../../utils/api";
import { NodeWorker } from "../../utils/cluster/workers/nodeWorker";
import { Node } from "../../utils/cluster/types";
import { waitNewBlock } from "../../utils/eventListeners";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.spyOn(console, "error").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";

const nodeWorkerPath = "../../utils/cluster/workers/nodeWorker";

const alice: Node = { name: "Alice" };
const bob: Node = { name: "Bob" };
const charlie: Node = { name: "Charlie" };
const dave: Node = { name: "Dave" };
const eve: Node = { name: "Eve" };
const ferdie: Node = { name: "Ferdie" };

let nodes: Node[];

beforeAll(async () => {
  try {
    alice.api = await initApi("ws://node_alice:9944");
    alice.worker = await spawn<NodeWorker>(new Worker(nodeWorkerPath));

    bob.api = await initApi("ws://node_bob:9944");
    bob.worker = await spawn<NodeWorker>(new Worker(nodeWorkerPath));

    charlie.api = await initApi("ws://node_charlie:9944");
    charlie.worker = await spawn<NodeWorker>(new Worker(nodeWorkerPath));

    dave.api = await initApi("ws://node_dave:9944");
    dave.worker = await spawn<NodeWorker>(new Worker(nodeWorkerPath));

    eve.api = await initApi("ws://node_eve:9944");
    eve.worker = await spawn<NodeWorker>(new Worker(nodeWorkerPath));

    ferdie.api = await initApi("ws://node_ferdie:9944");
    ferdie.worker = await spawn<NodeWorker>(new Worker(nodeWorkerPath));

    nodes = [alice, bob, charlie, dave, eve, ferdie];
  } catch (e) {
    throw e;
  }
});

describe("Cluster -> Network -> Syncing", () => {
  test("Cluster does not fork", async () => {
    const nodeHashes: Map<String, Set<String> | undefined> = new Map();

    const blocksToWait = 3;
    for (let i = 0; i < blocksToWait; i++) {
      nodes.map(async (node) =>
        nodeHashes.set(
          node.name,
          nodeHashes.get(node.name)?.add((await node.worker?.getHash(node))!)
        )
      );

      waitNewBlock();
    }

    expect(
      intersection(Array.from(nodeHashes.values())).length
    ).toBeGreaterThan(0);
  });
});
