import { useEffect, useRef } from 'react'
import type { RecordModel, RecordSubscription } from 'pocketbase'

import pb from '@/lib/pocketbase/client'

/**
 * Hook for real-time subscriptions to a PocketBase collection.
 * ALWAYS use this hook instead of subscribing inline.
 * Uses the per-listener UnsubscribeFunc so multiple components
 * can safely subscribe to the same collection without conflicts.
 *
 * Generic over the record type: pass your collection's interface as
 * `useRealtime<MyRecord>(...)` to get a typed subscription payload
 * instead of `unknown`.
 *
 * Erros de conexão do EventSource (queda momentânea de SSE, servidor
 * reiniciando, rede instável) são NORMAIS e temporários: o próprio SDK
 * já tenta reconectar com backoff. Por isso este hook NUNCA propaga
 * esses erros — eles são apenas logados no console — e reregistra a
 * inscrição automaticamente caso a conexão inicial falhe, para que as
 * atualizações em tempo real voltem quando o SSE se restabelecer.
 * A página que usa o hook continua funcionando só com a busca inicial
 * via API, mesmo sem realtime.
 */

const RETRY_DELAYS_MS = [1000, 2000, 4000, 8000, 15000]

export function useRealtime<TRecord extends RecordModel = RecordModel>(
  collectionName: string,
  callback: (data: RecordSubscription<TRecord>) => void,
  enabled: boolean = true,
) {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    if (!enabled) return

    let unsubscribeFn: (() => Promise<void>) | undefined
    let cancelled = false
    let retryTimeoutId: ReturnType<typeof setTimeout> | undefined
    let retryAttempt = 0

    const scheduleRetry = () => {
      if (cancelled) return
      const delay = RETRY_DELAYS_MS[Math.min(retryAttempt, RETRY_DELAYS_MS.length - 1)]
      retryAttempt += 1
      retryTimeoutId = setTimeout(subscribe, delay)
    }

    const subscribe = () => {
      if (cancelled) return
      pb.collection<TRecord>(collectionName)
        .subscribe('*', (data) => {
          // Nunca deixar um erro do callback virar exceção não tratada:
          // o EventSource entrega eventos de handshake/reconexão com payload
          // vazio (`{}`) e um throw dentro do listener quebra a página inteira.
          try {
            callbackRef.current(data)
          } catch (err) {
            console.warn(`[realtime] erro no callback de "${collectionName}":`, err)
          }
        })
        .then((fn) => {
          retryAttempt = 0
          if (cancelled) {
            fn().catch(() => {})
          } else {
            unsubscribeFn = fn
          }
        })
        .catch((err) => {
          // Falha ao conectar/inscrever (ClientResponseError 0 do SSE):
          // tratar silenciosamente e tentar de novo mais tarde — o hook
          // nunca deve propagar erro de conexão para cima.
          console.warn(`[realtime] conexão de "${collectionName}" falhou, tentando novamente:`, err)
          unsubscribeFn = undefined
          scheduleRetry()
        })
    }

    subscribe()

    return () => {
      cancelled = true
      if (retryTimeoutId) clearTimeout(retryTimeoutId)
      if (unsubscribeFn) {
        unsubscribeFn().catch(() => {})
      }
    }
  }, [collectionName, enabled])
}

export default useRealtime
