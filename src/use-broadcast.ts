"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { BroadcastClient } from "@relayrtc/client";
import type { BroadcastClientOptions } from "@relayrtc/client";

export function useBroadcast(options: BroadcastClientOptions) {
  const {
    getBroadcast,
    getOutputs,
    getOperation,
    start,
    stop,
    retryOutput,
    pollIntervalMs,
  } = options;
  const client = useMemo(
    () =>
      new BroadcastClient({
        getBroadcast,
        getOutputs,
        getOperation,
        ...(retryOutput ? { retryOutput } : {}),
        ...(start ? { start } : {}),
        ...(stop ? { stop } : {}),
        ...(pollIntervalMs === undefined ? {} : { pollIntervalMs }),
      }),
    [
      getBroadcast,
      getOutputs,
      getOperation,
      start,
      stop,
      retryOutput,
      pollIntervalMs,
    ],
  );
  const snapshot = useSyncExternalStore(
    client.subscribe,
    client.getSnapshot,
    client.getServerSnapshot,
  );
  useEffect(() => {
    client.connect();
    return () => client.disconnect();
  }, [client]);
  return {
    ...snapshot,
    start: client.start,
    stop: client.stop,
    retryOutput: client.retryOutput,
    refresh: client.refresh,
  };
}
