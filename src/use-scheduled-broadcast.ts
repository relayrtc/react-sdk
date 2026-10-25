"use client";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { ScheduledBroadcastClient } from "@relayrtc/client";
import type { ScheduledBroadcastOptions } from "@relayrtc/client";
export function useScheduledBroadcast(options: ScheduledBroadcastOptions) {
  const { getSchedule, getPlayback, update, cancel, startNow, pollIntervalMs } =
    options;
  const client = useMemo(
    () =>
      new ScheduledBroadcastClient({
        getSchedule,
        ...(getPlayback ? { getPlayback } : {}),
        ...(update ? { update } : {}),
        ...(cancel ? { cancel } : {}),
        ...(startNow ? { startNow } : {}),
        ...(pollIntervalMs === undefined ? {} : { pollIntervalMs }),
      }),
    [getSchedule, getPlayback, update, cancel, startNow, pollIntervalMs],
  );
  const snapshot = useSyncExternalStore(
      client.subscribe,
      client.getSnapshot,
      client.getServerSnapshot,
    ),
    [now, setNow] = useState(0);
  useEffect(() => {
    client.connect();
    return () => client.disconnect();
  }, [client]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const countdownSeconds =
    snapshot.schedule && now
      ? Math.max(
          0,
          Math.ceil(
            (Date.parse(snapshot.schedule.startsAt) -
              now -
              snapshot.serverOffsetMs) /
              1000,
          ),
        )
      : null;
  return {
    ...snapshot,
    countdownSeconds,
    isWaiting: snapshot.schedule?.state === "starting",
    isLive: snapshot.playback?.state === "live",
    update: client.update,
    cancel: client.cancel,
    startNow: client.startNow,
    refresh: client.refresh,
  };
}
