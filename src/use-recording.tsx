"use client";
import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { RecordingClient } from "@relayrtc/client";
import type { RecordingClientOptions } from "@relayrtc/client";

export function useRecording(options: RecordingClientOptions) {
  const { getRecording, start, stop, delete: remove, pollIntervalMs } = options;
  // Command closures can change with consent/selection without resetting an
  // observed recording or discarding a command's retry key. getRecording is the
  // resource boundary: change its identity when switching rooms/broadcasts.
  const commands = useRef({ start, stop, remove });
  commands.current = { start, stop, remove };
  const canStart = !!start, canStop = !!stop, canRemove = !!remove;
  const client = useMemo(
    () =>
      new RecordingClient({
        getRecording,
        ...(canStart ? { start: (context: Parameters<NonNullable<RecordingClientOptions["start"]>>[0]) => commands.current.start!(context) } : {}),
        ...(canStop ? { stop: (context: Parameters<NonNullable<RecordingClientOptions["stop"]>>[0]) => commands.current.stop!(context) } : {}),
        ...(canRemove ? { delete: (context: Parameters<NonNullable<RecordingClientOptions["delete"]>>[0]) => commands.current.remove!(context) } : {}),
        ...(pollIntervalMs === undefined ? {} : { pollIntervalMs }),
      }),
    [getRecording, canStart, canStop, canRemove, pollIntervalMs],
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
