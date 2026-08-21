import type { SearchResult } from '../types'
import { apiRequest } from './client'

export type SearchRequest = {
  query: string
  topK?: number
  contextWindow?: number
  efSearch?: number
}

export const searchDocuments = (userId: string, request: SearchRequest, signal?: AbortSignal) => (
  apiRequest<{ items: SearchResult[] }>('/api/v1/search', {
    method: 'POST', userId, signal, body: JSON.stringify(request),
  })
)
