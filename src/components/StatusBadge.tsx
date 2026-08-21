import type { DocumentStatus } from '../types'

const labels: Record<DocumentStatus, string> = {
  PENDING: '대기 중',
  PROCESSING: '처리 중',
  COMPLETED: '인덱싱 완료',
  RETRY_WAIT: '재시도 대기',
  FAILED: '실패',
}

export function StatusBadge({ status }: { status: DocumentStatus }) {
  const symbol = status === 'COMPLETED' ? '✓' : status === 'FAILED' ? '!' : status === 'RETRY_WAIT' ? '◷' : '●'
  return (
    <span className={`status-badge status-${status.toLowerCase()}`}>
      <span aria-hidden="true">{symbol}</span>
      {labels[status]}
    </span>
  )
}
