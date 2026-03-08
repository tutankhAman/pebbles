/// <reference lib="webworker" />

import { FormulaEngine } from "@/features/formulas/formula-engine";
import type {
  FormulaWorkerComputedValue,
  FormulaWorkerError,
  FormulaWorkerRequest,
  FormulaWorkerResponse,
} from "@/types/formula-worker";

const engine = new FormulaEngine();

function postResult(result: {
  errors: FormulaWorkerError[];
  values: FormulaWorkerComputedValue[];
}) {
  if (result.values.length > 0) {
    self.postMessage({
      type: "computed",
      values: result.values,
    } satisfies FormulaWorkerResponse);
  }

  if (result.errors.length > 0) {
    self.postMessage({
      errors: result.errors,
      type: "errors",
    } satisfies FormulaWorkerResponse);
  }
}

self.onmessage = (event: MessageEvent<FormulaWorkerRequest>) => {
  const message = event.data;

  switch (message.type) {
    case "bootstrap":
      postResult(engine.bootstrap(message.cells));
      self.postMessage({
        type: "ready",
      } satisfies FormulaWorkerResponse);
      break;
    case "batch-upsert":
      postResult(engine.upsertBatch(message.cells));
      break;
    case "cell-delete":
      postResult(engine.deleteCell(message.key));
      break;
    case "cell-upsert":
      postResult(
        engine.upsertCell({
          key: message.key,
          raw: message.raw,
        })
      );
      break;
    case "recompute-visible":
      postResult(engine.recomputeVisible(message.keys));
      break;
    default:
      break;
  }
};
