import { RelayClient, RoomError } from '@relayrtc/client'
import type { JoinOptions, Room, RoomEvents, RoomTextMessage } from '@relayrtc/client'
import type { RelayProviderProps, RelaySnapshot } from './types.js'

const initialSnapshot = (): RelaySnapshot => ({
  capabilities: null,
  activity:null,
  lifecycle: null,
  room: null,
  client: null,
  connectionState: 'disconnected',
  error: null,
  localParticipant: null,
  participants: [],
  tracks: [],
  messages: [],
  quality: null,
  stats: null,
  participantQualities: new Map(),
  microphone: null,
  camera: null,
  screen: null,
})

const normalizeError = (error: unknown): RoomError => error instanceof RoomError
  ? error
  : new RoomError('CONNECTION_FAILED', error instanceof Error ? error.message : 'RTC operation failed')

const refreshEvents = [
  'participantJoined', 'participantLeft', 'participantUpdated', 'participantReconnected',
  'localParticipantUpdated', 'presenceChanged', 'trackPublished', 'trackUnpublished',
  'trackUpdated', 'trackSubscribed', 'trackUnsubscribed', 'trackSubscriptionFailed',
  'connectionQualityChanged', 'connectionDegraded', 'connectionRecovered',
  'capabilitiesChanged', 'lifecycleChanged', 'activityChanged', 'qualityStatsUpdated', 'reconnected', 'credentialsRefreshed',
] as const satisfies readonly (keyof RoomEvents)[]

export class RelayStore {
  readonly #getOptions: () => RelayProviderProps
  readonly #listeners = new Set<() => void>()
  readonly #serverSnapshot = initialSnapshot()
  #snapshot = this.#serverSnapshot
  #client: RelayClient | null = null
  #room: Room | null = null
  #controller: AbortController | null = null
  #cleanups: Array<() => void> = []
  #generation = 0
  #owner: symbol | null = null
  #closing: Promise<void> = Promise.resolve()

  constructor(getOptions: () => RelayProviderProps) {
    this.#getOptions = getOptions
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener)
    return () => { this.#listeners.delete(listener) }
  }

  readonly getSnapshot = (): RelaySnapshot => this.#snapshot
  readonly getServerSnapshot = (): RelaySnapshot => this.#serverSnapshot

  readonly clearError = (): void => {
    this.#publish({ ...this.#snapshot, error: null })
  }

  readonly clearMessages = (): void => {
    this.#publish({ ...this.#snapshot, messages: [] })
  }

  claim(owner: symbol): void {
    if (this.#owner && this.#owner !== owner) {
      throw new Error('Mount only one RelayRoom inside each RelayProvider')
    }
    this.#owner = owner
  }

