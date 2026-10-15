/*
 * Copyright (c) 2026 매쉬업스프링YB
 * SPDX-License-Identifier: MIT
 */

export type ApiErrorBody = {
  code?: string
  message?: string
  traceId?: string
}

export class ApiError extends Error {
  status: number
  readOnly: boolean
  code?: string
  traceId?: string

  constructor(status: number, readOnly: boolean, body: ApiErrorBody = {}) {
    super(body.message || `API 요청에 실패했습니다. (${status})`)
    this.name = 'ApiError'
    this.status = status
    this.readOnly = readOnly
    this.code = body.code
    this.traceId = body.traceId
  }
}

// 서버는 DB 장애 전환 중에 503 과 Retry-After 를 준다. 데이터를 바꾸지 않는 요청만 그 간격으로 다시 요청하고,
// 쓰기는 실패 응답을 받아도 실제로는 반영됐을 수 있어 다시 보내지 않는다.
// 45초는 기능 명세의 쓰기 재개 기준이다. 실측 승격 시간(약 30초)을 덮는다.
const RETRY_DEADLINE_MS = 45_000
// 서버가 Retry-After 를 주지 않거나 숫자가 아닐 때 쓰는 재시도 간격이다.
const DEFAULT_RETRY_AFTER_SECONDS = 5

let retryingRequests = 0
const retryListeners = new Set<() => void>()

const setRetrying = (delta: number) => {
  retryingRequests += delta
  retryListeners.forEach((listener) => listener())
}

export const subscribeRetrying = (listener: () => void) => {
  retryListeners.add(listener)
  return () => { retryListeners.delete(listener) }
}

export const isRetrying = () => retryingRequests > 0

const retryAfterMs = (response: Response) => {
  const seconds = Number(response.headers.get('Retry-After'))
  return (Number.isFinite(seconds) && seconds > 0 ? seconds : DEFAULT_RETRY_AFTER_SECONDS) * 1000
}

const wait = (ms: number, signal?: AbortSignal | null) => new Promise<void>((resolve, reject) => {
  if (signal?.aborted) return reject(signal.reason)
  const timer = window.setTimeout(() => { signal?.removeEventListener('abort', onAbort); resolve() }, ms)
  const onAbort = () => { window.clearTimeout(timer); reject(signal?.reason) }
  signal?.addEventListener('abort', onAbort, { once: true })
})

const rawBaseUrl = import.meta.env.VITE_API_BASE_URL ?? ''
const apiBaseUrl = rawBaseUrl.replace(/\/$/, '')

type RequestOptions = Omit<RequestInit, 'headers'> & {
  userId: string
  headers?: HeadersInit
  /** 데이터를 바꾸지 않는 요청. 기본은 GET 만이다. 검색처럼 POST 로 조회하는 요청은 직접 표시한다. */
  readOnly?: boolean
  /** 503 이면 다시 요청할지. 기본은 readOnly 와 같다. 스스로 주기적으로 다시 조회하는 폴링은 끈다. */
  retry?: boolean
}

const parseError = async (response: Response, readOnly: boolean) => {
  let body: ApiErrorBody = {}
  try {
    const parsed = await response.json() as unknown
    if (parsed && typeof parsed === 'object') body = parsed as ApiErrorBody
  } catch {
    body.message = response.statusText
  }
  throw new ApiError(response.status, readOnly, body)
}

const request = async (path: string, { userId, headers, readOnly: readOnlyOption, retry: retryOption, ...init }: RequestOptions) => {
  const requestHeaders = new Headers(headers)
  requestHeaders.set('X-User-Id', userId)
  if (init.body && !(init.body instanceof FormData) && !requestHeaders.has('Content-Type')) {
    requestHeaders.set('Content-Type', 'application/json')
  }

  const readOnly = readOnlyOption ?? (init.method ?? 'GET').toUpperCase() === 'GET'
  const retry = retryOption ?? readOnly
  const deadline = Date.now() + RETRY_DEADLINE_MS
  let retrying = false
  try {
    for (;;) {
      const response = await fetch(`${apiBaseUrl}${path}`, { ...init, headers: requestHeaders })
      if (response.ok) return response

      const delay = retryAfterMs(response)
      if (!retry || response.status !== 503 || Date.now() + delay > deadline) {
        return await parseError(response, readOnly)
      }
      if (!retrying) { retrying = true; setRetrying(1) }
      await wait(delay, init.signal)
    }
  } finally {
    if (retrying) setRetrying(-1)
  }
}

// 응답 본문이 없는 204 는 undefined 를 돌려준다. 호출하는 쪽의 T 가 이를 허용해야 한다.
export const apiRequest = async <T>(path: string, options: RequestOptions): Promise<T> => {
  const response = await request(path, options)
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export const apiBlobRequest = async (path: string, options: RequestOptions) => {
  const response = await request(path, options)
  return {
    blob: await response.blob(),
    contentDisposition: response.headers.get('Content-Disposition'),
  }
}

export const apiErrorMessage = (error: unknown) => {
  if (!(error instanceof ApiError)) return '요청을 처리할 수 없습니다. 잠시 후 다시 시도해 주세요.'
  if (error.status === 401) return '선택한 데모 사용자를 확인할 수 없습니다.'
  if (error.status === 403) return '현재 사용자에게 이 작업을 수행할 권한이 없습니다.'
  if (error.status === 404) return '문서가 없거나 현재 사용자에게 제공되지 않습니다.'
  if (error.status === 409) return '현재 상태에서는 이 작업을 수행할 수 없습니다. 상태를 새로고침해 주세요.'
  if (error.status === 413) return '파일은 최대 20MB까지 업로드할 수 있습니다.'
  if (error.status === 415) return '지원하지 않는 파일 형식입니다.'
  if (error.status === 503) {
    return error.readOnly
      ? '일시적으로 이용할 수 없습니다. 잠시 후 다시 시도해 주세요.'
      : '요청이 처리되지 않았을 수 있습니다. 목록을 확인한 뒤 다시 시도해 주세요.'
  }
  return error.message
}
