import { useRef, useState, type DragEvent } from 'react'
import { apiErrorMessage } from '../api/client'

type UploadPanelProps = {
  onClose: () => void
  onUpload: (file: File, title?: string) => Promise<void>
}

const allowedExtensions = ['pdf', 'docx', 'md', 'markdown', 'hwp', 'txt']

export function UploadPanel({ onClose, onUpload }: UploadPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  const selectFile = (nextFile?: File) => {
    if (!nextFile) return
    const extension = nextFile.name.split('.').pop()?.toLowerCase()
    if (!extension || !allowedExtensions.includes(extension)) {
      setValidationError('PDF, DOCX, Markdown, HWP 또는 TXT 파일을 선택해 주세요.')
      setFile(null)
      return
    }
    if (nextFile.size > 20 * 1024 * 1024) {
      setValidationError('선택한 파일이 최대 업로드 용량인 20MB를 초과했습니다.')
      setFile(null)
      return
    }
    setValidationError(null)
    setFile(nextFile)
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
    selectFile(event.dataTransfer.files[0])
  }

  const startUpload = async () => {
    if (!file || isUploading) return
    setIsUploading(true)
    setValidationError(null)
    try {
      await onUpload(file, title.trim() || undefined)
      onClose()
    } catch (error) {
      setValidationError(apiErrorMessage(error))
      setIsUploading(false)
    }
  }

  return (
    <section className="upload-panel" aria-labelledby="upload-heading">
      <div className="upload-panel-header">
        <div>
          <h2 id="upload-heading">문서 업로드</h2>
          <p>업로드가 끝나면 문서 인덱싱이 비동기로 시작됩니다.</p>
        </div>
        <button className="icon-button" type="button" onClick={onClose} aria-label="업로드 영역 닫기" disabled={isUploading}>×</button>
      </div>

      <label className="field-stack" htmlFor="document-title">
        <span>문서 제목 <small>선택 사항</small></span>
        <input
          id="document-title"
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="비워두면 파일명을 사용합니다"
          disabled={isUploading}
        />
      </label>

      <div
        className={isDragging ? 'dropzone dragging' : 'dropzone'}
        onDragEnter={(event) => { event.preventDefault(); setIsDragging(true) }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          id="document-upload"
          type="file"
          accept=".pdf,.docx,.md,.markdown,.hwp,.txt"
          onChange={(event) => selectFile(event.target.files?.[0])}
          disabled={isUploading}
        />
        <span className="upload-arrow" aria-hidden="true">↑</span>
        <div>
          <strong>{file ? file.name : '여기에 문서를 끌어다 놓으세요'}</strong>
          <p>{file ? `${Math.max(file.size / 1024 / 1024, 0.1).toFixed(1)} MB · 업로드 준비됨` : 'PDF, DOCX, Markdown, HWP, TXT · 최대 20MB'}</p>
        </div>
        <button className="link-button" type="button" onClick={() => inputRef.current?.click()} disabled={isUploading}>
          {file ? '다른 파일 선택' : '파일 선택'}
        </button>
      </div>

      {validationError && <p className="form-error" role="alert">{validationError}</p>}
      {isUploading && <div className="uploading-row" aria-live="polite"><span className="spinner dark" aria-hidden="true" /><strong>{file?.name} 업로드 중…</strong></div>}

      <div className="upload-actions">
        <button className="button secondary" type="button" onClick={onClose} disabled={isUploading}>취소</button>
        <button className="button primary" type="button" onClick={startUpload} disabled={!file || isUploading}>
          {isUploading ? '업로드 중…' : '업로드'}
        </button>
      </div>
    </section>
  )
}
