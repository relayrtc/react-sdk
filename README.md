# RelayRTC React SDK

`useRecording` keeps its observed recording and pending command identity when only command callback closures change (for example, consent or the selected recording ID). Command callbacks use their latest implementation. Keep `getRecording` memoized; change its identity when switching the authorized resource/broadcast. Avoid copying an observed ID into state that recreates the same observing client. Broadcast, recording, playback, clip, mixer and schedule polling in the matching browser SDK back off after errors and honor callback errors carrying `status` and `retryAfterMs`; manual retry calls do not bypass an active cooldown.

For long-running calls, pass `refreshToken` to `RelayProvider` and connect it to an authenticated application backend using Node SDK `tokens.renew`. Renewal preserves participant identity, session and permissions. Return `null` to deny access; throw a retryable `RoomError` for temporary failures. Auto-subscription does not configure renewal. Requires matching local API and SDK builds; see `docs/guides/connection-recovery.mdx` in the workspace for the full backend authorization flow.

React providers and hooks for RelayRTC audio, video, screen sharing, participants, messaging and connection quality. The SDK wraps `@relayrtc/client` and leaves your application in control of its interface.

This repository implements the React portion of Phase 9. Runtime, build and browser verification have not been run. Installation from the registry requires both this package and the compatible browser client to be published first. The current browser-client contract is version `0.0.0`.

## Installation

Use one package manager after the packages are available:

```sh
npm install @relayrtc/react @relayrtc/client react react-dom
```

```sh
pnpm add @relayrtc/react @relayrtc/client react react-dom
```

```sh
yarn add @relayrtc/react @relayrtc/client react react-dom
```

React 18.3 or 19 is required. The package publishes ES modules and TypeScript declarations. In Next.js, put RTC components behind a `'use client'` boundary.

For development before browser-client publication, build the browser client in its own workspace and link that built package as `@relayrtc/client`. Its protocol and types dependencies also need to resolve. This repository does not copy the browser SDK or its server credentials.

## Join a room

Your application server creates the room and participant token. Pass only that participant token to the browser. Keep secret API keys on your server.

```tsx
import { RelayProvider, RelayRoom, useRoom } from '@relayrtc/react'

export function Call({ token }: { token: string }) {
  return (
    <RelayProvider signalingUrl="wss://rtc.example.com">
      <RelayRoom token={token} onError={console.error}>
        <ConnectionStatus />
        <Controls />
        <Participants />
        <RemoteTracks />
        <Chat />
        <ConnectionQuality />
      </RelayRoom>
    </RelayProvider>
  )
}

function ConnectionStatus() {
  const { connectionState, error } = useRoom()
  return (
    <div>
      <p>{connectionState}</p>
      {error && <p role="alert">{error.message}</p>}
    </div>
  )
}
```

The components used above are defined in the following examples. Replace the signaling URL with your deployment's URL. Joining does not enable the microphone, camera or screen; those actions require explicit user interaction.

`RelayProvider` supplies configuration and one room context. `RelayRoom` joins when `connect` is true and the token is present. It cancels pending joins and leaves on unmount, token change or a change to `connect`. A failed join stays failed until an intentional join or token/connect change. Calling `leave()` stays left across ordinary rerenders.

Mount one `RelayRoom` per provider. For independent calls, use separate providers. Provider options apply to the next join; ordinary changes to callback identities or option objects do not restart the current connection. To switch deployments, leave and rejoin, or remount the provider with a different `key`. A new `RelayRoom` token causes a leave and fresh join; credential renewal during a call uses `refreshToken` instead.

`RelayRoom` accepts `onConnected(room)`, `onDisconnected()` and `onError(error)`. The connection callbacks report changes while the component is mounted. Automatic reconnect progress is available through `connectionState` and the browser client's events. `RelayProvider` also accepts `onError` for applications using manual joins.

## Manual join and leave

Use this inside `RelayProvider` when your application owns the join button. Automatic and manual joining should not compete for the same provider.

