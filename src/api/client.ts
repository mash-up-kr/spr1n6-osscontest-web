export type ApiErrorBody = {
  code?: string
  message?: string
  traceId?: string
}

export class ApiError extends Error {
  status: number
  code?: string
  traceId?: string

  constructor(status: number, body: ApiErrorBody = {}) {
    super(body.message || `API 요청에 실패했습니다. (${status})`)
    this.name = 'ApiError'
    this.status = status
    this.code = body.code
    this.traceId = body.traceId
  }
}

const rawBaseUrl = import.meta.env.VITE_API_BASE_URL ?? ''
const apiBaseUrl = rawBaseUrl.replace(/\/$/, '')

type RequestOptions = Omit<RequestInit, 'headers'> & {
  userId: string
  headers?: HeadersInit
}

const parseError = async (response: Response) => {
  let body: ApiErrorBody = {}
  try {
    const parsed = await response.json() as unknown
    if (parsed && typeof parsed === 'object') body = parsed as ApiErrorBody
  } catch {
    body.message = response.statusText
  }
  throw new ApiError(response.status, body)
}

const request = async (path: string, { userId, headers, ...init }: RequestOptions) => {
  const requestHeaders = new Headers(headers)
  requestHeaders.set('X-User-Id', userId)
  if (init.body && !(init.body instanceof FormData) && !requestHeaders.has('Content-Type')) {
    requestHeaders.set('Content-Type', 'application/json')
  }

  const response = await fetch(`${apiBaseUrl}${path}`, { ...init, headers: requestHeaders })
  if (!response.ok) await parseError(response)
  return response
}

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
  return error.message
}
