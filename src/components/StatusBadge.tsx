import type { DocumentStatus, IndexingStage } from '../types'

const labels: Record<DocumentStatus, string> = {
  PENDING: '대기 중',
  PROCESSING: '처리 중',
  COMPLETED: '인덱싱 완료',
  RETRY_WAIT: '재시도 대기',
  FAILED: '실패',
}

const stageLabels: Record<IndexingStage, string> = {
  UPLOADED: '업로드 완료',
  PARSING: '파싱',
  CHUNKING: '청킹',
  EMBEDDING: '임베딩',
  INDEXED: '인덱싱 완료',
}

export function StatusBadge({ status, stage }: { status: DocumentStatus; stage?: IndexingStage }) {
  const symbol = status === 'COMPLETED' ? '✓' : status === 'FAILED' ? '!' : status === 'RETRY_WAIT' ? '◷' : '●'
  const label = status === 'PROCESSING' && stage ? stageLabels[stage] : labels[status]
  return (
    <span className={`status-badge status-${status.toLowerCase()}`}>
      <span aria-hidden="true">{symbol}</span>
      {label}
    </span>
  )
}
