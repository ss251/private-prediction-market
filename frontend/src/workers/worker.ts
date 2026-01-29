import {
  Account,
  ProgramManager,
  PrivateKey,
  initThreadPool,
  AleoKeyProvider,
  AleoNetworkClient,
  NetworkRecordProvider,
} from "@provablehq/sdk";
import { expose, proxy } from "comlink";

// API endpoint for testnet
const API_URL = "https://api.explorer.provable.com/v1/testnet";

// Initialize WASM thread pool for parallel proving
await initThreadPool();

// Execute program locally (no network, no proofs - for testing)
async function localProgramExecution(
  program: string,
  functionName: string,
  inputs: string[]
): Promise<string[]> {
  const programManager = new ProgramManager();
  const account = new Account();
  programManager.setAccount(account);

  const response = await programManager.run(
    program,
    functionName,
    inputs,
    false // don't generate proofs
  );
  return response.getOutputs();
}

// Execute program on-chain (generates proofs)
async function executeOnChain(
  privateKey: string,
  programName: string,
  functionName: string,
  inputs: string[],
  fee: number
): Promise<string> {
  const account = new Account({ privateKey });
  const networkClient = new AleoNetworkClient(API_URL);
  const keyProvider = new AleoKeyProvider();
  keyProvider.useCache(true);
  const recordProvider = new NetworkRecordProvider(account, networkClient);

  const programManager = new ProgramManager(
    API_URL,
    keyProvider,
    recordProvider
  );
  programManager.setAccount(account);

  const txId = await programManager.execute({
    programName,
    functionName,
    inputs,
    priorityFee: fee,
    privateFee: false,
  });

  return txId;
}

// Generate a new private key
async function getPrivateKey(): Promise<ReturnType<typeof proxy>> {
  const key = new PrivateKey();
  return proxy(key);
}

// Deploy a program to the network
async function deployProgram(
  privateKey: string,
  program: string,
  fee: number
): Promise<string> {
  const account = new Account({ privateKey });
  const networkClient = new AleoNetworkClient(API_URL);
  const keyProvider = new AleoKeyProvider();
  keyProvider.useCache(true);
  const recordProvider = new NetworkRecordProvider(account, networkClient);

  const programManager = new ProgramManager(
    API_URL,
    keyProvider,
    recordProvider
  );
  programManager.setAccount(account);

  const txId = await programManager.deploy(program, fee, false, undefined);
  return txId;
}

// Expose worker methods to main thread via Comlink
expose({
  localProgramExecution,
  executeOnChain,
  getPrivateKey,
  deployProgram,
});
