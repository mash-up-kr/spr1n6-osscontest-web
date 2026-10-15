/*
 * Copyright (c) 2026 매쉬업스프링YB
 * SPDX-License-Identifier: MIT
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ApiError, apiErrorMessage } from './api/client'
import {
  createDocument,
  deleteDocument,
  downloadDocumentVersion,
  getDocument,
  getDocumentVersion,
  listAllDocumentVersions,
  listDocuments,
  renameDocument,
  setSearchableDocumentVersion,
  uploadDocumentVersion,
} from './api/documents'
import { getIndexingStatus, retryIndexing } from './api/indexing'
import {
  listDocumentPermissions,
  removeDocumentPermission,
  upsertDocumentPermission,
} from './api/permissions'
import { DocumentDetailPage } from './components/DocumentDetailPage'
import { DocumentsPage } from './components/DocumentsPage'
import { Header } from './components/Header'
import { SearchPage } from './components/SearchPage'
import { Sidebar } from './components/Sidebar'
import { demoUsers } from './data/demoUsers'
import type {
  DocumentDetail,
  DocumentFilters,
  DocumentPermission,
  DocumentSummary,
  DocumentVersion,
  View,
} from './types'

type ToastState = { id: number; message: string; tone: 'default' | 'success' | 'error' }

const initialFilters: DocumentFilters = { q: '', indexingStatus: null, searchable: null }
const isTerminal = (status: DocumentSummary['latestVersionIndexingStatus']) => status === 'COMPLETED' || status === 'FAILED'

function App() {
  const [currentUserId, setCurrentUserId] = useState(demoUsers[0].id)
  const [activeView, setActiveView] = useState<View>('documents')
  const [documents, setDocuments] = useState<DocumentSummary[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [filters, setFilters] = useState<DocumentFilters>(initialFilters)
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [reloadSequence, setReloadSequence] = useState(0)
  const [quickDocumentId, setQuickDocumentId] = useState<number | null>(null)
  const [detailDocumentId, setDetailDocumentId] = useState<number | null>(null)
  const [focusedVersionNo, setFocusedVersionNo] = useState<number | null>(null)
  const [detailDocument, setDetailDocument] = useState<DocumentDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)

  const currentUser = demoUsers.find((user) => user.id === currentUserId) ?? demoUsers[0]
  const quickDocument = documents.find((document) => document.id === quickDocumentId) ?? null

  const notify = useCallback((message: string, tone: ToastState['tone'] = 'default') => {
    const nextToast = { id: Date.now(), message, tone }
    setToast(nextToast)
    window.setTimeout(() => setToast((current) => current?.id === nextToast.id ? null : current), 3200)
  }, [])

  const refreshList = useCallback(() => setReloadSequence((value) => value + 1), [])

  const handleFiltersChange = useCallback((next: DocumentFilters) => {
    setFilters((current) => (
      current.q === next.q
      && current.indexingStatus === next.indexingStatus
      && current.searchable === next.searchable
    ) ? current : next)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setListLoading(true)
    setListError(null)
    listDocuments(currentUser.id, filters, null, controller.signal)
      .then((page) => { setDocuments(page.items); setNextCursor(page.nextCursor) })
      .catch((error) => { if (!controller.signal.aborted) setListError(apiErrorMessage(error)) })
      .finally(() => { if (!controller.signal.aborted) setListLoading(false) })
    return () => controller.abort()
  }, [currentUser.id, filters, reloadSequence])

  const loadMoreDocuments = async () => {
    if (!nextCursor || listLoading) return
    setListLoading(true)
    try {
      const page = await listDocuments(currentUser.id, filters, nextCursor)
      setDocuments((current) => [...current, ...page.items])
      setNextCursor(page.nextCursor)
    } catch (error) {
      notify(apiErrorMessage(error), 'error')
    } finally { setListLoading(false) }
  }

  useEffect(() => {
    const activeDocuments = documents.filter((document) => !isTerminal(document.latestVersionIndexingStatus))
    if (!activeDocuments.length) return
    const controller = new AbortController()

    const poll = async () => {
      const responses = await Promise.allSettled(activeDocuments.map((document) => (
        getIndexingStatus(currentUser.id, document.id, document.latestUploadVersionNo, controller.signal)
      )))
      if (controller.signal.aborted) return
      const reachedTerminal = activeDocuments.some((document, index) => {
        const response = responses[index]
        return response.status === 'fulfilled'
          && isTerminal(response.value.status)
          && !isTerminal(document.latestVersionIndexingStatus)
      })
      setDocuments((current) => current.map((document) => {
        const index = activeDocuments.findIndex((active) => active.id === document.id)
        if (index < 0) return document
        const response = responses[index]
        if (response.status !== 'fulfilled') return document
        return { ...document, latestVersionIndexingStatus: response.value.status }
      }))
      if (reachedTerminal) refreshList()
    }

    const timer = window.setInterval(() => void poll(), 3000)
    return () => { controller.abort(); window.clearInterval(timer) }
  }, [currentUser.id, documents, refreshList])

  const fetchDocumentDetail = useCallback(async (documentId: number, signal?: AbortSignal) => {
    const permissionsRequest = listDocumentPermissions(currentUser.id, documentId, signal)
      .then((response) => ({ permissions: response.items, permissionsAvailable: true }))
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 403) return { permissions: [], permissionsAvailable: false }
        throw error
      })
    const summaryRequest = getDocument(currentUser.id, documentId, signal)
    const [summary, versions, indexing, permissionResult] = await Promise.all([
      summaryRequest,
      listAllDocumentVersions(currentUser.id, documentId, signal),
      summaryRequest.then((document) => (
        getIndexingStatus(currentUser.id, documentId, document.latestUploadVersionNo, signal)
      )),
      permissionsRequest,
    ])
    return { ...summary, versions, indexing, ...permissionResult } satisfies DocumentDetail
  }, [currentUser.id])

  const refreshDetail = useCallback(async () => {
    if (detailDocumentId === null) return
    const detail = await fetchDocumentDetail(detailDocumentId)
    setDetailDocument(detail)
  }, [detailDocumentId, fetchDocumentDetail])

  useEffect(() => {
    if (detailDocumentId === null) {
      setDetailDocument(null)
      setDetailError(null)
      return
    }
    const controller = new AbortController()
    setDetailLoading(true)
    setDetailError(null)
    setDetailDocument(null)
    fetchDocumentDetail(detailDocumentId, controller.signal)
      .then(setDetailDocument)
      .catch((error) => { if (!controller.signal.aborted) setDetailError(apiErrorMessage(error)) })
      .finally(() => { if (!controller.signal.aborted) setDetailLoading(false) })
    return () => controller.abort()
  }, [detailDocumentId, fetchDocumentDetail])

  // 폴링 대상이 바뀔 때만 타이머를 다시 만든다. 응답 반영으로 detailDocument 가 바뀌어도 유지된다.
  const pollDocumentId = detailDocument?.id ?? null
  const pollLatestVersionNo = detailDocument?.latestUploadVersionNo ?? null
  const pollVersionKey = detailDocument
    ? detailDocument.versions.filter((version) => !isTerminal(version.indexing.status)).map((version) => version.versionNo).join(',')
    : ''

  useEffect(() => {
    if (pollDocumentId === null || !pollVersionKey) return
    const documentId = pollDocumentId
    const versionNos = pollVersionKey.split(',').map(Number)
    const controller = new AbortController()
    let pending = false
    const poll = async () => {
      if (pending) return
      pending = true
      try {
        const responses = await Promise.allSettled(versionNos.map((versionNo) => (
          getIndexingStatus(currentUser.id, documentId, versionNo, controller.signal)
        )))
        if (controller.signal.aborted) return
        const updates = responses.flatMap((response) => response.status === 'fulfilled' ? [response.value] : [])
        if (!updates.length) {
          const failure = responses.find((response) => response.status === 'rejected')
          notify(apiErrorMessage(failure?.reason), 'error')
          return
        }
        // Worker 가 검색 대상·최신 임베딩 버전을 바꿨을 수 있어 종료 시점에는 상세를 다시 읽는다.
        // 먼저 패치하면 폴링 키가 바뀌어 이 effect 가 정리되고 재조회가 abort 되므로 패치보다 앞선다.
        if (updates.some((indexing) => isTerminal(indexing.status))) {
          const next = await fetchDocumentDetail(documentId, controller.signal)
          if (controller.signal.aborted) return
          setDetailDocument(next)
          refreshList()
          return
        }
        const byVersionNo = new Map(updates.map((indexing) => [indexing.versionNo, indexing]))
        const latest = pollLatestVersionNo === null ? undefined : byVersionNo.get(pollLatestVersionNo)
        setDetailDocument((current) => current && current.id === documentId ? {
          ...current,
          versions: current.versions.map((version) => {
            const indexing = byVersionNo.get(version.versionNo)
            return indexing ? { ...version, indexing } : version
          }),
          ...(latest ? { indexing: latest, latestVersionIndexingStatus: latest.status } : {}),
        } : current)
        if (latest) {
          // 상태가 같으면 배열을 그대로 둔다. 새 배열은 documents 에 걸린 목록 폴링을 재시작시킨다.
          setDocuments((current) => current.some((document) => document.id === documentId && document.latestVersionIndexingStatus !== latest.status)
            ? current.map((document) => document.id === documentId ? { ...document, latestVersionIndexingStatus: latest.status } : document)
            : current)
        }
      } catch (error) {
        if (!controller.signal.aborted) notify(apiErrorMessage(error), 'error')
      } finally { pending = false }
    }
    const timer = window.setInterval(() => void poll(), 3000)
    return () => { controller.abort(); window.clearInterval(timer) }
  }, [currentUser.id, fetchDocumentDetail, notify, pollDocumentId, pollLatestVersionNo, pollVersionKey, refreshList])

  const handleUserChange = (userId: string) => {
    setCurrentUserId(userId)
    setDocuments([])
    setQuickDocumentId(null)
    setDetailDocumentId(null)
    setFocusedVersionNo(null)
  }

  const openDocument = (documentId: number, versionNo?: number) => {
    setActiveView('documents')
    setQuickDocumentId(null)
    setDetailDocumentId(documentId)
    setFocusedVersionNo(versionNo ?? null)
  }

  const uploadNewDocument = async (file: File, title?: string) => {
    const response = await createDocument(currentUser.id, file, title)
    notify('업로드가 접수되었습니다. 인덱싱 상태를 주기적으로 확인합니다.', 'success')
    setQuickDocumentId(response.documentId)
    refreshList()
  }

  const runDetailAction = async (action: () => Promise<unknown>, successMessage: string) => {
    try {
      await action()
      notify(successMessage, 'success')
      await refreshDetail()
      refreshList()
    } catch (error) {
      notify(apiErrorMessage(error), 'error')
      throw error
    }
  }

  const detailContent = useMemo(() => {
    if (detailDocumentId === null) return null
    if (detailLoading) return <div className="page"><div className="table-empty"><span className="spinner dark" aria-hidden="true" /><strong>문서 상세를 불러오고 있습니다…</strong></div></div>
    if (detailError || !detailDocument) return <div className="page"><button className="breadcrumb" type="button" onClick={() => setDetailDocumentId(null)}>‹ 문서 목록</button><div className="inline-error" role="alert"><span aria-hidden="true">!</span><div><strong>문서 상세를 불러오지 못했습니다</strong><p>{detailError}</p><button className="link-button" type="button" onClick={() => { setDetailDocumentId(null); window.setTimeout(() => setDetailDocumentId(detailDocumentId), 0) }}>다시 시도</button></div></div></div>

    return (
      <DocumentDetailPage
        key={`${detailDocument.id}-${focusedVersionNo ?? 'overview'}`}
        document={detailDocument}
        user={currentUser}
        users={demoUsers}
        initialVersionNo={focusedVersionNo}
        onBack={() => { setDetailDocumentId(null); setFocusedVersionNo(null) }}
        onRename={(title) => runDetailAction(() => renameDocument(currentUser.id, detailDocument.id, title), '문서 제목을 변경했습니다.')}
        onDelete={async () => {
          try {
            await deleteDocument(currentUser.id, detailDocument.id)
            setDocuments((current) => current.filter((document) => document.id !== detailDocument.id))
            setDetailDocumentId(null)
            notify('문서를 삭제했습니다. 원본과 청크는 Worker가 정리합니다.', 'success')
          } catch (error) { notify(apiErrorMessage(error), 'error'); throw error }
        }}
        onUploadVersion={async (file) => {
          try {
            const response = await uploadDocumentVersion(currentUser.id, detailDocument.id, file)
            const duplicateMessage = response.duplicateOfVersionNo === null ? '' : ` 버전 ${response.duplicateOfVersionNo}과 동일한 내용입니다.`
            notify(`버전 ${response.versionNo} 업로드가 접수되었습니다.${duplicateMessage}`, 'success')
            await refreshDetail(); refreshList()
          } catch (error) { notify(apiErrorMessage(error), 'error'); throw error }
        }}
        onRetryVersion={(versionNo) => runDetailAction(() => retryIndexing(currentUser.id, detailDocument.id, versionNo), `버전 ${versionNo}의 재인덱싱을 요청했습니다.`)}
        onSetSearchableVersion={(versionNo) => runDetailAction(() => setSearchableDocumentVersion(currentUser.id, detailDocument.id, versionNo), `검색 대상 버전을 ${versionNo}(으)로 변경했습니다.`)}
        onLoadVersionDetail={async (versionNo) => {
          try { return await getDocumentVersion(currentUser.id, detailDocument.id, versionNo) }
          catch (error) { notify(apiErrorMessage(error), 'error'); throw error }
        }}
        onDownloadVersion={async (version) => {
          try { await downloadDocumentVersion(currentUser.id, detailDocument.id, version.versionNo, version.originalFilename) }
          catch (error) { notify(apiErrorMessage(error), 'error') }
        }}
        onUpsertPermission={(permission) => runDetailAction(() => upsertDocumentPermission(currentUser.id, detailDocument.id, permission), '권한을 저장했습니다.')}
        onRemovePermission={(permission) => runDetailAction(() => removeDocumentPermission(currentUser.id, detailDocument.id, permission), '권한을 회수했습니다.')}
      />
    )
  }, [currentUser, detailDocument, detailDocumentId, detailError, detailLoading, focusedVersionNo, notify, refreshDetail, refreshList])

  return (
    <div className="app-shell">
      <Header users={demoUsers} currentUser={currentUser} onUserChange={handleUserChange} />
      <Sidebar activeView={activeView} onNavigate={(view) => { setActiveView(view); setQuickDocumentId(null); setDetailDocumentId(null); setFocusedVersionNo(null) }} />
      <main id="main-content" className="main-content">
        {activeView === 'documents' ? (
          detailDocumentId !== null ? detailContent : (
            <DocumentsPage
              user={currentUser}
              documents={documents}
              selectedDocument={quickDocument}
              isLoading={listLoading}
              error={listError}
              hasMore={nextCursor !== null}
              onFiltersChange={handleFiltersChange}
              onLoadMore={() => void loadMoreDocuments()}
              onRetryLoad={refreshList}
              onSelectDocument={(document) => setQuickDocumentId(document?.id ?? null)}
              onOpenDocument={openDocument}
              onUpload={uploadNewDocument}
              onLoadVersions={async (documentId) => {
                try { return await listAllDocumentVersions(currentUser.id, documentId) }
                catch (error) { notify(apiErrorMessage(error), 'error'); return [] }
              }}
              onSetSearchableVersion={async (documentId, versionNo) => {
                try {
                  await setSearchableDocumentVersion(currentUser.id, documentId, versionNo)
                  setDocuments((current) => current.map((document) => document.id === documentId ? { ...document, searchableVersionNo: versionNo } : document))
                  notify(`검색 대상 버전을 ${versionNo}(으)로 변경했습니다.`, 'success')
                } catch (error) { notify(apiErrorMessage(error), 'error'); throw error }
              }}
            />
          )
        ) : <SearchPage user={currentUser} onOpenDocument={openDocument} />}
      </main>
      {toast && <div className={`toast toast-${toast.tone}`} role="status"><span aria-hidden="true">{toast.tone === 'success' ? '✓' : toast.tone === 'error' ? '!' : 'i'}</span>{toast.message}</div>}
    </div>
  )
}

export default App
