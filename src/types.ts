import type { RoomCapabilities, ParticipantAccess, UpdateParticipantAccess } from "@relayrtc/client";
import type {
  JoinOptions,
  RelayClient,
  RelayClientOptions,
  Room,
  RoomConnectionState,
  RoomError,
  RoomInputSnapshot,
  RoomLocalParticipant,
  RoomRemoteParticipant,
  RoomRemoteTrack,
  RoomScreenSnapshot,
  RoomTextMessage,
} from '@relayrtc/client'
import type { HTMLAttributes, ReactNode, RefCallback } from 'react'

export type RelayParticipant = RoomLocalParticipant | RoomRemoteParticipant

export interface RelayProviderProps extends RelayClientOptions {
  readonly children?: ReactNode
  readonly messageHistoryLimit?: number
  readonly onError?: (error: RoomError) => void
}

export interface RelayRoomProps {
  readonly children?: ReactNode
  readonly token: string | null | undefined
  readonly connect?: boolean
  readonly onConnected?: (room: Room) => void
  readonly onDisconnected?: () => void
  readonly onError?: (error: RoomError) => void
}

export interface UseRoomResult {
  readonly room: Room | null
  readonly client: RelayClient | null
  readonly connectionState: RoomConnectionState
  readonly error: RoomError | null
  readonly join: (token: string, options?: JoinOptions) => Promise<Room>
  readonly leave: () => Promise<void>
  readonly clearError: () => void
}

export interface UseParticipantsOptions {
  readonly includeLocal?: boolean
}

export interface UseTracksOptions {
  readonly participantId?: string
  readonly types?: readonly RoomRemoteTrack['type'][]
  readonly subscribedOnly?: boolean
}

export interface UseMessagesResult {
  readonly messages: readonly RoomTextMessage[]
  readonly send: (text: string) => Promise<RoomTextMessage>
  readonly clear: () => void
}

export interface UseConnectionQualityResult {
  readonly quality: Room['quality']
  readonly stats: Room['qualityStats']
  readonly participantQualities: Room['participantQualities']
}

export interface UseRoomAccessResult {
  readonly capabilities: RoomCapabilities | null
  readonly get: (participantId: string) => Promise<ParticipantAccess>
  readonly update: (participantId: string, input: UpdateParticipantAccess) => Promise<ParticipantAccess>
}

export interface UseLocalMediaResult {
  readonly microphone: RoomInputSnapshot | null
  readonly camera: RoomInputSnapshot | null
  readonly screen: RoomScreenSnapshot | null
}

export type MediaPlaybackState = 'idle' | 'loading' | 'playing' | 'paused' | 'blocked' | 'failed' | 'ended'

export interface UseMediaTrackOptions {
  readonly enabled?: boolean
  readonly paused?: boolean
}

export interface UseMediaTrackResult {
  readonly ref: RefCallback<HTMLMediaElement>
  readonly state: MediaPlaybackState
  readonly isLoading: boolean
  readonly isPaused: boolean
  readonly error: Error | null
  readonly play: () => Promise<void>
}

export interface MediaLoaderProps extends HTMLAttributes<HTMLDivElement> {
  readonly label?: string
}

export interface RelaySnapshot extends UseLocalMediaResult, UseConnectionQualityResult {
  readonly activity:import('@relayrtc/client').RoomActivitySnapshot|null
  readonly lifecycle: import('@relayrtc/client').RoomLifecycle | null
  readonly capabilities: RoomCapabilities | null
  readonly room: Room | null
  readonly client: RelayClient | null
  readonly connectionState: RoomConnectionState
  readonly error: RoomError | null
  readonly localParticipant: RoomLocalParticipant | null
  readonly participants: readonly RelayParticipant[]
  readonly tracks: readonly RoomRemoteTrack[]
  readonly messages: readonly RoomTextMessage[]
}
