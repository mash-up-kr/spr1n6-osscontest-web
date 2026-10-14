import type { IndexingInfo } from '../types'
import { StatusBadge } from './StatusBadge'

const phaseLabels: Record<string, string> = {
  DOWNLOADING: '다운로드',
  PARSING: '파싱',
  CHUNKING: '청킹',
  EMBEDDING: '임베딩',
}

export const formatDateTime = (value: string) => new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
}).format(new Date(value))

const formatTime = (value: string) => new Intl.DateTimeFormat('ko-KR', {
  hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
}).format(new Date(value))

export const phaseLabel = (phase: string) => phaseLabels[phase] ?? phase

export const formatNextRetry = (value: string, now: number = Date.now()) => {
  const seconds = Math.ceil((new Date(value).getTime() - now) / 1000)
  const relative = seconds <= 0 ? '곧 재시도' : seconds < 60 ? `약 ${seconds}초 후` : `약 ${Math.round(seconds / 60)}분 후`
  return `${formatTime(value)} (${relative})`
}

export const hasIndexingError = (indexing: IndexingInfo) => Boolean(indexing.lastErrorCode || indexing.lastErrorMessage)

export function IndexingErrorText({ indexing }: { indexing: IndexingInfo }) {
  if (!hasIndexingError(indexing)) return null
  return (
    <>
      {indexing.lastErrorCode && <code className="error-code">{indexing.lastErrorCode}</code>}
      {indexing.lastErrorCode && indexing.lastErrorMessage && ' '}
      {indexing.lastErrorMessage}
    </>
  )
}

/** `<dl>` 안에 넣는 인덱싱 항목 행. 감싸는 `<dl>`은 쓰는 쪽이 정한다. */
export function IndexingFacts({ indexing, withStatus = true }: { indexing: IndexingInfo; withStatus?: boolean }) {
  return (
    <>
      {withStatus && <div><dt>작업 상태</dt><dd><StatusBadge status={indexing.status} /></dd></div>}
      {indexing.status === 'PROCESSING' && indexing.phase && <div><dt>처리 단계</dt><dd>{phaseLabel(indexing.phase)}</dd></div>}
      <div><dt>시도 횟수</dt><dd>{indexing.attemptCount ?? '—'}</dd></div>
      <div><dt>청크 수</dt><dd>{indexing.chunkCount ?? '—'}</dd></div>
      <div><dt>시작 시각</dt><dd>{indexing.startedAt ? formatDateTime(indexing.startedAt) : '—'}</dd></div>
      <div><dt>완료 시각</dt><dd>{indexing.completedAt ? formatDateTime(indexing.completedAt) : '—'}</dd></div>
      {indexing.status === 'RETRY_WAIT' && indexing.nextRetryAt && <div><dt>다음 재시도</dt><dd>{formatNextRetry(indexing.nextRetryAt)}</dd></div>}
    </>
  )
}

/** Worker 는 성공 뒤에도 지난 오류를 비우지 않으므로 값이 아니라 상태로 콜아웃 종류를 정한다. */
export function IndexingErrorCallout({ indexing, canWrite, onRetry }: {
  indexing: IndexingInfo
  canWrite: boolean
  onRetry?: () => void
}) {
  if (indexing.status === 'COMPLETED' || !hasIndexingError(indexing)) return null
  const failed = indexing.status === 'FAILED'
  return (
    <div className={failed ? 'failure-callout wide-callout' : 'failure-callout retry-callout wide-callout'}>
      <span className="callout-symbol" aria-hidden="true">!</span>
      <div><strong>{failed ? '인덱싱 실패' : '직전 시도 오류'}</strong><p><IndexingErrorText indexing={indexing} /></p></div>
      {failed && onRetry && <button className="button secondary" type="button" onClick={onRetry} disabled={!canWrite}>재인덱싱</button>}
    </div>
  )
}
