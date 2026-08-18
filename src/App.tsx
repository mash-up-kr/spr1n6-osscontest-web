import { useMemo, useState } from 'react'
import { DocumentDetailPage } from './components/DocumentDetailPage'
import { DocumentsPage } from './components/DocumentsPage'
import { Header } from './components/Header'
import { SearchPage } from './components/SearchPage'
import { Sidebar } from './components/Sidebar'
import { demoUsers, initialDocuments } from './data/mockData'
import type {
  DocumentItem,
  DocumentPermission,
  DocumentStatus,
  DocumentVersion,
  IndexingStage,
  View,
} from './types'

type ToastState = { id: number; message: string; tone: 'default' | 'success' | 'error' }

const nowTime = () => new Intl.DateTimeFormat('ko-KR', {
  hour: '2-digit', minute: '2-digit', hour12: false,
}).format(new Date())

function App() {
  const [currentUserId, setCurrentUserId] = useState(demoUsers[0].id)
  const [activeView, setActiveView] = useState<View>('documents')
  const [documents, setDocuments] = useState<DocumentItem[]>(initialDocuments)
  const [quickDocumentId, setQuickDocumentId] = useState<string | null>(null)
  const [detailDocumentId, setDetailDocumentId] = useState<string | null>(null)
  const [focusedVersionNo, setFocusedVersionNo] = useState<number | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)

  const currentUser = demoUsers.find((user) => user.id === currentUserId) ?? demoUsers[0]
  const visibleDocuments = useMemo(
    () => documents.filter((document) => (
      document.tenant === currentUser.tenant && document.allowedUserIds.includes(currentUser.id)
    )),
    [currentUser.id, currentUser.tenant, documents],
  )
  const quickDocument = visibleDocuments.find((document) => document.id === quickDocumentId) ?? null
  const detailDocument = visibleDocuments.find((document) => document.id === detailDocumentId) ?? null

  const notify = (message: string, tone: ToastState['tone'] = 'default') => {
    const nextToast = { id: Date.now(), message, tone }
    setToast(nextToast)
    window.setTimeout(() => setToast((current) => current?.id === nextToast.id ? null : current), 3200)
  }

  const updateVersion = (
    documentId: string,
    versionNo: number,
    status: DocumentStatus,
    stage: IndexingStage,
    progress: number,
    chunkCount?: number,
  ) => {
    setDocuments((current) => current.map((document) => {
      if (document.id !== documentId) return document
      const completed = status === 'COMPLETED'
      const advancesEmbeddingVersion = completed && versionNo > (document.latestEmbeddingVersionNo ?? 0)
      const versions = document.versions.map((version) => {
        const nextVersion = version.versionNo === versionNo ? {
          ...version,
          status,
          stage,
          progress,
          chunkCount: chunkCount ?? version.chunkCount,
          startedAt: status === 'PROCESSING' ? version.startedAt ?? new Date().toISOString() : version.startedAt,
          completedAt: completed ? new Date().toISOString() : version.completedAt,
        } : version

        return advancesEmbeddingVersion
          ? { ...nextVersion, searchable: version.versionNo === versionNo }
          : nextVersion
      })
      const isLatest = versionNo === document.latestUploadVersionNo
      return {
        ...document,
        versions,
        status: isLatest ? status : document.status,
        stage: isLatest ? stage : document.stage,
        progress: isLatest ? progress : document.progress,
        chunks: isLatest && chunkCount !== undefined ? chunkCount : document.chunks,
        updated: isLatest ? nowTime() : document.updated,
        latestEmbeddingVersionNo: advancesEmbeddingVersion ? versionNo : document.latestEmbeddingVersionNo,
        searchableVersionNo: advancesEmbeddingVersion ? versionNo : document.searchableVersionNo,
      }
    }))
  }

  const scheduleIndexing = (documentId: string, versionNo: number) => {
    const transitions: Array<[number, DocumentStatus, IndexingStage, number, number?]> = [
      [900, 'PROCESSING', 'PARSING', 18],
      [2100, 'PROCESSING', 'CHUNKING', 43, 12],
      [3600, 'PROCESSING', 'EMBEDDING', 72, 38],
      [5400, 'COMPLETED', 'INDEXED', 100, 38],
    ]
    transitions.forEach(([delay, status, stage, progress, chunks]) => {
      window.setTimeout(() => updateVersion(documentId, versionNo, status, stage, progress, chunks), delay)
    })
  }

  const handleUpload = (file: File, title?: string) => {
    const documentId = `mock-upload-${Date.now()}`
    const extension = file.name.split('.').pop()?.toUpperCase() ?? 'DOC'
    const filenameTitle = file.name.replace(/\.[^/.]+$/, '')
    const uploadedAt = new Date().toISOString()
    const uploadedVersion: DocumentVersion = {
      versionNo: 1, originalFilename: file.name, mimeType: file.type || `application/${extension.toLowerCase()}`,
      fileSize: `${Math.max(file.size / 1024 / 1024, 0.1).toFixed(1)} MB`, uploadedAt,
      status: 'PENDING', stage: 'UPLOADED', progress: 0, attemptCount: 1, chunkCount: null,
      startedAt: null, completedAt: null, searchable: false,
      sourceMetadata: { 작성자: currentUser.name, 작성일: uploadedAt.slice(0, 10) },
      extractedMetadata: { 페이지: '처리 대기', 언어: '처리 대기' },
    }
    const uploadedDocument: DocumentItem = {
      id: documentId, tenant: currentUser.tenant, allowedUserIds: [currentUser.id],
      name: title || filenameTitle, type: extension, size: uploadedVersion.fileSize,
      status: 'PENDING', stage: 'UPLOADED', progress: 0, chunks: null, updated: '방금', createdAt: uploadedAt,
      latestUploadVersionNo: 1, latestEmbeddingVersionNo: null, searchableVersionNo: null,
      versions: [uploadedVersion],
      permissions: [{ principalType: 'USER', principalId: currentUser.id, principalName: currentUser.name, permission: 'WRITE' }],
    }
    setDocuments((current) => [uploadedDocument, ...current])
    setQuickDocumentId(documentId)
    notify('업로드가 접수되었습니다. 버전 1의 인덱싱을 대기 중입니다.', 'success')
    scheduleIndexing(documentId, 1)
  }

  const uploadNewVersion = (documentId: string, file: File) => {
    const target = documents.find((document) => document.id === documentId)
    if (!target) return
    const versionNo = target.latestUploadVersionNo + 1
    const duplicate = target.versions.find((version) => version.originalFilename === file.name)
    const uploadedAt = new Date().toISOString()
    const nextVersion: DocumentVersion = {
      versionNo, originalFilename: file.name, mimeType: file.type || 'application/octet-stream',
      fileSize: `${Math.max(file.size / 1024 / 1024, 0.1).toFixed(1)} MB`, uploadedAt,
      status: 'PENDING', stage: 'UPLOADED', progress: 0, attemptCount: 1, chunkCount: null,
      startedAt: null, completedAt: null, searchable: false, duplicateOfVersionNo: duplicate?.versionNo,
      sourceMetadata: { 작성자: currentUser.name, 작성일: uploadedAt.slice(0, 10) },
      extractedMetadata: { 페이지: '처리 대기', 언어: '처리 대기' },
    }
    setDocuments((current) => current.map((document) => document.id === documentId ? {
      ...document,
      type: file.name.split('.').pop()?.toUpperCase() ?? document.type,
      size: nextVersion.fileSize,
      status: 'PENDING', stage: 'UPLOADED', progress: 0, chunks: null, updated: '방금',
      latestUploadVersionNo: versionNo,
      versions: [nextVersion, ...document.versions],
    } : document))
    notify(duplicate ? `버전 ${versionNo}이 생성되었습니다. 버전 ${duplicate.versionNo}과 동일한 내용입니다.` : `버전 ${versionNo}이 업로드되어 처리 대기 중입니다.`, 'success')
    scheduleIndexing(documentId, versionNo)
  }

  const retryVersion = (documentId: string, versionNo: number) => {
    setDocuments((current) => current.map((document) => document.id === documentId ? {
      ...document,
      status: versionNo === document.latestUploadVersionNo ? 'PENDING' : document.status,
      stage: versionNo === document.latestUploadVersionNo ? 'UPLOADED' : document.stage,
      progress: versionNo === document.latestUploadVersionNo ? 0 : document.progress,
      error: undefined,
      versions: document.versions.map((version) => version.versionNo === versionNo ? {
        ...version, status: 'PENDING', stage: 'UPLOADED', progress: 0, attemptCount: version.attemptCount + 1,
        startedAt: null, completedAt: null, error: undefined,
      } : version),
    } : document))
    notify(`버전 ${versionNo}의 재인덱싱을 시작했습니다.`, 'success')
    scheduleIndexing(documentId, versionNo)
  }

  const setSearchableVersion = (documentId: string, versionNo: number) => {
    setDocuments((current) => current.map((document) => document.id === documentId ? {
      ...document,
      searchableVersionNo: versionNo,
      versions: document.versions.map((version) => ({ ...version, searchable: version.versionNo === versionNo })),
    } : document))
    notify(`이제 검색에서 버전 ${versionNo}을 사용합니다.`, 'success')
  }

  const syncPermissionAccess = (document: DocumentItem, permissions: DocumentPermission[]) => {
    const tenantPermission = permissions.some((permission) => permission.principalType === 'TENANT' && permission.principalName === document.tenant)
    const allowedUserIds = tenantPermission
      ? demoUsers.filter((user) => user.tenant === document.tenant).map((user) => user.id)
      : permissions.filter((permission) => permission.principalType === 'USER').map((permission) => permission.principalId)
    return { ...document, permissions, allowedUserIds }
  }

  const handleUserChange = (userId: string) => {
    setCurrentUserId(userId)
    setQuickDocumentId(null)
    setDetailDocumentId(null)
    setFocusedVersionNo(null)
  }

  const openDocument = (documentId: string, versionNo?: number) => {
    setActiveView('documents')
    setQuickDocumentId(null)
    setDetailDocumentId(documentId)
    setFocusedVersionNo(versionNo ?? null)
  }

  return (
    <div className="app-shell">
      <Header users={demoUsers} currentUser={currentUser} onUserChange={handleUserChange} />
      <Sidebar activeView={activeView} onNavigate={(view) => {
        setActiveView(view)
        setQuickDocumentId(null)
        setDetailDocumentId(null)
        setFocusedVersionNo(null)
      }} />
      <main id="main-content" className="main-content">
        {activeView === 'documents' ? (
          detailDocument ? (
            <DocumentDetailPage
              key={`${detailDocument.id}-${focusedVersionNo ?? 'overview'}`}
              document={detailDocument}
              user={currentUser}
              users={demoUsers}
              initialVersionNo={focusedVersionNo}
              onBack={() => { setDetailDocumentId(null); setFocusedVersionNo(null) }}
              onRename={(title) => {
                setDocuments((current) => current.map((document) => document.id === detailDocument.id ? { ...document, name: title } : document))
                notify('문서 제목을 변경했습니다.', 'success')
              }}
              onDelete={() => {
                setDocuments((current) => current.filter((document) => document.id !== detailDocument.id))
                setDetailDocumentId(null)
                notify('문서를 삭제했습니다. 원본과 청크는 이후 정리됩니다.', 'success')
              }}
              onUploadVersion={(file) => uploadNewVersion(detailDocument.id, file)}
              onRetryVersion={(versionNo) => retryVersion(detailDocument.id, versionNo)}
              onSetSearchableVersion={(versionNo) => setSearchableVersion(detailDocument.id, versionNo)}
              onUpsertPermission={(permission) => {
                setDocuments((current) => current.map((document) => {
                  if (document.id !== detailDocument.id) return document
                  const exists = document.permissions.some((item) => item.principalType === permission.principalType && item.principalId === permission.principalId)
                  const next = exists
                    ? document.permissions.map((item) => item.principalType === permission.principalType && item.principalId === permission.principalId ? permission : item)
                    : [...document.permissions, permission]
                  return syncPermissionAccess(document, next)
                }))
                notify('권한을 저장했습니다.', 'success')
              }}
              onRemovePermission={(permission) => {
                setDocuments((current) => current.map((document) => document.id === detailDocument.id
                  ? syncPermissionAccess(document, document.permissions.filter((item) => !(item.principalType === permission.principalType && item.principalId === permission.principalId)))
                  : document))
                notify('권한을 회수했습니다.', 'success')
              }}
              onNotify={notify}
            />
          ) : (
            <DocumentsPage
              user={currentUser}
              documents={visibleDocuments}
              selectedDocument={quickDocument}
              onSelectDocument={(document) => setQuickDocumentId(document?.id ?? null)}
              onOpenDocument={openDocument}
              onUpload={handleUpload}
              onSetSearchableVersion={setSearchableVersion}
            />
          )
        ) : (
          <SearchPage user={currentUser} onOpenDocument={openDocument} />
        )}
      </main>
      {toast && <div className={`toast toast-${toast.tone}`} role="status"><span aria-hidden="true">{toast.tone === 'success' ? '✓' : toast.tone === 'error' ? '!' : 'i'}</span>{toast.message}</div>}
    </div>
  )
}

export default App
