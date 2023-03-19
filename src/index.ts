// Import
import { ApiPromise, WsProvider } from "@polkadot/api";
// Construct
import {
  AccountInfo,
  SignedBlock,
  BlockHash,
} from "@polkadot/types/interfaces";

export interface BlockRange {
  floor: number;
  ceiling: number;
}

export interface Settings {
  network: string;
  user: string;
  blockRange: BlockRange;
}

async function fetchEx(api: ApiPromise, hash: BlockHash, signer: string) {
  const signedBlock = await api.rpc.chain.getBlock<SignedBlock>(hash);
  signedBlock.block.extrinsics
    .filter((ex) => (ex.signer.toString() == signer))
    .forEach((ex) => {
      console.log(
        `EXTRINISIC INFO: ${ex.method.section}.${
          ex.method.method
        } <-> (${ex.args.map((a) => a.toString()).join(", ")})`
      );
    });
}

async function init(settings: Settings) {
  const wsProvider = new WsProvider(settings.network);
  const api = await ApiPromise.create({ provider: wsProvider });
  // retrieve the balance, once-off at the latest block
  const initalBalance = await api.query.system.account<AccountInfo>(
    settings.user
  );

  const initialFree = initalBalance.data.free.toNumber();
  const initalFrozenMisc = initalBalance.data.miscFrozen.toNumber();

  console.log("User has an initial FREE balance of: \n", initialFree);
  console.log("And misc frozen balance of: \n", initalFrozenMisc);

  let previous: AccountInfo;
  for (
    var i = settings.blockRange.floor;
    i <= settings.blockRange.ceiling;
    i++
  ) {
    const prevHash = await api.rpc.chain.getBlockHash(i);
    const info = await api.query.system.account.at<AccountInfo>(
      prevHash,
      settings.user
    );

    if (previous! !== undefined) {
      const misc = info.data.miscFrozen.toNumber();
      const free = info.data.free.toNumber();

      const prevMisc = previous.data.miscFrozen.toNumber();
      const prevFree = previous.data.free.toNumber();

      if (prevFree < free || prevFree > free) {
        console.log(`At height, ${i}`);
        console.log("FREE BALANCE CHANGED!");
        console.log(`${free} <-> ${prevFree}, diff: ${free - prevFree}`);
        fetchEx(api, prevHash, settings.user);
      }

      if (prevMisc < misc || prevMisc > misc) {
        console.log(`At height, ${i}`);
        console.log("MISC FROZEN CHANGED!");
        console.log(`${prevMisc} <-> ${misc}, diff: ${misc - prevMisc}`);
        fetchEx(api, prevHash, settings.user);
      }
    }
    previous = info;
  }
  console.log(
    `BLOCKS SCANNED: ${settings.blockRange.ceiling - settings.blockRange.floor}`
  );

  const endingBalance = await api.query.system.account<AccountInfo>(
    settings.user
  );

  const endingFree = endingBalance.data.free.toNumber();
  const endingFrozenMisc = endingBalance.data.miscFrozen.toNumber();

  console.log(
    "User has an ending FREE balance of: \n",
    endingFree,
    ", with a difference of ",
    endingFree - initialFree
  );
  console.log(
    "And misc frozen balance of: \n",
    endingFrozenMisc,
    ", with a difference of ",
    endingFrozenMisc - initalFrozenMisc
  );
  await api.disconnect();
}
const settings: Settings = {
  network: "wss://kusama-rpc.polkadot.io",
  user: "FyCnhPMqABT4QxfCZpQqNkiGaTFcaN5w1YZG7MuLVauLA5x",
  blockRange: { floor: 16763657, ceiling: 16764245 },
};

init(settings);
