import type {
  DocumentFilters,
  DocumentSummary,
  DocumentVersion,
  UploadResponse,
} from '../types'
import { apiBlobRequest, apiRequest } from './client'

type Page<T> = {
  items: T[]
  nextCursor: string | null
}

const documentPath = (documentId: number) => `/api/v1/documents/${encodeURIComponent(documentId)}`

export const listDocuments = (
  userId: string,
  filters: DocumentFilters,
  cursor?: string | null,
  signal?: AbortSignal,
) => {
  const search = new URLSearchParams({ limit: '20' })
  if (cursor) search.set('cursor', cursor)
  if (filters.q.trim()) search.set('q', filters.q.trim())
  if (filters.indexingStatus) search.set('indexingStatus', filters.indexingStatus)
  if (filters.searchable !== null) search.set('searchable', String(filters.searchable))
  return apiRequest<Page<DocumentSummary>>(`/api/v1/documents?${search}`, { userId, signal })
}

export const getDocument = (userId: string, documentId: number, signal?: AbortSignal) => (
  apiRequest<DocumentSummary>(documentPath(documentId), { userId, signal })
)

export const createDocument = (userId: string, file: File, title?: string) => {
  const body = new FormData()
  body.append('file', file)
  if (title) body.append('title', title)
  return apiRequest<UploadResponse>('/api/v1/documents', { method: 'POST', userId, body })
}

export const renameDocument = (userId: string, documentId: number, title: string) => (
  apiRequest<{ id: number; title: string }>(documentPath(documentId), {
    method: 'PATCH', userId, body: JSON.stringify({ title }),
  })
)

export const deleteDocument = (userId: string, documentId: number) => (
  apiRequest<void>(documentPath(documentId), { method: 'DELETE', userId })
)

export const uploadDocumentVersion = (userId: string, documentId: number, file: File) => {
  const body = new FormData()
  body.append('file', file)
  return apiRequest<UploadResponse>(`${documentPath(documentId)}/versions`, { method: 'POST', userId, body })
}

export const listDocumentVersions = (
  userId: string,
  documentId: number,
  cursor?: string | null,
  signal?: AbortSignal,
) => {
  const query = cursor ? `?${new URLSearchParams({ cursor })}` : ''
  return apiRequest<Page<DocumentVersion>>(`${documentPath(documentId)}/versions${query}`, { userId, signal })
}

export const listAllDocumentVersions = async (userId: string, documentId: number, signal?: AbortSignal) => {
  const versions: DocumentVersion[] = []
  let cursor: string | null = null
  const seenCursors = new Set<string>()
  do {
    const page = await listDocumentVersions(userId, documentId, cursor, signal)
    versions.push(...page.items)
    cursor = page.nextCursor
    if (cursor && seenCursors.has(cursor)) throw new Error('버전 목록 커서가 반복되었습니다.')
    if (cursor) seenCursors.add(cursor)
  } while (cursor)
  return versions
}

export const getDocumentVersion = (userId: string, documentId: number, versionNo: number) => (
  apiRequest<DocumentVersion>(`${documentPath(documentId)}/versions/${encodeURIComponent(versionNo)}`, { userId })
)

const contentDispositionFilename = (value: string | null) => {
  if (!value) return null
  const encoded = value.match(/filename\*=UTF-8''([^;]+)/i)?.[1]
  if (encoded) {
    try { return decodeURIComponent(encoded) } catch { return encoded }
  }
  return value.match(/filename="?([^";]+)"?/i)?.[1] ?? null
}

export const downloadDocumentVersion = async (
  userId: string,
  documentId: number,
  versionNo: number,
  fallbackFilename: string,
) => {
  const { blob, contentDisposition } = await apiBlobRequest(
    `${documentPath(documentId)}/versions/${encodeURIComponent(versionNo)}/content`,
    { userId },
  )
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = contentDispositionFilename(contentDisposition) ?? fallbackFilename
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

export const setSearchableDocumentVersion = (userId: string, documentId: number, versionNo: number) => (
  apiRequest<{ searchableVersionNo: number }>(`${documentPath(documentId)}/searchable-version`, {
    method: 'PUT', userId, body: JSON.stringify({ versionNo }),
  })
)
