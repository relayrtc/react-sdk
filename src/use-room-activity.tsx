'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ButtonHTMLAttributes } from 'react'
import { createPushToTalk, RoomError } from '@relayrtc/client'
import type {
  PushToTalkController,
  PushToTalkSnapshot,
  ParticipantActivityPreferences,
} from '@relayrtc/client'
import { useRelaySnapshot } from './context.js'

export function useRoomActivity() {
  const { room, activity } = useRelaySnapshot()
  return useMemo(
    () => ({
      snapshot: activity,
      preferences: room?.activity.preferences ?? null,
      configure: async (preferences: ParticipantActivityPreferences) => {
        if (!room)
          throw new RoomError(
            'NOT_CONNECTED',
            'Join a room before changing activity preferences',
          )
        return room.activity.configure(preferences)
      },
      get: async () => {
        if (!room)
          throw new RoomError(
            'NOT_CONNECTED',
            'Join a room before reading activity',
          )
        return room.activity.get()
      },
    }),
    [room, activity],
  )
}

export function useActiveSpeakers() {
  const { snapshot } = useRoomActivity()
  return useMemo(
    () => ({
      speakers: snapshot?.speakers ?? [],
      dominantSpeakerId: snapshot?.dominantSpeakerId ?? null,
      state: snapshot?.speakerState ?? 'unavailable',
    }),
    [snapshot],
  )
}

const initial: PushToTalkSnapshot = {
  pressed: false,
  active: false,
  pending: false,
  error: null,
}
export function usePushToTalk(options: { key?: string } = {}) {
  const { room } = useRelaySnapshot()
  const controller = useRef<PushToTalkController | null>(null)
  const [snapshot, setSnapshot] = useState(initial)
  useEffect(() => {
    setSnapshot(initial)
    if (!room) return
    const value = createPushToTalk(room)
    controller.current = value
    const unsubscribe = value.subscribe(setSnapshot)
    setSnapshot(value.current)
    return () => {
      controller.current = null
      unsubscribe()
      value.dispose()
    }
  }, [room])
  useEffect(() => {
    if (!options.key || typeof window === 'undefined') return
    let held = false
    const down = (event: KeyboardEvent) => {
      if (
        event.code !== options.key ||
        event.repeat ||
        event.ctrlKey ||
        event.altKey ||
        event.metaKey
      )
        return
      if (
        event.target instanceof Element &&
        event.target.closest(
          'input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]',
        )
      )
        return
      held = true
      event.preventDefault()
      void controller.current?.press().catch(() => undefined)
    }
    const up = (event: KeyboardEvent) => {
      if (held && event.code === options.key) {
        held = false
        event.preventDefault()
        void controller.current?.release().catch(() => undefined)
      }
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      void controller.current?.release().catch(() => undefined)
    }
  }, [options.key, room])
  const press = useCallback(
    () =>
      controller.current?.press() ??
      Promise.reject(new Error('Join a room before using push-to-talk')),
    [],
  )
  const release = useCallback(
    () => controller.current?.release() ?? Promise.resolve(),
    [],
  )
  return useMemo(
    () => ({ ...snapshot, press, release }),
    [snapshot, press, release],
  )
}

export function PushToTalkButton({
  children,
  disabled,
  ...props
}: Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  | 'onPointerDown'
  | 'onPointerUp'
  | 'onPointerCancel'
  | 'onLostPointerCapture'
  | 'onKeyDown'
  | 'onKeyUp'
  | 'onBlur'
>) {
  const { room, capabilities } = useRelaySnapshot()
  const talk = usePushToTalk()
  const unavailable =
    disabled || !room || !capabilities?.permissions.includes('audio:publish')
  useEffect(() => {
    if (unavailable) void talk.release().catch(() => undefined)
  }, [unavailable, talk.release])
  return (
    <>
      <button
        {...props}
        type="button"
        disabled={unavailable}
        aria-pressed={talk.pressed}
        aria-busy={talk.pending}
        onPointerDown={(event) => {
          if (!event.isPrimary || event.button !== 0) return
          event.currentTarget.setPointerCapture(event.pointerId)
          void talk.press().catch(() => undefined)
        }}
        onPointerUp={() => {
          void talk.release().catch(() => undefined)
        }}
        onPointerCancel={() => {
          void talk.release().catch(() => undefined)
        }}
        onLostPointerCapture={() => {
          void talk.release().catch(() => undefined)
        }}
        onKeyDown={(event) => {
          if (!event.repeat && (event.key === ' ' || event.key === 'Enter')) {
            event.preventDefault()
            void talk.press().catch(() => undefined)
          }
        }}
        onKeyUp={(event) => {
          if (event.key === ' ' || event.key === 'Enter') {
            event.preventDefault()
            void talk.release().catch(() => undefined)
          }
        }}
        onBlur={() => {
          void talk.release().catch(() => undefined)
        }}
      >
        {children ??
          (talk.pending
            ? 'Updating microphone…'
            : talk.active
              ? 'Talking…'
              : 'Hold to talk')}
      </button>
      {talk.error && <span role="alert">{talk.error.message}</span>}
    </>
  )
}
