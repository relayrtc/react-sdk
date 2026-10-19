"use client";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { ClipClient } from "@relayrtc/client";
import type { ClipClientOptions } from "@relayrtc/client";

export function useClip(options: ClipClientOptions) {
  const { getClip, create, publish, delete: remove, pollIntervalMs } = options;
  const client = useMemo(
    () =>
      new ClipClient({
        getClip,
        ...(create ? { create } : {}),
        ...(publish ? { publish } : {}),
        ...(remove ? { delete: remove } : {}),
        ...(pollIntervalMs === undefined ? {} : { pollIntervalMs }),
      }),
    [getClip, create, publish, remove, pollIntervalMs],
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
    isReady: snapshot.clip?.state === "ready",
    isProcessing: snapshot.clip?.state === "rendering",
    create: client.create,
    publish: client.publish,
    delete: client.delete,
    refresh: client.refresh,
  };
}
