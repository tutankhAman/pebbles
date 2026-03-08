"use client";

import {
  startTransition,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import {
  createFormulaWorker,
  postFormulaWorkerRequest,
  subscribeToFormulaWorker,
} from "@/features/formulas/formula-worker-client";
import type {
  FormulaWorkerCellInput,
  FormulaWorkerRequest,
  FormulaWorkerResponse,
} from "@/types/formula-worker";
import type { ComputedValue, SheetBounds } from "@/types/spreadsheet";

const FORMULA_BATCH_SIZE = 1000;

function mergeValues(
  current: Map<string, ComputedValue>,
  entries: Array<{
    key: string;
    value: ComputedValue;
  }>
) {
  const next = new Map(current);

  for (const entry of entries) {
    next.set(entry.key, entry.value);
  }

  return next;
}

function mergeErrors(
  current: Map<string, string>,
  entries: Array<{
    key: string;
    message: string;
  }>
) {
  const next = new Map(current);

  for (const entry of entries) {
    next.set(entry.key, entry.message);
  }

  return next;
}

export function useFormulaEngine(args: {
  bounds: SheetBounds;
  initialCells: FormulaWorkerCellInput[];
  visibleKeys: string[];
}) {
  const workerRef = useRef<Worker | null>(null);
  const queuedRequestsRef = useRef<FormulaWorkerRequest[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [computedValues, setComputedValues] = useState<
    Map<string, ComputedValue>
  >(() => new Map());
  const [formulaErrors, setFormulaErrors] = useState<Map<string, string>>(
    () => new Map()
  );

  const handleMessage = useEffectEvent(
    (event: MessageEvent<FormulaWorkerResponse>) => {
      const message = event.data;

      if (message.type === "ready") {
        setIsReady(true);
        return;
      }

      if (message.type === "computed") {
        startTransition(() => {
          setComputedValues((current) => mergeValues(current, message.values));
          setFormulaErrors((current) => {
            const next = new Map(current);

            for (const value of message.values) {
              next.delete(value.key);
            }

            return next;
          });
        });
        return;
      }

      startTransition(() => {
        setFormulaErrors((current) => mergeErrors(current, message.errors));
      });
    }
  );

  useEffect(() => {
    const worker = createFormulaWorker();

    workerRef.current = worker;
    const unsubscribe = subscribeToFormulaWorker(worker, (response) => {
      handleMessage({
        data: response,
      } as MessageEvent<FormulaWorkerResponse>);
    });
    postFormulaWorkerRequest(worker, {
      bounds: args.bounds,
      cells: args.initialCells,
      type: "bootstrap",
    });

    return () => {
      unsubscribe();
      worker.terminate();
      workerRef.current = null;
    };
  }, [args.bounds, args.initialCells]);

  useEffect(() => {
    if (!(isReady && workerRef.current)) {
      return;
    }

    if (queuedRequestsRef.current.length > 0) {
      for (const request of queuedRequestsRef.current) {
        postFormulaWorkerRequest(workerRef.current, request);
      }

      queuedRequestsRef.current = [];
    }

    postFormulaWorkerRequest(workerRef.current, {
      keys: args.visibleKeys,
      type: "recompute-visible",
    });
  }, [args.visibleKeys, isReady]);

  return {
    batchUpsert: (cells: FormulaWorkerCellInput[]) => {
      if (!(workerRef.current && cells.length > 0)) {
        return;
      }

      for (
        let startIndex = 0;
        startIndex < cells.length;
        startIndex += FORMULA_BATCH_SIZE
      ) {
        const request: FormulaWorkerRequest = {
          cells: cells.slice(startIndex, startIndex + FORMULA_BATCH_SIZE),
          type: "batch-upsert",
        };

        if (isReady) {
          postFormulaWorkerRequest(workerRef.current, request);
          continue;
        }

        queuedRequestsRef.current.push(request);
      }
    },
    computedValues,
    deleteCell: (key: string) => {
      if (!workerRef.current) {
        return;
      }

      const request: FormulaWorkerRequest = {
        key,
        type: "cell-delete",
      };

      if (isReady) {
        postFormulaWorkerRequest(workerRef.current, request);
        return;
      }

      queuedRequestsRef.current.push(request);
    },
    formulaErrors,
    isReady,
    upsertCell: (cell: FormulaWorkerCellInput) => {
      if (!workerRef.current) {
        return;
      }

      const request: FormulaWorkerRequest = {
        key: cell.key,
        raw: cell.raw,
        type: "cell-upsert",
      };

      if (isReady) {
        postFormulaWorkerRequest(workerRef.current, request);
        return;
      }

      queuedRequestsRef.current.push(request);
    },
  };
}
