'use client'

import { useMemo } from 'react'
import { RoomError } from '@relayrtc/client'
import type { RoomLocalParticipant, RoomRemoteTrack } from '@relayrtc/client'
import { useRelaySnapshot, useRelayStore } from './context.js'
import type {
  UseRoomAccessResult,
  RelayParticipant,
  UseConnectionQualityResult,
  UseLocalMediaResult,
  UseMessagesResult,
  UseParticipantsOptions,
  UseRoomResult,
  UseTracksOptions,
} from './types.js'

export function useRoom(): UseRoomResult {
  const store = useRelayStore()
  const { room, client, connectionState, error } = useRelaySnapshot()
  return useMemo(() => ({
    room, client, connectionState, error,
    join: store.join, leave: store.leave, clearError: store.clearError,
  }), [store, room, client, connectionState, error])
}

export function useParticipants(options: UseParticipantsOptions = {}): readonly RelayParticipant[] {
  const { participants, localParticipant } = useRelaySnapshot()
  const includeLocal = options.includeLocal ?? true
  return useMemo(() => includeLocal
    ? participants
    : participants.filter((participant) => participant.id !== localParticipant?.id),
  [participants, localParticipant, includeLocal])
}

export function useLocalParticipant(): RoomLocalParticipant | null {
  return useRelaySnapshot().localParticipant
}

export function useTracks(options: UseTracksOptions = {}): readonly RoomRemoteTrack[] {
  const { tracks } = useRelaySnapshot()
  const { participantId, types, subscribedOnly = false } = options
  return useMemo(() => tracks.filter((track) =>
    (!participantId || track.participantId === participantId)
    && (!types || types.includes(track.type))
    && (!subscribedOnly || track.subscriptionState === 'subscribed')),
  [tracks, participantId, types, subscribedOnly])
}

export function useMessages(): UseMessagesResult {
  const store = useRelayStore()
  const { messages } = useRelaySnapshot()
  return useMemo(() => ({ messages, send: store.sendMessage, clear: store.clearMessages }),
    [store, messages])
}

export function useConnectionQuality(): UseConnectionQualityResult {
  const { quality, stats, participantQualities } = useRelaySnapshot()
  return useMemo(() => ({ quality, stats, participantQualities }),
    [quality, stats, participantQualities])
}

export function useLocalMedia(): UseLocalMediaResult {
  const { microphone, camera, screen } = useRelaySnapshot()
  return useMemo(() => ({ microphone, camera, screen }), [microphone, camera, screen])
}

export function useRoomAccess(): UseRoomAccessResult {
  const { room, capabilities } = useRelaySnapshot()
  return useMemo(() => ({
    capabilities,
    get: async participantId => {
      if (!room) throw new RoomError('NOT_CONNECTED', 'Join a room before reading access')
      return room.access.get(participantId)
    },
    update: async (participantId, input) => {
      if (!room) throw new RoomError('NOT_CONNECTED', 'Join a room before changing access')
      return room.access.update(participantId, input)
    },
  }), [room, capabilities])
}
