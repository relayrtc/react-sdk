"use client";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { MixerClient, type MixerClientOptions } from "@relayrtc/client";
export function useMixer(options: MixerClientOptions) {
  const { getMixer, getOperation, activateScene, stop, pollIntervalMs } =
    options;
  const client = useMemo(
    () =>
      new MixerClient({
        getMixer,
        ...(getOperation ? { getOperation } : {}),
        ...(activateScene ? { activateScene } : {}),
        ...(stop ? { stop } : {}),
        ...(pollIntervalMs === undefined ? {} : { pollIntervalMs }),
      }),
    [getMixer, getOperation, activateScene, stop, pollIntervalMs],
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
    isLive: snapshot.mixer?.state === "live",
    isApplied:
      !!snapshot.mixer &&
      snapshot.mixer.desiredVersion > 0 &&
      snapshot.mixer.desiredVersion === snapshot.mixer.appliedVersion,
    activateScene: client.activateScene,
    stop: client.stop,
    refresh: client.refresh,
  };
}
