import type { DocumentPermission } from '../types'
import { apiRequest } from './client'

const permissionsPath = (documentId: number) => `/api/v1/documents/${encodeURIComponent(documentId)}/permissions`

export const listDocumentPermissions = (userId: string, documentId: number, signal?: AbortSignal) => (
  apiRequest<{ items: DocumentPermission[] }>(permissionsPath(documentId), { userId, signal })
)

export const upsertDocumentPermission = (
  userId: string,
  documentId: number,
  permission: DocumentPermission,
) => apiRequest<DocumentPermission>(permissionsPath(documentId), {
  method: 'PUT', userId, body: JSON.stringify(permission),
})

export const removeDocumentPermission = (
  userId: string,
  documentId: number,
  permission: DocumentPermission,
) => apiRequest<void>(
  `${permissionsPath(documentId)}/${encodeURIComponent(permission.principalType)}/${encodeURIComponent(permission.principalId)}`,
  { method: 'DELETE', userId },
)