```tsx
import { useState } from 'react'
import { useRoom } from '@relayrtc/react'

export function JoinControls({ token }: { token: string }) {
  const { room, connectionState, join, leave } = useRoom()
  const [error, setError] = useState<string | null>(null)
  const run = (operation: () => Promise<unknown>) => {
    setError(null)
    void operation().catch((value: unknown) => {
      setError(value instanceof Error ? value.message : 'Operation failed')
    })
  }
  return (
    <div>
      <button
        disabled={Boolean(room) || connectionState === 'connecting'}
        onClick={() => run(() => join(token))}
      >Join room</button>
      <button
        disabled={!room && connectionState !== 'connecting'}
        onClick={() => run(leave)}
      >Leave room</button>
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
```

`join(token, { signal })` supports cancellation while joining. `leave()` also cancels a pending join. New joins wait for previous client cleanup and create their own browser client, so an old operation cannot overwrite a newer call's React state.

## Microphone, camera and screen sharing

```tsx
import { useState } from 'react'
import { useLocalMedia, useLocalParticipant } from '@relayrtc/react'

export function Controls() {
  const local = useLocalParticipant()
  const { microphone, camera, screen } = useLocalMedia()
  const [error, setError] = useState<string | null>(null)
  const run = (operation: () => Promise<unknown>) => {
    setError(null)
    void operation().catch((value: unknown) => {
      setError(value instanceof Error ? value.message : 'Media operation failed')
    })
  }
  return (
    <div>
      <button disabled={!local} onClick={() => local && run(() => microphone?.enabled
        ? local.microphone.disable()
        : local.microphone.enable())}
      >{microphone?.enabled ? 'Disable microphone' : 'Enable microphone'}</button>
      <button disabled={!microphone?.enabled || microphone.pending} onClick={() => local && run(() => microphone?.muted
        ? local.microphone.unmute()
        : local.microphone.mute())
      }>{microphone?.muted ? 'Unmute' : 'Mute'}</button>
      <button disabled={!local} onClick={() => local && run(() => camera?.enabled
        ? local.camera.disable()
        : local.camera.enable())}
      >{camera?.enabled ? 'Disable camera' : 'Enable camera'}</button>
      <button disabled={!local} onClick={() => local && run(() => screen?.active
        ? local.screen.stop()
        : local.screen.start({ video: true, audio: true }))}
      >{screen?.active ? 'Stop sharing' : 'Share screen'}</button>
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
```

Microphone and camera controls also support `switchDevice(deviceId)` and capture constraints passed to `enable()`. Microphone, camera and screen `mute()`/`unmute()` return promises: await them to confirm the server publication state and handle failures. They keep capture open; disable/stop releases it. Screen audio depends on browser support and the selected capture source.

## Local camera preview

```tsx
import { useEffect, useRef } from 'react'
import { useLocalMedia } from '@relayrtc/react'

export function CameraPreview() {
  const { camera } = useLocalMedia()
  const ref = useRef<HTMLVideoElement>(null)
  const track = camera?.track
  useEffect(() => {
    const element = ref.current
    if (!element || !track) return
    const stream = new MediaStream([track])
    element.srcObject = stream
    return () => {
      if (element.srcObject === stream) element.srcObject = null
    }
  }, [track])
  return <video ref={ref} autoPlay muted playsInline />
}
```

The SDK owns capture tracks. Clear your preview on cleanup; use SDK media controls to stop capture.

## Participants

```tsx
import { useParticipants } from '@relayrtc/react'

export function Participants() {
  const participants = useParticipants()
  return <ul>{participants.map((participant) => (
    <li key={participant.id}>{participant.name}</li>
  ))}</ul>
}
```

`useParticipants()` includes the local participant and all remote participants once each. Use `{ includeLocal: false }` for only remote participants. `useLocalParticipant()` returns the local participant with microphone, camera, screen, devices, permissions and metadata controls, or `null` before joining.

Update the local participant's metadata with `await local.updateMetadata({ ... })`. Metadata updates replace the object; preserve existing fields explicitly when needed.

## Remote audio and video

