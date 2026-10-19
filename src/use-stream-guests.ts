"use client";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { StreamGuestClient, type StreamGuestOptions } from "@relayrtc/client";
export function useStreamGuests(options: StreamGuestOptions) {
  const { getStatus, command, getJoinGrant, rtcOptions, pollIntervalMs } =
    options;
  const client = useMemo(
    () =>
      new StreamGuestClient({
        getStatus,
        command,
        ...(getJoinGrant ? { getJoinGrant } : {}),
        ...(rtcOptions ? { rtcOptions } : {}),
        ...(pollIntervalMs === undefined ? {} : { pollIntervalMs }),
      }),
    [getStatus, command, getJoinGrant, rtcOptions, pollIntervalMs],
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
    client,
    refresh: client.refresh,
    command: client.command,
  };
}
/** Caller-bound invitation/stage state; device capture stays on the existing Room API. */
export function useGuestSession(options: StreamGuestOptions) {
  const value = useStreamGuests(options);
  return {
    ...value,
    joinStage: value.client.joinStage,
    leaveStage: value.client.leaveStage,
  };
}
