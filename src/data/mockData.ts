import type {
  DocumentItem,
  DocumentPermission,
  DocumentStatus,
  DocumentVersion,
  IndexingStage,
  SearchResult,
  User,
} from '../types'

export const demoUsers: User[] = [
  { id: 'tenant-a-user-a', name: '사용자 A', tenant: '테넌트 A' },
  { id: 'tenant-a-user-b', name: '사용자 B', tenant: '테넌트 A' },
  { id: 'tenant-b-user-c', name: '사용자 C', tenant: '테넌트 B' },
]

const permissions = (_tenant: string, users: Array<[string, string, 'READ' | 'WRITE']>): DocumentPermission[] => [
  ...users.map(([principalId, principalName, permission]) => ({
    principalType: 'USER' as const,
    principalId,
    principalName,
    permission,
  })),
]

const version = (
  versionNo: number,
  filename: string,
  status: DocumentStatus,
  stage: IndexingStage,
  progress: number | null,
  searchable: boolean,
  options: Partial<DocumentVersion> = {},
): DocumentVersion => ({
  versionNo,
  originalFilename: filename,
  mimeType: filename.endsWith('.pdf') ? 'application/pdf' : filename.endsWith('.docx')
    ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    : 'text/markdown',
  fileSize: '2.4 MB',
  uploadedAt: '2026-08-15T04:12:09Z',
  status,
  stage,
  progress,
  attemptCount: 1,
  chunkCount: searchable ? 178 : null,
  startedAt: status === 'PENDING' ? null : '2026-08-15T04:12:11Z',
  completedAt: status === 'COMPLETED' || status === 'FAILED' ? '2026-08-15T04:14:32Z' : null,
  searchable,
  sourceMetadata: { 작성자: '전략기획팀', 작성일: '2026-08-12', 작성도구: 'OpenSQL 문서도구' },
  extractedMetadata: { 페이지: '48', 언어: '한국어', 글자수: '84,210' },
  ...options,
})

export const initialDocuments: DocumentItem[] = [
  {
    id: 'opensql-guide', tenant: '테넌트 A', allowedUserIds: ['tenant-a-user-a'],
    name: 'OpenSQL 가이드', type: 'PDF', size: '2.4 MB', status: 'PROCESSING', stage: 'EMBEDDING',
    progress: 72, chunks: 38, updated: '14:42', createdAt: '2026-07-02T01:30:00Z',
    latestUploadVersionNo: 3, latestEmbeddingVersionNo: 2, searchableVersionNo: 2,
    versions: [
      version(3, 'OpenSQL_가이드_v3.pdf', 'PROCESSING', 'EMBEDDING', 72, false),
      version(2, 'OpenSQL_가이드_v2.pdf', 'COMPLETED', 'INDEXED', 100, true, { uploadedAt: '2026-08-10T02:00:00Z', chunkCount: 178 }),
      version(1, 'OpenSQL_가이드.pdf', 'COMPLETED', 'INDEXED', 100, false, { uploadedAt: '2026-08-01T03:00:00Z', chunkCount: 164 }),
    ],
    permissions: permissions('테넌트 A', [['tenant-a-user-a', '사용자 A', 'WRITE']]),
  },
  {
    id: 'architecture', tenant: '테넌트 A', allowedUserIds: ['tenant-a-user-a', 'tenant-a-user-b'],
    name: '시스템 아키텍처', type: 'PDF', size: '1.8 MB', status: 'COMPLETED', stage: 'INDEXED',
    progress: 100, chunks: 24, updated: '14:38', createdAt: '2026-06-28T08:20:00Z',
    latestUploadVersionNo: 2, latestEmbeddingVersionNo: 2, searchableVersionNo: 2,
    versions: [
      version(2, '시스템_아키텍처_v2.pdf', 'COMPLETED', 'INDEXED', 100, true, { fileSize: '1.8 MB', chunkCount: 24 }),
      version(1, '시스템_아키텍처.pdf', 'COMPLETED', 'INDEXED', 100, false, { fileSize: '1.6 MB', uploadedAt: '2026-06-21T08:20:00Z', chunkCount: 21 }),
    ],
    permissions: permissions('테넌트 A', [
      ['tenant-a-user-a', '사용자 A', 'WRITE'],
      ['tenant-a-user-b', '사용자 B', 'READ'],
    ]),
  },
  {
    id: 'migration-plan', tenant: '테넌트 A', allowedUserIds: ['tenant-a-user-a'],
    name: '마이그레이션 계획서', type: 'DOCX', size: '980 KB', status: 'RETRY_WAIT', stage: 'EMBEDDING',
    progress: 51, chunks: 16, updated: '14:34', createdAt: '2026-06-24T07:10:00Z',
    latestUploadVersionNo: 1, latestEmbeddingVersionNo: null, searchableVersionNo: null,
    versions: [version(1, '마이그레이션_계획서.docx', 'RETRY_WAIT', 'EMBEDDING', 51, false, {
      fileSize: '980 KB', attemptCount: 2, error: '임베딩 요청 시간이 초과되었습니다.', nextRetry: '14:53',
    })],
    permissions: permissions('테넌트 A', [['tenant-a-user-a', '사용자 A', 'WRITE']]),
    error: '임베딩 요청 시간이 초과되었습니다.', retryCount: 2, nextRetry: '14:53',
  },
  {
    id: 'release-notes', tenant: '테넌트 A', allowedUserIds: ['tenant-a-user-a', 'tenant-a-user-b'],
    name: '릴리스 노트', type: 'MD', size: '124 KB', status: 'PENDING', stage: 'UPLOADED',
    progress: 0, chunks: null, updated: '14:33', createdAt: '2026-06-20T02:00:00Z',
    latestUploadVersionNo: 1, latestEmbeddingVersionNo: null, searchableVersionNo: null,
    versions: [version(1, '릴리스_노트.md', 'PENDING', 'UPLOADED', 0, false, { fileSize: '124 KB' })],
    permissions: permissions('테넌트 A', [
      ['tenant-a-user-a', '사용자 A', 'WRITE'],
      ['tenant-a-user-b', '사용자 B', 'READ'],
    ]),
  },
  {
    id: 'report', tenant: '테넌트 A', allowedUserIds: ['tenant-a-user-a'],
    name: '분기 보고서', type: 'PDF', size: '3.1 MB', status: 'FAILED', stage: 'EMBEDDING',
    progress: null, chunks: null, updated: '14:31', createdAt: '2026-06-18T01:00:00Z',
    latestUploadVersionNo: 1, latestEmbeddingVersionNo: null, searchableVersionNo: null,
    versions: [version(1, '분기_보고서.pdf', 'FAILED', 'EMBEDDING', null, false, {
      fileSize: '3.1 MB', attemptCount: 3, error: '임베딩 요청에 실패했습니다.',
    })],
    permissions: permissions('테넌트 A', [['tenant-a-user-a', '사용자 A', 'WRITE']]),
    error: '임베딩 요청에 실패했습니다.', retryCount: 3,
  },
  {
    id: 'tibero-operations', tenant: '테넌트 B', allowedUserIds: ['tenant-b-user-c'],
    name: 'Tibero 운영 가이드', type: 'PDF', size: '2.7 MB', status: 'COMPLETED', stage: 'INDEXED',
    progress: 100, chunks: 42, updated: '13:58', createdAt: '2026-07-01T05:00:00Z',
    latestUploadVersionNo: 1, latestEmbeddingVersionNo: 1, searchableVersionNo: 1,
    versions: [version(1, 'Tibero_운영_가이드.pdf', 'COMPLETED', 'INDEXED', 100, true, { fileSize: '2.7 MB', chunkCount: 42 })],
    permissions: permissions('테넌트 B', [['tenant-b-user-c', '사용자 C', 'WRITE']]),
  },
  {
    id: 'dr-handbook', tenant: '테넌트 B', allowedUserIds: ['tenant-b-user-c'],
    name: '재해 복구 안내서', type: 'PDF', size: '1.2 MB', status: 'PROCESSING', stage: 'CHUNKING',
    progress: 44, chunks: 12, updated: '13:54', createdAt: '2026-06-22T04:00:00Z',
    latestUploadVersionNo: 1, latestEmbeddingVersionNo: null, searchableVersionNo: null,
    versions: [version(1, '재해_복구_안내서.pdf', 'PROCESSING', 'CHUNKING', 44, false, { fileSize: '1.2 MB', chunkCount: 12 })],
    permissions: permissions('테넌트 B', [['tenant-b-user-c', '사용자 C', 'WRITE']]),
  },
]

