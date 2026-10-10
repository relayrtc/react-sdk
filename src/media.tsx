'use client'

import { useCallback, useEffect, useState } from 'react'
import type { RoomRemoteTrack } from '@relayrtc/client'
import { useRelaySnapshot } from './context.js'
import type { MediaLoaderProps, MediaPlaybackState, UseMediaTrackOptions, UseMediaTrackResult } from './types.js'

export function MediaLoader({ label = 'Loading media', children, ...props }: MediaLoaderProps) {
  return <div role="status" aria-live="polite" {...props}>
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <circle cx="16" cy="16" r="12" stroke="currentColor" strokeWidth="3" opacity="0.2" />
      <path d="M16 4a12 12 0 0 1 12 12" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
        <animateTransform attributeName="transform" type="rotate" from="0 16 16" to="360 16 16" dur="0.9s" repeatCount="indefinite" />
      </path>
    </svg>
    <span>{children ?? label}</span>
  </div>
}

export function useMediaTrack(
  track: RoomRemoteTrack | MediaStreamTrack | null | undefined,
  { enabled = true, paused = false }: UseMediaTrackOptions = {},
): UseMediaTrackResult {
  const { connectionState } = useRelaySnapshot()
  const [element, setElement] = useState<HTMLMediaElement | null>(null)
  const remote = track && 'subscriptionState' in track ? track : null
  const mediaTrack = remote ? remote.mediaStreamTrack : track as MediaStreamTrack | null | undefined
  const subscriptionState = remote?.subscriptionState
  const publicationState = remote?.info.state
  const suspended = Boolean(remote && connectionState !== 'connected')
  const isPaused = paused || publicationState === 'paused'
  const [playback, setPlayback] = useState<{
    track: typeof track
    element: HTMLMediaElement | null
    state: MediaPlaybackState
    error: Error | null
  }>({ track: null, element: null, state: 'idle', error: null })
  const ref = useCallback((value: HTMLMediaElement | null) => setElement(value), [])

  const play = useCallback(async () => {
    if (!element || !track || !enabled || isPaused || suspended) return
    try {
      await element.play()
      setPlayback({ track, element, state: element.readyState >= 2 ? 'playing' : 'loading', error: null })
    } catch (value) {
      const error = value instanceof Error ? value : new Error('Media playback failed')
      const state = error.name === 'NotAllowedError' ? 'blocked' : error.name === 'AbortError' ? 'loading' : 'failed'
      setPlayback({ track, element, state, error: state === 'loading' ? null : error })
      throw error
    }
  }, [element, track, enabled, isPaused, suspended])

  useEffect(() => {
    if (!element || !track || !enabled || suspended || remote?.type === 'data') return
    let active = true
    let boundTrack: MediaStreamTrack | null | undefined
    const update = (state: MediaPlaybackState, error: Error | null = null) => {
      if (active) setPlayback({ track, element, state, error })
    }
    const loading = () => update('loading')
    const ended = () => update('ended')
    const refresh = () => {
      if (boundTrack?.readyState === 'ended') ended()
      else if (isPaused) update('paused')
      else if (element.readyState >= 2 && !element.paused && !boundTrack?.muted) update('playing')
      else loading()
    }
    const pause = () => update(isPaused ? 'paused' : 'idle')
    const failed = () => update('failed', new Error(element.error?.message || 'Media playback failed'))
    const handlers = { playing: refresh, loadeddata: refresh, canplay: refresh, waiting: loading, stalled: loading, emptied: loading, pause, ended, error: failed }
    for (const [event, handler] of Object.entries(handlers)) element.addEventListener(event, handler)
    loading()
    let stream: MediaStream | undefined
    void (async () => {
      try {
        if (remote) await remote.attach(element)
        else {
          stream = new MediaStream([track as MediaStreamTrack])
          element.srcObject = stream
        }
        if (!active) return
        boundTrack = remote ? remote.mediaStreamTrack : track as MediaStreamTrack
        boundTrack?.addEventListener('mute', loading)
        boundTrack?.addEventListener('unmute', refresh)
        boundTrack?.addEventListener('ended', ended)
        if (isPaused) { update('paused'); return }
        await element.play()
        if (active) refresh()
      } catch (value) {
        const error = value instanceof Error ? value : new Error('Media playback failed')
        if (error.name === 'AbortError') loading()
        else update(error.name === 'NotAllowedError' ? 'blocked' : 'failed', error)
      }
    })()
    return () => {
      active = false
      for (const [event, handler] of Object.entries(handlers)) element.removeEventListener(event, handler)
      boundTrack?.removeEventListener('mute', loading)
      boundTrack?.removeEventListener('unmute', refresh)
      boundTrack?.removeEventListener('ended', ended)
      if (remote) remote.detach(element)
      else if (element.srcObject === stream) element.srcObject = null
    }
  }, [track, element, remote, mediaTrack, subscriptionState, enabled, suspended, isPaused])

  let state: MediaPlaybackState
  if (!track || !enabled || remote?.type === 'data') state = 'idle'
  else if (subscriptionState === 'closed' || publicationState === 'unpublished' || mediaTrack?.readyState === 'ended') state = 'ended'
  else if (isPaused) state = 'paused'
  else if (suspended) state = 'loading'
  else if (playback.track !== track || playback.element !== element) state = 'loading'
  else state = playback.state
  return { ref, state, isLoading: state === 'loading', isPaused: state === 'paused', error: state === 'blocked' || state === 'failed' ? playback.error : null, play }
}
