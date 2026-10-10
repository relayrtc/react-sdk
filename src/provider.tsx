'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { RelayContext } from './context.js'
import { RelayStore } from './store.js'
import type { RelayProviderProps } from './types.js'

export function RelayProvider(props: RelayProviderProps) {
  const options = useRef(props)
  options.current = props
  const [store] = useState(() => new RelayStore(() => options.current))
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot)
  const limit = props.messageHistoryLimit ?? 100
  if (!Number.isInteger(limit) || limit < 0 || limit > 10_000) {
    throw new Error('messageHistoryLimit must be an integer from 0 to 10000')
  }

  useEffect(() => () => { store.dispose() }, [store])
  useEffect(() => {
    if (snapshot.error) options.current.onError?.(snapshot.error)
  }, [snapshot.error])

  return <RelayContext.Provider value={store}>{props.children}</RelayContext.Provider>
}
