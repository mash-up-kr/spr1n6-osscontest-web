import { useEffect } from 'react'
import type { DocumentVersion } from '../types'
import { StatusBadge } from './StatusBadge'

type VersionDrawerProps = {
  version: DocumentVersion
  onClose: () => void
  onDownload: () => Promise<void>
}

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`
}

const metadataValue = (value: unknown) => typeof value === 'string' ? value : JSON.stringify(value)

export function VersionDrawer({ version, onClose, onDownload }: VersionDrawerProps) {
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.document.addEventListener('keydown', handleEscape)
    return () => window.document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  return (
    <>
      <button className="drawer-backdrop" type="button" onClick={onClose} aria-label="버전 상세 닫기" />
      <aside className="document-drawer version-drawer" aria-labelledby="version-drawer-title">
        <div className="drawer-header">
          <div><span className="file-label">버전</span><h2 id="version-drawer-title">버전 {version.versionNo}</h2><p className="drawer-filename">{version.originalFilename}</p><StatusBadge status={version.indexing.status} /></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="버전 상세 닫기">×</button>
        </div>

        <div className="drawer-section document-details"><h3>파일</h3><dl>
          <div><dt>형식</dt><dd>{version.mimeType}</dd></div><div><dt>크기</dt><dd>{formatBytes(version.fileSize)}</dd></div>
          <div><dt>업로드 시각</dt><dd>{new Date(version.uploadedAt).toLocaleString('ko-KR')}</dd></div><div><dt>검색 대상</dt><dd>{version.searchable ? '사용 중' : '아님'}</dd></div>
        </dl></div>

        <div className="drawer-section document-details"><h3>인덱싱</h3><dl>
          <div><dt>시도 횟수</dt><dd>{version.indexing.attemptCount ?? '—'}</dd></div><div><dt>청크 수</dt><dd>{version.indexing.chunkCount ?? '—'}</dd></div>
          <div><dt>시작 시각</dt><dd>{version.indexing.startedAt ? new Date(version.indexing.startedAt).toLocaleString('ko-KR') : '—'}</dd></div>
          <div><dt>완료 시각</dt><dd>{version.indexing.completedAt ? new Date(version.indexing.completedAt).toLocaleString('ko-KR') : '—'}</dd></div>
          <div><dt>마지막 오류</dt><dd>{version.indexing.lastErrorMessage ?? '—'}</dd></div>
        </dl></div>

        <div className="drawer-section metadata-section"><h3>원본 메타데이터</h3><dl>{Object.entries(version.sourceMetadata ?? {}).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{metadataValue(value)}</dd></div>)}</dl></div>
        <div className="drawer-section metadata-section"><h3>추출 메타데이터</h3><dl>{Object.entries(version.extractedMetadata ?? {}).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{metadataValue(value)}</dd></div>)}</dl></div>
        <div className="drawer-footer"><button className="button primary" type="button" onClick={() => void onDownload()}>원본 다운로드</button></div>
      </aside>
    </>
  )
}
