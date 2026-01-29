import { wrap, type Remote } from "comlink";

interface WorkerAPI {
  localProgramExecution(
    program: string,
    functionName: string,
    inputs: string[]
  ): Promise<string[]>;
  executeOnChain(
    privateKey: string,
    programName: string,
    functionName: string,
    inputs: string[],
    fee: number
  ): Promise<string>;
  getPrivateKey(): Promise<unknown>;
  deployProgram(
    privateKey: string,
    program: string,
    fee: number
  ): Promise<string>;
}

let singletonWorker: Remote<WorkerAPI> | null = null;

export const AleoWorker = (): Remote<WorkerAPI> => {
  if (!singletonWorker) {
    const worker = new Worker(new URL("./worker.ts", import.meta.url), {
      type: "module",
    });

    worker.onerror = (event) => {
      console.error("Worker error:", event?.message);
    };

    singletonWorker = wrap<WorkerAPI>(worker);
  }
  return singletonWorker;
};