export const mockSearchResults: SearchResult[] = [
  {
    id: 'result-1', tenant: '테넌트 A', allowedUserIds: ['tenant-a-user-a'], documentId: 'opensql-guide',
    documentName: 'OpenSQL 가이드', versionNo: 2, similarity: 92, page: 14, chunk: 32,
    section: '아키텍처 / 복구',
    content: '장애가 발생하면 데이터베이스는 WAL을 기반으로 복구 과정을 수행합니다. 마지막 체크포인트 이후 기록된 로그를 순서대로 재적용하여 커밋된 트랜잭션의 일관성을 보장합니다.',
  },
  {
    id: 'result-2', tenant: '테넌트 A', allowedUserIds: ['tenant-a-user-a', 'tenant-a-user-b'], documentId: 'architecture',
    documentName: '시스템 아키텍처', versionNo: 2, similarity: 87, page: 8, chunk: 17,
    section: '고가용성',
    content: '복제 환경에서는 주 노드의 변경 로그를 대기 노드로 전달합니다. 장애 감지 후 대기 노드가 승격되며 클라이언트 연결은 새로운 주 노드로 전환됩니다.',
  },
  {
    id: 'result-3', tenant: '테넌트 A', allowedUserIds: ['tenant-a-user-a'], documentId: 'opensql-guide',
    documentName: 'OpenSQL 가이드', versionNo: 2, similarity: 81, page: 16, chunk: 36,
    section: '백업 전략',
    content: '정기 백업과 아카이브 로그를 함께 보관하면 원하는 복구 시점까지 데이터를 복원할 수 있습니다. 운영 환경에서는 복구 목표 시간에 맞춰 백업 주기를 설정합니다.',
  },
  {
    id: 'result-b-1', tenant: '테넌트 B', allowedUserIds: ['tenant-b-user-c'], documentId: 'tibero-operations',
    documentName: 'Tibero 운영 가이드', versionNo: 1, similarity: 89, page: 22, chunk: 41,
    section: '재해 복구',
    content: '재해 복구 절차는 서비스 전환, 데이터 검증, 애플리케이션 연결 확인 순서로 수행합니다. 복구가 완료되면 운영 담당자가 최종 서비스 상태를 확인합니다.',
  },
]
