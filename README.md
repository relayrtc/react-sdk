# RelayRTC React SDK

React providers, hooks and media components for RelayRTC calls and streaming. Built on `@relayrtc/client`, with application-owned layouts and controls.

Requires **React 18.3.1 or 19** and a compatible browser client. Media capture needs HTTPS or localhost and browser permission. See [installation and compatibility](https://docs.relayrtc.com/installation) before choosing package versions.

## Install

In your existing React application:

```sh
npm install @relayrtc/react @relayrtc/client
```

Connect to an existing RelayRTC deployment. Your backend issues a participant token for each authorized caller using the [Node SDK](https://docs.relayrtc.com/reference/sdk/server/node/overview). Keep secret API keys on that backend.

## Join a room

Pass the participant token and your deployment's browser-reachable signaling URL to this component. In Next.js, keep it in a client module.

```tsx
'use client'

import { useState } from 'react'
import { RelayProvider, RelayRoom, useRoom } from '@relayrtc/react'

export function Call({ token, signalingUrl }: { token: string; signalingUrl: string }) {
  return <RelayProvider signalingUrl={signalingUrl}>
    <RelayRoom token={token}>
      <CallControls />
    </RelayRoom>
  </RelayProvider>
}

function CallControls() {
  const { room, connectionState, error, leave } = useRoom()
  const [captureError, setCaptureError] = useState('')

  async function enableMicrophone() {
    if (!room) return
    setCaptureError('')
    try {
      await room.microphone.enable()
    } catch (failure) {
      setCaptureError(failure instanceof Error ? failure.message : 'Microphone unavailable')
    }
  }

  return <section>
    <p role="status">{connectionState}</p>
    <button disabled={!room} onClick={() => { void enableMicrophone() }}>Enable microphone</button>
    <button disabled={!room} onClick={() => { void leave().catch(console.error) }}>Leave</button>
    {(captureError || error) && <p role="alert">{captureError || error?.message}</p>}
  </section>
}
```

Joining does not activate devices. This example enables the microphone only after a click and requires `audio:publish` permission. Add local previews and remote audio/video playback with the [first-call guide](https://docs.relayrtc.com/quickstart) and [media track hook](https://docs.relayrtc.com/reference/sdk/client/react/hooks/useMediaTrack). Leaving or unmounting releases the owned room connection and capture resources.

## Developing the unreleased 0.1.4 source

This GitHub snapshot targets `@relayrtc/client@^0.1.4`. Until that browser SDK version is published, a fresh registry installation cannot resolve the new dependency. The checked-in registry lockfile still describes the previous published dependency set. It must be refreshed with `pnpm install --no-frozen-lockfile --ignore-scripts` after the browser SDK and its shared packages are published, then committed before publishing this React SDK. Local type validation for this snapshot uses the matching local browser SDK build.

## Documentation

- [React SDK reference](https://docs.relayrtc.com/reference/sdk/client/react/overview)
- [Camera and microphone controls](https://docs.relayrtc.com/guides/camera-and-microphone)
- [Screen sharing](https://docs.relayrtc.com/guides/screen-sharing)
- [Messages and events](https://docs.relayrtc.com/guides/messages-and-events)
- [Connection recovery and credential renewal](https://docs.relayrtc.com/guides/connection-recovery)
- [Private streaming playback](https://docs.relayrtc.com/reference/sdk/client/react/broadcast-player)

Room hooks read the nearest `RelayProvider`. Streaming status/player hooks use application-authorized backend callbacks and can operate independently of an RTC provider; see each hook's reference for its lifecycle and requirements.

## Support and license

Report SDK bugs in [GitHub Issues](https://github.com/relayrtc/react-sdk/issues). Include package/browser versions and a minimal reproduction; remove API keys, participant tokens and private media URLs.

Licensed under [Apache-2.0](LICENSE).

## Room access

Version 0.1.4 adds `useRoomAccess()`, which returns effective local capabilities and participant-authorized `get`/`update` operations through the active provider room. Use compatible updated browser/React SDKs and services. See [room policy](https://docs.relayrtc.com/guides/room-roles-and-permissions) for role boundaries and live revocation.
## Room admission and lifecycle

Version 0.1.4 adds `useRoomLifecycle()` with policy, countdown and versioned operations, plus `useRoomInvitations(backend)` for authenticated application callbacks. Pending invitation operations abort on unmount or backend replacement. Use browser/React SDKs at 0.1.4 and updated services. See [room admission](https://docs.relayrtc.com/guides/room-admission-and-lifecycle).
## Speakers, activity and push-to-talk

Version 0.1.4 adds `useRoomActivity`, `useActiveSpeakers`, `usePushToTalk` and `PushToTalkButton`. Use a single hold controller per room microphone. Keyboard shortcuts avoid editable targets, and release/visibility/disconnect cleanup keeps the microphone muted. See [speakers and activity](https://docs.relayrtc.com/guides/speakers-activity-and-push-to-talk). Requires browser/React SDKs at 0.1.4 and updated services.
