import { useEffect, useMemo, useRef, useState } from 'react'
import type { DocumentItem, DocumentStatus, User } from '../types'
import { DocumentDrawer } from './DocumentDrawer'
import { StatusBadge } from './StatusBadge'
import { UploadPanel } from './UploadPanel'

type DocumentsPageProps = {
  user: User
  documents: DocumentItem[]
  selectedDocument: DocumentItem | null
  onSelectDocument: (document: DocumentItem | null) => void
  onOpenDocument: (documentId: string) => void
  onUpload: (file: File, title?: string) => void
  onSetSearchableVersion: (documentId: string, versionNo: number) => void
}

const PAGE_SIZE = 4

const formatDate = (value: string) => new Intl.DateTimeFormat('ko-KR', {
  month: '2-digit', day: '2-digit', year: 'numeric',
}).format(new Date(value))

export function DocumentsPage({
  user, documents, selectedDocument, onSelectDocument, onOpenDocument, onUpload, onSetSearchableVersion,
}: DocumentsPageProps) {
  const [showUpload, setShowUpload] = useState(false)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<DocumentStatus | 'ALL'>('ALL')
  const [searchable, setSearchable] = useState<'ALL' | 'YES' | 'NO'>('ALL')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [openVersionMenuId, setOpenVersionMenuId] = useState<string | null>(null)
  const versionMenuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
    setOpenVersionMenuId(null)
  }, [query, status, searchable, user.id])

  useEffect(() => {
    if (!openVersionMenuId) return

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!versionMenuRef.current?.contains(event.target as Node)) setOpenVersionMenuId(null)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenVersionMenuId(null)
    }

    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [openVersionMenuId])

  const filteredDocuments = useMemo(() => documents.filter((document) => {
    const matchesQuery = document.name.toLowerCase().includes(query.trim().toLowerCase())
    const matchesStatus = status === 'ALL' || document.status === status
    const matchesSearchable = searchable === 'ALL'
      || (searchable === 'YES' ? document.searchableVersionNo !== null : document.searchableVersionNo === null)
    return matchesQuery && matchesStatus && matchesSearchable
  }), [documents, query, searchable, status])

  const visibleDocuments = filteredDocuments.slice(0, visibleCount)

  const canWriteDocument = (document: DocumentItem) => {
    const directPermission = document.permissions.find((permission) => permission.principalType === 'USER' && permission.principalId === user.id)
    const tenantPermission = document.permissions.find((permission) => permission.principalType === 'TENANT' && permission.principalName === user.tenant)
    return (directPermission?.permission ?? tenantPermission?.permission) === 'WRITE'
  }

  return (
    <div className="page documents-page">
      <div className="page-header">
        <div>
          <h1>문서</h1>
          <p>자연어 검색에 사용할 문서를 업로드하고 관리합니다.</p>
        </div>
        <button className="button primary" type="button" onClick={() => setShowUpload(true)}>
          <span aria-hidden="true">＋</span> 문서 업로드
        </button>
      </div>

      <div className="context-strip">
        <span>접근 권한 기준</span>
        <strong>{user.tenant} / {user.name}</strong>
        <span className="separator" aria-hidden="true" />
        <span>조회 가능 문서 {documents.length}개</span>
        <span className="stream-indicator"><i aria-hidden="true" /> 상태 업데이트 연결됨</span>
      </div>

      {showUpload && <UploadPanel onClose={() => setShowUpload(false)} onUpload={onUpload} />}

      <section className="document-list-section" aria-labelledby="document-list-title">
        <div className="section-header">
          <div>
            <h2 id="document-list-title">문서 목록</h2>
            <p>행을 선택하면 처리 상태를 빠르게 확인하고, 상세 화면에서 전체 정보를 관리할 수 있습니다.</p>
          </div>
          <span className="result-count">{filteredDocuments.length}개</span>
        </div>

        <div className="document-toolbar">
          <label className="table-search">
            <span className="sr-only">제목으로 검색</span>
            <span className="input-search-icon" aria-hidden="true" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="문서 제목 검색" />
          </label>
          <label>
            <span className="sr-only">인덱싱 상태 필터</span>
            <select value={status} onChange={(event) => setStatus(event.target.value as DocumentStatus | 'ALL')}>
              <option value="ALL">전체 상태</option>
              <option value="PENDING">대기 중</option>
              <option value="PROCESSING">처리 중</option>
              <option value="RETRY_WAIT">재시도 대기</option>
              <option value="COMPLETED">완료</option>
              <option value="FAILED">실패</option>
            </select>
          </label>
          <label>
            <span className="sr-only">검색 가능 여부 필터</span>
            <select value={searchable} onChange={(event) => setSearchable(event.target.value as typeof searchable)}>
              <option value="ALL">전체 문서</option>
              <option value="YES">검색 가능</option>
              <option value="NO">검색 불가</option>
            </select>
          </label>
          {(query || status !== 'ALL' || searchable !== 'ALL') && (
            <button className="link-button" type="button" onClick={() => { setQuery(''); setStatus('ALL'); setSearchable('ALL') }}>초기화</button>
          )}
        </div>

        {filteredDocuments.length === 0 ? (
          <div className="table-empty">
            <strong>조건에 맞는 문서가 없습니다</strong>
            <p>필터를 변경하거나 새 문서를 업로드해 주세요.</p>
          </div>
        ) : (
          <>
            <div className="table-container">
              <table className="document-table api-document-table">
                <thead>
                  <tr>
                    <th>문서</th>
                    <th>버전</th>
                    <th>인덱싱</th>
                    <th>검색 대상</th>
                    <th>생성일</th>
                    <th><span className="sr-only">상세 열기</span></th>
                  </tr>
                </thead>
                <tbody>
                  {visibleDocuments.map((document) => (
                    <tr key={document.id} onClick={() => onSelectDocument(document)}>
                      <td>
                        <button className="document-name" type="button" onClick={() => onSelectDocument(document)}>
                          <span className="file-type-icon" aria-hidden="true">{document.type}</span>
                          <span><strong>{document.name}</strong><small>{document.size}</small></span>
                        </button>
                      </td>
                      <td>
                        <div className="version-pair">
                          <span>업로드 <strong>v{document.latestUploadVersionNo}</strong></span>
                          <span>검색 <strong>{document.searchableVersionNo ? `v${document.searchableVersionNo}` : '—'}</strong></span>
                        </div>
                      </td>
                      <td>
                        <StatusBadge status={document.status} stage={document.stage} />
                        {document.status === 'PROCESSING' && document.progress !== null && (
                          <div className="mini-progress"><span style={{ width: `${document.progress}%` }} /></div>
                        )}
                      </td>
                      <td>
                        {(() => {
                          const completedVersions = document.versions.filter((version) => version.status === 'COMPLETED')
                          const canWrite = canWriteDocument(document)
                          const canSelectVersion = canWrite && completedVersions.length > 0
                          const isOpen = openVersionMenuId === document.id

                          return (
                            <div
                              className="version-selector"
                              ref={isOpen ? versionMenuRef : undefined}
                              onClick={(event) => event.stopPropagation()}
                            >
                              <button
                                className={`version-selector-trigger${document.searchableVersionNo ? ' active' : ''}`}
                                type="button"
                                aria-haspopup="dialog"
                                aria-expanded={isOpen}
                                disabled={!canSelectVersion}
                                title={!canWrite ? '쓰기 권한이 있어야 검색 대상 버전을 변경할 수 있습니다.' : completedVersions.length === 0 ? '인덱싱이 완료된 버전이 없습니다.' : '검색 대상 버전 변경'}
                                onClick={() => setOpenVersionMenuId(isOpen ? null : document.id)}
                              >
                                {document.searchableVersionNo ? (
                                  <span className="searchable-state"><i aria-hidden="true" /> v{document.searchableVersionNo} 사용 중</span>
                                ) : <span className="metadata">검색 불가</span>}
                                <span className="selector-chevron" aria-hidden="true">⌄</span>
                              </button>

                              {isOpen && (
                                <div className="version-selector-menu" role="dialog" aria-label={`${document.name} 검색 대상 버전 선택`}>
                                  <div className="version-selector-heading">
                                    <strong>검색 대상 버전</strong>
                                    <small>인덱싱이 완료된 버전만 선택할 수 있습니다.</small>
                                  </div>
                                  <div className="version-radio-list" role="radiogroup" aria-label="완료된 버전">
                                    {completedVersions.map((version) => (
                                      <label key={version.versionNo} className={version.searchable ? 'selected' : undefined}>
                                        <input
                                          type="radio"
                                          name={`searchable-version-${document.id}`}
                                          checked={version.searchable}
                                          onChange={() => {
                                            onSetSearchableVersion(document.id, version.versionNo)
                                            setOpenVersionMenuId(null)
                                          }}
                                        />
                                        <span>
                                          <strong>v{version.versionNo}</strong>
                                          <small>{version.originalFilename}</small>
                                        </span>
                                        <em>{version.searchable ? '사용 중' : '선택'}</em>
                                      </label>
                                    ))}
                                  </div>
                                  <button className="version-selector-footer" type="button" onClick={() => onOpenDocument(document.id)}>
                                    전체 버전 관리 <span aria-hidden="true">›</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          )
                        })()}
                      </td>
                      <td className="metadata">{formatDate(document.createdAt)}</td>
                      <td>
                        <button className="row-open-button" type="button" onClick={(event) => { event.stopPropagation(); onOpenDocument(document.id) }} aria-label={`${document.name} 상세 열기`}>
                          ›
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {visibleCount < filteredDocuments.length && (
              <div className="load-more-row">
                <button className="button secondary" type="button" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>더 보기</button>
              </div>
            )}
          </>
        )}
      </section>

      {selectedDocument && (
        <DocumentDrawer
          document={selectedDocument}
          onClose={() => onSelectDocument(null)}
          onOpenDetails={() => onOpenDocument(selectedDocument.id)}
        />
      )}
    </div>
  )
}
