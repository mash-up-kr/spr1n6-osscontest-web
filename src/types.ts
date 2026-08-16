export type View = 'documents' | 'search'
export type DetailTab = 'overview' | 'versions' | 'permissions'

export type User = {
  id: string
  name: string
  tenant: string
}

export type DocumentStatus = 'PENDING' | 'PROCESSING' | 'RETRY_WAIT' | 'COMPLETED' | 'FAILED'
export type IndexingStage = 'UPLOADED' | 'PARSING' | 'CHUNKING' | 'EMBEDDING' | 'INDEXED'
export type PermissionLevel = 'READ' | 'WRITE'
export type PrincipalType = 'USER' | 'TENANT'

export type DocumentVersion = {
  versionNo: number
  originalFilename: string
  mimeType: string
  fileSize: string
  uploadedAt: string
  status: DocumentStatus
  stage: IndexingStage
  progress: number | null
  attemptCount: number
  chunkCount: number | null
  startedAt: string | null
  completedAt: string | null
  searchable: boolean
  error?: string
  nextRetry?: string
  duplicateOfVersionNo?: number
  sourceMetadata: Record<string, string>
  extractedMetadata: Record<string, string>
}

export type DocumentPermission = {
  principalType: PrincipalType
  principalId: string
  principalName: string
  permission: PermissionLevel
}

export type DocumentItem = {
  id: string
  tenant: string
  allowedUserIds: string[]
  name: string
  type: string
  size: string
  status: DocumentStatus
  stage: IndexingStage
  progress: number | null
  chunks: number | null
  updated: string
  createdAt: string
  latestUploadVersionNo: number
  latestEmbeddingVersionNo: number | null
  searchableVersionNo: number | null
  versions: DocumentVersion[]
  permissions: DocumentPermission[]
  error?: string
  retryCount?: number
  nextRetry?: string
}

export type SearchResult = {
  id: string
  tenant: string
  allowedUserIds: string[]
  documentId: string
  documentName: string
  versionNo: number
  similarity: number
  page: number
  chunk: number
  section?: string
  content: string
}
