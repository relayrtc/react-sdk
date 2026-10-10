'use client'

import { createContext, useContext, useSyncExternalStore } from 'react'
import type { RelayStore } from './store.js'
import type { RelaySnapshot } from './types.js'

export const RelayContext = createContext<RelayStore | null>(null)

export function useRelayStore(): RelayStore {
  const store = useContext(RelayContext)
  if (!store) throw new Error('RelayRTC hooks and RelayRoom must be used inside RelayProvider')
  return store
}

export function useRelaySnapshot(): RelaySnapshot {
  const store = useRelayStore()
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot)
}
