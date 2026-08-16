import { useEffect } from 'react'
import type { DocumentItem, IndexingStage } from '../types'
import { StatusBadge } from './StatusBadge'

type DocumentDrawerProps = {
  document: DocumentItem
  onClose: () => void
  onOpenDetails: () => void
}

const stages: Array<{ key: IndexingStage; label: string }> = [
  { key: 'UPLOADED', label: '업로드 완료' },
  { key: 'PARSING', label: '파싱' },
  { key: 'CHUNKING', label: '청킹' },
  { key: 'EMBEDDING', label: '임베딩' },
  { key: 'INDEXED', label: '인덱싱 완료' },
]

export function DocumentDrawer({ document, onClose, onOpenDetails }: DocumentDrawerProps) {
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.document.addEventListener('keydown', handleEscape)
    return () => window.document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  const activeIndex = stages.findIndex((stage) => stage.key === document.stage)

  return (
    <>
      <button className="drawer-backdrop" type="button" onClick={onClose} aria-label="문서 요약 닫기" />
      <aside className="document-drawer" aria-labelledby="drawer-title">
        <div className="drawer-header">
          <div>
            <span className="file-label">{document.type}</span>
            <h2 id="drawer-title">{document.name}</h2>
            <StatusBadge status={document.status} stage={document.stage} />
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="문서 요약 닫기">×</button>
        </div>

        <div className="drawer-section">
          <h3>버전 상태</h3>
          <dl className="summary-list">
            <div><dt>최신 업로드</dt><dd>v{document.latestUploadVersionNo}</dd></div>
            <div><dt>최신 임베딩</dt><dd>{document.latestEmbeddingVersionNo ? `v${document.latestEmbeddingVersionNo}` : '—'}</dd></div>
            <div><dt>검색 대상</dt><dd>{document.searchableVersionNo ? `v${document.searchableVersionNo}` : '검색 불가'}</dd></div>
          </dl>
          {document.latestUploadVersionNo !== document.searchableVersionNo && document.searchableVersionNo && (
            <div className="version-note">버전 {document.latestUploadVersionNo}을 처리 중입니다. 현재 검색에는 버전 {document.searchableVersionNo}을 사용합니다.</div>
          )}
        </div>

        <div className="drawer-section">
          <div className="drawer-section-title"><h3>인덱싱</h3><span>실시간 상태</span></div>
          <ol className="indexing-steps compact-steps">
            {stages.map((stage, index) => {
              const complete = document.status === 'COMPLETED' || index < activeIndex
              const active = index === activeIndex && document.status !== 'COMPLETED'
              const failed = active && document.status === 'FAILED'
              return (
                <li key={stage.key} className={complete ? 'complete' : failed ? 'failed' : active ? 'active' : 'pending'}>
                  <span className="step-marker" aria-hidden="true">{complete ? '✓' : failed ? '!' : ''}</span>
                  <div><strong>{stage.label}</strong></div>
                  <span className="step-state">{complete ? '완료' : failed ? '실패' : active ? '현재 단계' : '대기'}</span>
                </li>
              )
            })}
          </ol>
          <div className="drawer-progress">
            <div><span>전체 진행률</span><strong>{document.progress === null ? '—' : `${document.progress}%`}</strong></div>
            <div className="progress-track"><span style={{ width: `${document.progress ?? 0}%` }} /></div>
          </div>
        </div>

        {(document.status === 'FAILED' || document.status === 'RETRY_WAIT') && (
          <div className={document.status === 'FAILED' ? 'failure-callout' : 'failure-callout retry-callout'}>
            <span className="callout-symbol" aria-hidden="true">!</span>
            <div><strong>{document.status === 'FAILED' ? '인덱싱 실패' : '재시도 대기 중'}</strong><p>{document.error}</p></div>
          </div>
        )}

        <div className="drawer-footer">
          <button className="button primary" type="button" onClick={onOpenDetails}>문서 상세 보기</button>
        </div>
      </aside>
    </>
  )
}
