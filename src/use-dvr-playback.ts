"use client";
import { useEffect, useState, useRef } from "react";
import type { RefObject } from "react";
import {
  DvrPlaybackController,
  initialDvrPlaybackState,
} from "@relayrtc/client";
/** Reusable state for a media element, independent of authentication or a particular player. */
export function useDvrPlayback(
  media: RefObject<HTMLVideoElement | null>,
  enabled = true,
  onExpired?: () => void,
) {
  const [state, setState] = useState(initialDvrPlaybackState);
  const controller = useRef<DvrPlaybackController | null>(null);
  const expired = useRef(onExpired);
  useEffect(() => {
    expired.current = onExpired;
  }, [onExpired]);
  useEffect(() => {
    if (!enabled || !media.current) return;
    const value = new DvrPlaybackController(media.current, () =>
      expired.current?.(),
    );
    controller.current = value;
    const unsubscribe = value.subscribe(() => setState(value.getSnapshot()));
    value.start();
    return () => {
      unsubscribe();
      value.stop();
      controller.current = null;
    };
  }, [media, enabled]);
  return {
    ...state,
    seek: (seconds: number) => controller.current?.seek(seconds),
    rewind: (seconds = 30) => controller.current?.rewind(seconds),
    goLive: () => controller.current?.goLive(),
  };
}
