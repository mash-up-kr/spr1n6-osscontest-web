import type { IndexingStatus } from '../types'
import { apiRequest } from './client'

const indexingPath = (documentId: number, versionNo: number) => (
  `/api/v1/documents/${encodeURIComponent(documentId)}/versions/${encodeURIComponent(versionNo)}/indexing`
)

export const getIndexingStatus = (
  userId: string,
  documentId: number,
  versionNo: number,
  signal?: AbortSignal,
) => apiRequest<IndexingStatus>(indexingPath(documentId, versionNo), { userId, signal })

export const retryIndexing = (userId: string, documentId: number, versionNo: number) => (
  apiRequest<{ versionNo: number; indexing: { status: 'PENDING' } }>(`${indexingPath(documentId, versionNo)}/retry`, {
    method: 'POST', userId,
  })
)