  release(owner: symbol): void {
    if (this.#owner !== owner) return
    this.#owner = null
    this.dispose()
  }

  readonly join = async (token: string, options: JoinOptions = {}): Promise<Room> => {
    if (this.#client || this.#controller) {
      const error = new RoomError('ALREADY_JOINED', 'Leave the current room before joining another room')
      this.#publish({ ...this.#snapshot, error })
      throw error
    }
    if (options.signal?.aborted) {
      throw new RoomError('JOIN_CANCELLED', 'Joining the room was cancelled')
    }
    const generation = ++this.#generation
    const controller = new AbortController()
    const abort = (): void => { controller.abort() }
    options.signal?.addEventListener('abort', abort, { once: true })
    this.#controller = controller
    this.#publish({ ...initialSnapshot(), connectionState: 'connecting' })
    let client: RelayClient | null = null
    try {
      await this.#closing
      if (generation !== this.#generation || controller.signal.aborted) {
        throw new RoomError('JOIN_CANCELLED', 'Joining the room was cancelled')
      }
      const { children, messageHistoryLimit, onError, ...clientOptions } = this.#getOptions()
      void children
      void messageHistoryLimit
      void onError
      client = new RelayClient(clientOptions)
      this.#client = client
      this.#publish({ ...this.#snapshot, client })
      const current = (): boolean => generation === this.#generation
      this.#cleanups.push(client.on('connectionStateChanged', (connectionState) => {
        if (!current()) return
        if (connectionState === 'disconnected' || connectionState === 'failed') {
          this.#room = null
          this.#client = null
          this.#controller = null
          this.#removeSubscriptions()
        }
        this.#refresh({ connectionState })
      }))
      this.#cleanups.push(client.on('error', (error) => {
        if (current()) this.#publish({ ...this.#snapshot, error })
      }))
      for (const event of refreshEvents) {
        this.#cleanups.push(client.on(event, () => { if (current()) this.#refresh() }))
      }
      for (const event of ['messageReceived', 'messageSent'] as const) {
        this.#cleanups.push(client.on(event, (message) => {
          if (current()) this.#addMessage(message)
        }))
      }
      const room = await client.join(token, { signal: controller.signal })
      if (!current() || controller.signal.aborted) {
        await this.#close(client)
        throw new RoomError('JOIN_CANCELLED', 'Joining the room was cancelled')
      }
      this.#room = room
      this.#controller = null
      for (const control of [room.microphone, room.camera, room.screen]) {
        this.#cleanups.push(control.subscribe(() => { if (current()) this.#refresh() }))
      }
      this.#refresh({ error: null })
      return room
    } catch (error) {
      const failure = normalizeError(error)
      if (generation === this.#generation) {
        this.#client = null
        this.#room = null
        this.#controller = null
        this.#removeSubscriptions()
        this.#publish({
          ...initialSnapshot(),
          connectionState: controller.signal.aborted ? 'disconnected' : 'failed',
          error: controller.signal.aborted ? null : failure,
        })
      }
      if (client) await this.#close(client).catch(() => undefined)
      throw failure
    } finally {
      options.signal?.removeEventListener('abort', abort)
    }
  }

  readonly leave = async (): Promise<void> => {
    const client = this.#client
    const generation = ++this.#generation
    this.#controller?.abort()
    this.#controller = null
    this.#client = null
    this.#room = null
    this.#removeSubscriptions()
    this.#publish({ ...initialSnapshot(), messages: this.#snapshot.messages })
    try {
      await this.#close(client)
    } catch (error) {
      const failure = normalizeError(error)
      if (generation === this.#generation) {
        this.#publish({ ...this.#snapshot, error: failure })
      }
      throw failure
    }
  }

  dispose(): void {
    void this.leave().catch(() => undefined)
  }

  readonly sendMessage = async (text: string): Promise<RoomTextMessage> => {
    const room = this.#room
    if (!room) throw new RoomError('NOT_CONNECTED', 'Join a room before sending messages')
    const generation = this.#generation
    try {
      const message = await room.messages.send(text)
      if (generation === this.#generation) this.#addMessage(message)
      return message
    } catch (error) {
      const failure = normalizeError(error)
      if (generation === this.#generation) this.#publish({ ...this.#snapshot, error: failure })
      throw failure
    }
  }

  #addMessage(message: RoomTextMessage): void {
    const limit = this.#getOptions().messageHistoryLimit ?? 100
    if (limit === 0 || this.#snapshot.messages.some((item) => item.messageId === message.messageId)) return
    this.#publish({ ...this.#snapshot, messages: [...this.#snapshot.messages, message].slice(-limit) })
  }

  #refresh(overrides: Partial<RelaySnapshot> = {}): void {
    const room = this.#room
    const localParticipant = room?.localParticipant ?? null
    const participants = room
      ? [room.localParticipant, ...room.participants.values()]
      : []
    const participantIds = new Set<string>(participants.map((participant) => participant.id))
    const participantQualities = new Map(room?.participantQualities)
    for (const id of participantQualities.keys()) {
      if (!participantIds.has(id)) participantQualities.delete(id)
    }
    this.#publish({
      ...this.#snapshot,
      room,
      client: this.#client,
      connectionState: this.#client?.connectionState ?? this.#snapshot.connectionState,
      localParticipant,
      participants,
      tracks: room ? [...room.remoteTracks.values()] : [],
      quality: room?.quality ?? null,
      stats: room?.qualityStats ?? null,
      participantQualities,
      microphone: room?.microphone.current ?? null,
      camera: room?.camera.current ?? null,
      screen: room?.screen.current ?? null,
      capabilities: room?.access.current ?? null,
      activity:room?.activity.current??null,
      lifecycle: room?.lifecycle.current ?? null,
      ...overrides,
    })
  }

  #publish(snapshot: RelaySnapshot): void {
    this.#snapshot = snapshot
    for (const listener of this.#listeners) listener()
  }

  #removeSubscriptions(): void {
    const cleanups = this.#cleanups
    this.#cleanups = []
    for (const cleanup of cleanups) cleanup()
  }

  #close(client: RelayClient | null): Promise<void> {
    const operation = client?.leave() ?? Promise.resolve()
    this.#closing = Promise.allSettled([this.#closing, operation]).then(() => undefined)
    return operation
  }
}
