# Changelog

## 0.1.4

### Phase 3 - speakers, activity and push-to-talk

Add `useRoomActivity`, `useActiveSpeakers`, `usePushToTalk` and `PushToTalkButton`, with provider snapshots, privacy preferences and lifecycle cleanup. Requires compatible updated browser SDK and services.

### Phase 2 - room admission and lifecycle

Add `useRoomLifecycle` with provider snapshots and server-clock-adjusted countdowns, and `useRoomInvitations` with application backend callbacks, cancellation, pending and error state. Requires the matching 0.1.4 browser client and signaling builds.

### Phase 1 - room access

Add `useRoomAccess` with provider-backed capability updates and participant-authorized access operations. Requires the 0.1.4 browser client.

## 0.1.2

- Add streaming status hooks, private playback, DVR controls, recording indicators and guest-stage hooks.
- Expose playback readiness, credential refresh context and HLS playback configuration.
- Require a compatible 0.1.2 browser client and remove the sibling development link.
