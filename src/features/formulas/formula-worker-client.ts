import type {
  FormulaWorkerRequest,
  FormulaWorkerResponse,
} from "@/types/formula-worker";

export function createFormulaWorker() {
  return new Worker(
    new URL("../../workers/formula.worker.ts", import.meta.url),
    {
      type: "module",
    }
  );
}

export function postFormulaWorkerRequest(
  worker: Worker,
  request: FormulaWorkerRequest
) {
  worker.postMessage(request);
}

export function subscribeToFormulaWorker(
  worker: Worker,
  listener: (response: FormulaWorkerResponse) => void
) {
  const handleMessage = (event: MessageEvent<FormulaWorkerResponse>) => {
    listener(event.data);
  };

  worker.addEventListener("message", handleMessage);

  return () => {
    worker.removeEventListener("message", handleMessage);
  };
}
