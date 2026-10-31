'use client'

import { useEffect,useMemo,useState,useRef,useCallback } from 'react'
import { RoomError } from '@relayrtc/client'
import type {UpdateRoomLifecycle,RoomInvitationBackend} from '@relayrtc/client'
import {useRelaySnapshot} from './context.js'

export function useRoomLifecycle() {
  const {room,lifecycle:policy}=useRelaySnapshot()
  const [now,setNow]=useState(Date.now())
  const [offset,setOffset]=useState(0)
  useEffect(()=>{
    setOffset(policy?Date.parse(policy.serverTime)-Date.now():0)
    setNow(Date.now())
  },[policy])
  useEffect(()=>{
    if(!policy?.endsAt)return
    const timer=setInterval(()=>setNow(Date.now()),1000)
    return ()=>clearInterval(timer)
  },[policy?.endsAt])
  return useMemo(()=>({
    policy,
    remainingSeconds:policy?.endsAt?Math.max(0,Math.ceil((Date.parse(policy.endsAt)-now-offset)/1000)):null,
    get:async()=>{
      if(!room)throw new RoomError('NOT_CONNECTED','Join a room before reading its lifecycle')
      return room.lifecycle.get()
    },
    update:async(input:UpdateRoomLifecycle)=>{
      if(!room)throw new RoomError('NOT_CONNECTED','Join a room before changing its lifecycle')
      return room.lifecycle.update(input)
    },
  }),[room,policy,now,offset])
}

export function useRoomInvitations(backend:RoomInvitationBackend) {
  const [pending,setPending]=useState(false)
  const [error,setError]=useState<Error|null>(null)
  const controller=useRef<AbortController|null>(null)
  useEffect(()=>{setPending(false);setError(null);return ()=>{controller.current?.abort();controller.current=null}},[backend])
  const run=useCallback(async<T,>(task:(signal:AbortSignal)=>Promise<T>)=>{
    if(controller.current)throw new Error('An invitation operation is already pending')
    const active=new AbortController()
    controller.current=active
    setPending(true)
    setError(null)
    try{return await task(active.signal)}catch(cause){
      if(!active.signal.aborted)setError(cause instanceof Error?cause:new Error('Invitation request failed'))
      throw cause
    }finally{
      if(controller.current===active){controller.current=null;setPending(false)}
    }
  },[backend])
  return useMemo(()=>({pending,error,
    create:(input:Parameters<RoomInvitationBackend['create']>[0])=>run(signal=>backend.create(input,signal)),
    list:(cursor?:string)=>run(signal=>backend.list(cursor,signal)),
    revoke:(invitationId:string)=>run(signal=>backend.revoke(invitationId,signal)),
    redeem:(input:Parameters<RoomInvitationBackend['redeem']>[0])=>run(signal=>backend.redeem(input,signal)),
  }),[backend,pending,error,run])
}
