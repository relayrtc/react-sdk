"use client";
import { useDvrPlayback } from "./use-dvr-playback.js";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  attachBroadcastPlayback,
  StreamPlaybackClient,
} from "@relayrtc/client";
import type {
  BroadcastPlaybackState,
  HlsEngineFactory,
  StreamPlaybackOptions,
} from "@relayrtc/client";
import type { VideoHTMLAttributes } from "react";

export function useStreamPlayback(options: StreamPlaybackOptions) {
  const { getPlayback, getGrant, pollIntervalMs, mode } = options;
  const client = useMemo(
    () =>
      new StreamPlaybackClient({
        getPlayback,
        getGrant,
        ...(mode ? { mode } : {}),
        ...(pollIntervalMs === undefined ? {} : { pollIntervalMs }),
      }),
    [getPlayback, getGrant, pollIntervalMs, mode],
  );
  const snapshot = useSyncExternalStore(
    client.subscribe,
    client.getSnapshot,
    client.getServerSnapshot,
  );
  useEffect(() => {
    client.start();
    return () => client.stop();
  }, [client]);
  return { ...snapshot, client, refresh: client.refresh };
}

export interface BroadcastPlayerProps extends Omit<
  VideoHTMLAttributes<HTMLVideoElement>,
  "src" | "srcObject" | "onError"
> {
  mode?: "live" | "vod" | "dvr";
  source: StreamPlaybackOptions;
  createHlsEngine?: HlsEngineFactory;
  onPlaybackState?: (state: BroadcastPlaybackState) => void;
}

/** Independent of RelayProvider/RelayRoom. No RTC participant or management key is needed. */
export function BroadcastPlayer({
  source,
  mode = source.mode ?? "live",
  createHlsEngine,
  onPlaybackState,
  autoPlay = true,
  controls = true,
  ...props
}: BroadcastPlayerProps) {
  const { client, playback } = useStreamPlayback({ ...source, mode });
  const media = useRef<HTMLVideoElement>(null);
  const dvr = useDvrPlayback(media, mode === "dvr");
  const [state, setState] = useState<BroadcastPlaybackState>("loading");
  useEffect(() => {
    if (!media.current) return;
    return attachBroadcastPlayback(media.current, client, {
      autoPlay,
      mode,
      ...(createHlsEngine ? { createHlsEngine } : {}),
      onState: (value) => {
        setState(value);
        onPlaybackState?.(value);
      },
    });
  }, [client, autoPlay, createHlsEngine, onPlaybackState, mode]);
  return (
    <div data-playback-state={state}>
      <video
        {...props}
        autoPlay={autoPlay}
        controls={controls}
        playsInline
        ref={media}
      />
      {mode === "dvr" && (
        <div aria-label="DVR playback controls">
          <p role="status" aria-live="polite">
            {!dvr.available
              ? "Waiting for retained media"
              : dvr.isLive
                ? playback?.state === "ended"
                  ? "End of retained run"
                  : "Live"
                : `${Math.round(dvr.behindLiveSeconds)} seconds behind live`}
          </p>
          <button
            type="button"
            disabled={!dvr.available}
            onClick={() => dvr.rewind(30)}
          >
            Rewind 30 seconds
          </button>
          <label>
            Seek within retained media{" "}
            <input
              type="range"
              min={dvr.start}
              max={Math.max(dvr.start, dvr.end)}
              step="0.1"
              value={Math.max(dvr.start, Math.min(dvr.position, dvr.end))}
              disabled={!dvr.available}
              onChange={(event) => dvr.seek(Number(event.target.value))}
            />
          </label>
          <button
            type="button"
            disabled={!dvr.available}
            onClick={() => {
              dvr.goLive();
              void media.current?.play().catch(() => setState("blocked"));
            }}
          >
            Go live
          </button>
          {dvr.recoveredExpiredSeek && (
            <p role="status">
              That position expired. Playback moved to retained media.
            </p>
          )}
        </div>
      )}
      {state === "blocked" && (
        <button
          type="button"
          onClick={() => {
            void media.current?.play().catch(() => setState("blocked"));
          }}
        >
          Play stream
        </button>
      )}
      {state === "unsupported" && (
        <p role="status">This browser needs an HLS playback engine.</p>
      )}
      {state === "unavailable" && (
        <p role="status">
          {mode === "vod"
            ? "Recording is being prepared."
            : "Waiting for live media."}
        </p>
      )}
      {state === "error" && (
        <p role="status">
          Playback is unavailable.{" "}
          <button
            type="button"
            onClick={() => {
              void client.refresh(true);
            }}
          >
            Retry
          </button>
        </p>
      )}
    </div>
  );
}
