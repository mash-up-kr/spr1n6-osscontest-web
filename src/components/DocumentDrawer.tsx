import { useEffect } from 'react'
import type { DocumentSummary } from '../types'
import { StatusBadge } from './StatusBadge'

type DocumentDrawerProps = {
  document: DocumentSummary
  onClose: () => void
  onOpenDetails: () => void
}

export function DocumentDrawer({ document, onClose, onOpenDetails }: DocumentDrawerProps) {
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.document.addEventListener('keydown', handleEscape)
    return () => window.document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  return (
    <>
      <button className="drawer-backdrop" type="button" onClick={onClose} aria-label="문서 요약 닫기" />
      <aside className="document-drawer" aria-labelledby="drawer-title">
        <div className="drawer-header">
          <div><span className="file-label">문서</span><h2 id="drawer-title">{document.title}</h2><StatusBadge status={document.latestVersionIndexingStatus} /></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="문서 요약 닫기">×</button>
        </div>

        <div className="drawer-section">
          <h3>버전 상태</h3>
          <dl className="summary-list">
            <div><dt>최신 업로드</dt><dd>v{document.latestUploadVersionNo}</dd></div>
            <div><dt>최신 임베딩</dt><dd>{document.latestEmbeddingVersionNo ? `v${document.latestEmbeddingVersionNo}` : '—'}</dd></div>
            <div><dt>검색 대상</dt><dd>{document.searchableVersionNo ? `v${document.searchableVersionNo}` : '검색 불가'}</dd></div>
          </dl>
          {document.latestUploadVersionNo !== document.searchableVersionNo && document.searchableVersionNo && <div className="version-note">최신 버전을 처리 중입니다. 현재 검색에는 버전 {document.searchableVersionNo}을 사용합니다.</div>}
        </div>

        <div className="drawer-section">
          <div className="drawer-section-title"><h3>최신 버전 인덱싱</h3><span>주기적으로 갱신</span></div>
          <div className="information-callout"><span aria-hidden="true">i</span><p>업로드 응답은 인덱싱 완료를 기다리지 않습니다. 완료 또는 실패 상태가 될 때까지 서버 상태를 조회합니다.</p></div>
        </div>

        <div className="drawer-footer"><button className="button primary" type="button" onClick={onOpenDetails}>문서 상세 보기</button></div>
      </aside>
    </>
  )
}