```tsx
import { useEffect, useRef, useState } from 'react'
import { useTracks, type RoomRemoteTrack } from '@relayrtc/react'

export function RemoteTracks() {
  const tracks = useTracks()
  return <div>{tracks.map((track) => <RemoteMedia key={track.id} track={track} />)}</div>
}

function RemoteMedia({ track }: { track: RoomRemoteTrack }) {
  const ref = useRef<HTMLMediaElement | null>(null)
  const [error, setError] = useState<string | null>(null)
  const state = track.subscriptionState
  useEffect(() => {
    const element = ref.current
    if (!element || track.type === 'data') return
    let active = true
    setError(null)
    void track.attach(element).catch((value: unknown) => {
      if (active) setError(value instanceof Error ? value.message : 'Could not play media')
    })
    return () => {
      active = false
      track.detach(element)
    }
  }, [track, state])
  if (track.type === 'data') return null
  const audio = track.type === 'audio' || track.type === 'screen_audio'
  return (
    <div>
      {audio
        ? <audio ref={(element) => { ref.current = element }} autoPlay controls />
        : <video ref={(element) => { ref.current = element }} autoPlay playsInline controls />}
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
```

`useTracks()` returns remote tracks and rerenders on publication, updates and subscription changes. Filter with `participantId`, `types`, or `subscribedOnly`. Camera video uses `camera_video`; screen video uses `screen_video`. Audio tracks need an audio element to play. Autoplay restrictions may require user interaction.

`attach()` subscribes when necessary. `detach()` removes an element binding. Use `unsubscribe()` explicitly to stop receiving a track. When using `autoSubscribe: false`, render all selected published tracks or call `subscribe()` yourself; filtering only subscribed tracks before subscribing would hide them.

## Chat messages

```tsx
import { useState } from 'react'
import { useMessages, useRoom } from '@relayrtc/react'

export function Chat() {
  const { room } = useRoom()
  const { messages, send, clear } = useMessages()
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  return (
    <form onSubmit={(event) => {
      event.preventDefault()
      setError(null)
      void send(text).then(() => setText('')).catch((value: unknown) => {
        setError(value instanceof Error ? value.message : 'Could not send message')
      })
    }}>
      <ul>{messages.map((message) => <li key={message.messageId}>{message.text}</li>)}</ul>
      <input value={text} maxLength={4000} onChange={(event) => setText(event.target.value)} />
      <button disabled={!room || !text.trim()}>Send</button>
      <button type="button" onClick={clear}>Clear history</button>
      {error && <p role="alert">{error}</p>}
    </form>
  )
}
```

History combines received messages and successful local sends, deduplicated by `messageId`. It retains the last 100 messages by default; set `messageHistoryLimit` on the provider from 0 to 10000. History resets on a new join and survives reconnects and leaving until the next join or `clear()`. It is local memory, not persistent server history.

Custom application events use `room.events.emit(name, data)` and `room.events.subscribe(listener)`. Return the subscription's cleanup function from your effect. They are distinct from chat messages.

## Connection quality

```tsx
import { useConnectionQuality } from '@relayrtc/react'

export function ConnectionQuality() {
  const { quality, stats, participantQualities } = useConnectionQuality()
  return (
    <div>
      <p>{quality ?? 'Waiting for quality'}</p>
      <p>RTT: {stats?.roundTripTime == null ? 'Unavailable' : `${Math.round(stats.roundTripTime * 1000)} ms`}</p>
      <ul>{[...participantQualities].map(([id, event]) => (
        <li key={id}>{id}: {event.quality}</li>
      ))}</ul>
    </div>
  )
}
```

Quality states are `excellent`, `good`, `poor`, `critical`, and `lost`. Diagnostics can be unavailable. RTT and jitter use seconds; bitrates use bits per second; packet loss ratio uses 0–1. Stats contain optional per-stream diagnostics. Reconnecting keeps the room and publishes the browser SDK's current quality state. Leaving clears quality state.

Choose a receive preference on an individual remote video track:

