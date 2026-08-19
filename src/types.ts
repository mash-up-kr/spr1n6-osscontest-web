export type View = 'documents' | 'search'
export type DetailTab = 'overview' | 'versions' | 'permissions'

export type User = {
  id: string
  name: string
  tenant: string
  tenantId: string
}

export type DocumentStatus = 'PENDING' | 'PROCESSING' | 'RETRY_WAIT' | 'COMPLETED' | 'FAILED'
export type PermissionLevel = 'READ' | 'WRITE'
export type PrincipalType = 'USER' | 'TENANT'

export type IndexingInfo = {
  status: DocumentStatus
  attemptCount?: number
  chunkCount?: number | null
  startedAt?: string | null
  completedAt?: string | null
  lastErrorMessage?: string | null
}

export type IndexingStatus = IndexingInfo & {
  versionNo: number
}

export type DocumentSummary = {
  id: number
  title: string
  latestUploadVersionNo: number
  latestEmbeddingVersionNo: number | null
  searchableVersionNo: number | null
  latestVersionIndexingStatus: DocumentStatus
  createdAt: string
}

export type DocumentVersion = {
  versionNo: number
  originalFilename: string
  mimeType: string
  fileSize: number
  uploadedAt: string
  indexing: IndexingInfo
  searchable: boolean
  duplicateOfVersionNo?: number | null
  sourceMetadata?: Record<string, unknown>
  extractedMetadata?: Record<string, unknown>
}

export type DocumentPermission = {
  principalType: PrincipalType
  principalId: string
  permission: PermissionLevel
}

export type DocumentDetail = DocumentSummary & {
  versions: DocumentVersion[]
  permissions: DocumentPermission[]
  indexing: IndexingStatus
  permissionsAvailable: boolean
}

export type DocumentFilters = {
  q: string
  indexingStatus: DocumentStatus | null
  searchable: boolean | null
}

export type UploadResponse = {
  documentId: number
  versionNo: number
  duplicateOfVersionNo: number | null
  indexing: Pick<IndexingInfo, 'status'>
}

export type SearchResult = {
  chunkId: number
  documentId: number
  title: string
  content: string
  contextBefore: string[]
  contextAfter: string[]
  score: number
  pageFrom: number | null
  pageTo: number | null
  sectionPath: string | null
}
