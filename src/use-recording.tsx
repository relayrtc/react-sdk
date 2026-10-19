"use client";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { RecordingClient } from "@relayrtc/client";
import type { RecordingClientOptions } from "@relayrtc/client";

export function useRecording(options: RecordingClientOptions) {
  const { getRecording, start, stop, delete: remove, pollIntervalMs } = options;
  const client = useMemo(
    () =>
      new RecordingClient({
        getRecording,
        ...(start ? { start } : {}),
        ...(stop ? { stop } : {}),
        ...(remove ? { delete: remove } : {}),
        ...(pollIntervalMs === undefined ? {} : { pollIntervalMs }),
      }),
    [getRecording, start, stop, remove, pollIntervalMs],
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
    isRecording: snapshot.recording?.state === "recording",
    isProcessing: snapshot.recording?.state === "finalizing",
    start: client.start,
    stop: client.stop,
    delete: client.delete,
    refresh: client.refresh,
  };
}

/** An observed status indicator. Applications must obtain consent before starting capture. */
export function RecordingIndicator({
  state,
}: {
  state: string | null | undefined;
}) {
  if (!state || ["ready", "failed", "deleted"].includes(state)) return null;
  return (
    <span role="status" aria-live="polite" data-recording-state={state}>
      {state === "recording"
        ? "● Recording"
        : state === "finalizing"
          ? "Processing recording"
          : state === "deleting"
            ? "Deleting recording"
            : "Recording requested"}
    </span>
  );
}