```tsx
import { useState } from 'react'
import type { RoomRemoteTrack } from '@relayrtc/react'

export function VideoPreference({ track }: { track: RoomRemoteTrack }) {
  const [error, setError] = useState<string | null>(null)
  const video = track.type === 'camera_video' || track.type === 'screen_video'
  return (
    <div>
      {(['auto', '1080p', '720p', '360p', 'audio-only'] as const).map((quality) => (
        <button key={quality} disabled={!video} onClick={() => {
          setError(null)
          void track.setQuality(quality).catch((value: unknown) => {
            setError(value instanceof Error ? value.message : 'Could not change preference')
          })
        }}>{quality}</button>
      ))}
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
```

Preferences cap receive quality within the available layers and shared subscriber bandwidth. They do not guarantee a resolution. `audio-only` suppresses that video track; separate audio tracks continue normally. The SDK does not expose a room-wide quality-mode setter.

## Devices, permissions and credential renewal

Use `room.devices.enumerate()` to list available cameras and microphones, and `room.devices.subscribe(listener)` to observe device changes. Use `room.permissions.get()` and `room.permissions.request()` to inspect or request capture permissions. Input selection uses `microphone.switchDevice(id)` or `camera.switchDevice(id)`.

```tsx
import { useEffect, useState } from 'react'
import { useLocalParticipant, type MediaInputDevice } from '@relayrtc/react'

export function CameraSelector() {
  const local = useLocalParticipant()
  const [cameras, setCameras] = useState<readonly MediaInputDevice[]>([])
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!local) {
      setCameras([])
      return
    }
    let active = true
    const off = local.devices.subscribe((snapshot) => {
      if (active) setCameras(snapshot.cameras)
    })
    void local.devices.enumerate().then((snapshot) => {
      if (active) setCameras(snapshot.cameras)
    }).catch((value: unknown) => {
      if (active) setError(value instanceof Error ? value.message : 'Could not list cameras')
    })
    return () => {
      active = false
      off()
    }
  }, [local])
  return (
    <div>
      {cameras.map((device) => (
        <button key={device.deviceId} onClick={() => {
          setError(null)
          void local?.camera.switchDevice(device.deviceId).catch((value: unknown) => {
            setError(value instanceof Error ? value.message : 'Could not switch camera')
          })
        }}>{device.label || 'Camera'}</button>
      ))}
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
```

Microphone selection uses `snapshot.microphones` and `local.microphone.switchDevice()`. Device labels may be unavailable before capture permission is granted.

Pass browser-client options directly to `RelayProvider`: `autoSubscribe`, `requestTimeoutMs`, `reconnect`, `iceServers`, `iceTransportPolicy`, `turnCredentials`, `refreshToken`, `refreshTurnCredentials`, and `credentialRefreshMarginMs`. The browser SDK owns reconnection and media recovery.

```tsx
import { RelayProvider, RelayRoom } from '@relayrtc/react'

export function RenewableCall({ token }: { token: string }) {
  return (
    <RelayProvider
      signalingUrl="wss://rtc.example.com"
      refreshToken={async (context) => {
        const response = await fetch('/api/rtc/renew', {
          method: 'POST',
          signal: context.signal,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ roomId: context.roomId, sessionId: context.sessionId }),
        })
        if (!response.ok) throw new Error('Token renewal failed')
        const result: { token: string } = await response.json()
        return result.token
      }}
      refreshTurnCredentials={async (context) => {
        const response = await fetch('/api/rtc/turn', {
          method: 'POST',
          signal: context.signal,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ roomId: context.roomId, sessionId: context.sessionId }),
        })
        if (!response.ok) throw new Error('TURN renewal failed')
        return response.json()
      }}
    >
      <RelayRoom token={token} onError={console.error}>
        <p>Your call interface</p>
      </RelayRoom>
    </RelayProvider>
  )
}
```

These `/api/rtc/...` endpoints belong to your application. Use Node SDK `tokens.renew` on the authorized backend, storing each replacement as the current token. The token-create endpoint creates a new identity and must not be used for renewal. The React wrapper applies the returned token to the existing session; temporary retryable failures retry before expiry, and `null` denies renewal. TURN refresh uses the scoped credential endpoint through your authorized backend. Both require caller/session authorization.

## Custom events and room subscriptions

