'use client'

import { useEffect, useRef, useState } from 'react'
import { useRelaySnapshot, useRelayStore } from './context.js'
import type { RelayRoomProps } from './types.js'

export function RelayRoom(props: RelayRoomProps) {
  const { token, connect = true } = props
  const store = useRelayStore()
  const snapshot = useRelaySnapshot()
  const callbacks = useRef(props)
  callbacks.current = props
  const [owner] = useState(() => Symbol('RelayRoom'))
  const previousRoom = useRef(snapshot.room)

  useEffect(() => {
    store.claim(owner)
    const controller = new AbortController()
    if (connect && token) {
      void store.join(token, { signal: controller.signal }).catch(() => undefined)
    }
    return () => {
      controller.abort()
      store.release(owner)
    }
  }, [store, owner, token, connect])

  useEffect(() => {
    if (snapshot.room && snapshot.room !== previousRoom.current) {
      callbacks.current.onConnected?.(snapshot.room)
    } else if (!snapshot.room && previousRoom.current) {
      callbacks.current.onDisconnected?.()
    }
    previousRoom.current = snapshot.room
  }, [snapshot.room])

  useEffect(() => {
    if (snapshot.error) callbacks.current.onError?.(snapshot.error)
  }, [snapshot.error])

  return <>{props.children}</>
}
