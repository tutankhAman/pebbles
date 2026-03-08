"use client";

import {
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { getViewportFromScroll } from "@/features/spreadsheet/viewport";
import type { Viewport } from "@/types/spreadsheet";

export const DEFAULT_VIEWPORT_WIDTH = 960;
export const DEFAULT_VIEWPORT_HEIGHT = 640;

export function useVirtualViewport() {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const pendingScrollRef = useRef({
    scrollX: 0,
    scrollY: 0,
  });
  const [viewport, setViewport] = useState<Viewport>(() =>
    getViewportFromScroll({
      scrollX: 0,
      scrollY: 0,
      viewportHeight: DEFAULT_VIEWPORT_HEIGHT,
      viewportWidth: DEFAULT_VIEWPORT_WIDTH,
    })
  );

  useEffect(() => {
    const node = scrollRef.current;

    if (!node) {
      return;
    }

    const updateViewport = (
      nextScrollX: number,
      nextScrollY: number,
      nextWidth: number,
      nextHeight: number
    ) => {
      startTransition(() => {
        setViewport(
          getViewportFromScroll({
            scrollX: nextScrollX,
            scrollY: nextScrollY,
            viewportHeight: nextHeight,
            viewportWidth: nextWidth,
          })
        );
      });
    };

    updateViewport(0, 0, node.clientWidth, node.clientHeight);

    const resizeObserver = new ResizeObserver(() => {
      updateViewport(
        pendingScrollRef.current.scrollX,
        pendingScrollRef.current.scrollY,
        node.clientWidth,
        node.clientHeight
      );
    });

    resizeObserver.observe(node);

    return () => {
      resizeObserver.disconnect();

      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  const handleScroll = useCallback(() => {
    const node = scrollRef.current;

    if (!node) {
      return;
    }

    pendingScrollRef.current = {
      scrollX: node.scrollLeft,
      scrollY: node.scrollTop,
    };

    if (frameRef.current !== null) {
      return;
    }

    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      startTransition(() => {
        setViewport(
          getViewportFromScroll({
            scrollX: pendingScrollRef.current.scrollX,
            scrollY: pendingScrollRef.current.scrollY,
            viewportHeight: node.clientHeight,
            viewportWidth: node.clientWidth,
          })
        );
      });
    });
  }, []);

  return {
    handleScroll,
    scrollRef,
    viewport,
  };
}
