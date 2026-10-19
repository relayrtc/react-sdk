"use client";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import {
  RestreamSourceClient,
  type RestreamSourceOptions,
} from "@relayrtc/client";
export function useRestreamSource(options: RestreamSourceOptions) {
  const { getSource, command, pollIntervalMs } = options;
  const client = useMemo(
    () =>
      new RestreamSourceClient({
        getSource,
        ...(command ? { command } : {}),
        ...(pollIntervalMs === undefined ? {} : { pollIntervalMs }),
      }),
    [getSource, command, pollIntervalMs],
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
    isLive: snapshot.source?.state === "live",
    refresh: client.refresh,
    command: client.command,
  };
}