```tsx
import { useEffect, useState } from 'react'
import { useRoom } from '@relayrtc/react'

export function HandRaise() {
  const { room } = useRoom()
  const [raisedBy, setRaisedBy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    setRaisedBy(null)
    if (!room) return
    return room.events.subscribe((event) => {
      if (event.name === 'hand.raise') setRaisedBy(event.participantId)
    })
  }, [room])
  return (
    <div>
      <button disabled={!room} onClick={() => {
        setError(null)
        void room?.events.emit('hand.raise', { raised: true }).catch((value: unknown) => {
          setError(value instanceof Error ? value.message : 'Could not raise hand')
        })
      }}>Raise hand</button>
      {raisedBy && <p>{raisedBy} raised their hand</p>}
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
```

Subscribe to `customEventSent` as well if your UI needs local acknowledgments. Use `room.on()` for room events such as `reconnectAttempt`, `reconnected`, `connectionDegraded`, and `connectionRecovered`. Every subscription returns a cleanup function.

```tsx
import { useEffect } from 'react'
import { useRoom } from '@relayrtc/react'

export function RecoveryEvents() {
  const { room } = useRoom()
  useEffect(() => {
    if (!room) return
    const offAttempt = room.on('reconnectAttempt', console.log)
    const offRecovered = room.on('reconnected', console.log)
    return () => {
      offAttempt()
      offRecovered()
    }
  }, [room])
  return null
}
```

## Hook reference

| Hook | Returns |
| --- | --- |
| `useRoom()` | `room`, `client`, `connectionState`, `error`, `join`, `leave`, `clearError` |
| `useParticipants(options?)` | Local and remote participant array; optionally remote only |
| `useLocalParticipant()` | Local participant and its controls, or `null` |
| `useTracks(options?)` | Filtered remote track array |
| `useMessages()` | Bounded `messages`, async `send`, and `clear` |
| `useConnectionQuality()` | Local `quality`, `stats`, and participant quality map |
| `useLocalMedia()` | Reactive microphone, camera and screen snapshots |

Hooks and `RelayRoom` require `RelayProvider`; misuse throws a clear error. Snapshots are cached between events and arrays/maps are replaced on updates, so browser SDK mutations trigger React renders. Media capture subscriptions update local controls without requiring a participant metadata change.

React Strict Mode cleanup cancels pending joins, removes subscriptions, and leaves the owned browser client. Each subsequent join has a separate client and stale completions are ignored. Consumer compilation, Strict Mode behavior, real browser calls and publication remain unverified until the requested checks are run.

Server room administration, token issuance, webhook configuration and usage queries belong to the [Node.js SDK](https://github.com/relayrtc/node-sdk).

## Private streaming playback (unreleased)

`BroadcastPlayer` and `useStreamPlayback` are independent of `RelayProvider`/`RelayRoom`. Use the matching local Phase 0 browser-client 0.0.0 build with this React 0.1.0 draft. Development uses the local browser package link; existing published packages may not export these APIs.

```tsx
import { BroadcastPlayer } from '@relayrtc/react'

// Keep these callbacks stable and authorize the caller on your application backend.
const source = {
  getPlayback: async (signal: AbortSignal) => {
    const response = await fetch('/app-api/playback', { signal, cache: 'no-store' })
    if (!response.ok) throw new Error('Playback unavailable')
    return response.json()
  },
  getGrant: async (signal: AbortSignal) => {
    const response = await fetch('/app-api/grant', { method: 'POST', signal, cache: 'no-store' })
    if (!response.ok) throw new Error('Viewing access unavailable')
    return response.json()
  },
}
// Native HLS where supported; pass createHlsEngine for other browsers.
<BroadcastPlayer source={source} muted controls />
```

Metadata includes streamId/sourceSessionId/generation/state. Grants include url/expiresAt. The player polls at five seconds, renews grants before expiry, reloads source generations, handles blocked autoplay and missing media, and clears polling/network/media resources on unmount. An optional `HlsEngineFactory(media, url, onError, onReady)` returns engine teardown. The runnable local `examples/streaming-foundation/` includes an hls.js adapter. No HLS dependency is forced on applications using native playback.

TypeScript compilation was checked for this streaming addition. Real media interoperability still requires a configured deployment; compilation does not establish live playback.
