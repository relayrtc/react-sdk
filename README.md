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
