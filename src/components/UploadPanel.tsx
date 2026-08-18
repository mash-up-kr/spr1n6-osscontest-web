import { useRef, useState, type DragEvent } from 'react'

type UploadPanelProps = {
  onClose: () => void
  onUpload: (file: File, title?: string) => void
}

export function UploadPanel({ onClose, onUpload }: UploadPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)

  const selectFile = (nextFile?: File) => {
    if (!nextFile) return
    const extension = nextFile.name.split('.').pop()?.toLowerCase()
    if (!extension || !['pdf', 'docx', 'md'].includes(extension)) {
      setValidationError('지원하지 않는 파일 형식입니다. PDF, DOCX 또는 MD 파일을 선택해 주세요.')
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

  const startUpload = () => {
    if (!file || uploadProgress !== null) return
    setUploadProgress(12)
    const timer = window.setInterval(() => {
      setUploadProgress((progress) => Math.min((progress ?? 0) + 18, 94))
    }, 150)

    window.setTimeout(() => {
      window.clearInterval(timer)
      setUploadProgress(100)
      onUpload(file, title.trim() || undefined)
      window.setTimeout(onClose, 260)
    }, 900)
  }

  return (
    <section className="upload-panel" aria-labelledby="upload-heading">
      <div className="upload-panel-header">
        <div>
          <h2 id="upload-heading">문서 업로드</h2>
          <p>업로드가 끝나면 문서 인덱싱이 비동기로 시작됩니다.</p>
        </div>
        <button className="icon-button" type="button" onClick={onClose} aria-label="업로드 영역 닫기">×</button>
      </div>

      <label className="field-stack" htmlFor="document-title">
        <span>문서 제목 <small>선택 사항</small></span>
        <input
          id="document-title"
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="비워두면 파일명을 사용합니다"
          disabled={uploadProgress !== null}
        />
      </label>

      <div
        className={isDragging ? 'dropzone dragging' : 'dropzone'}
        onDragEnter={(event) => {
          event.preventDefault()
          setIsDragging(true)
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          id="document-upload"
          type="file"
          accept=".pdf,.docx,.md"
          onChange={(event) => selectFile(event.target.files?.[0])}
          disabled={uploadProgress !== null}
        />
        <span className="upload-arrow" aria-hidden="true">↑</span>
        <div>
          <strong>{file ? file.name : '여기에 문서를 끌어다 놓으세요'}</strong>
          <p>
            {file
              ? `${Math.max(file.size / 1024 / 1024, 0.1).toFixed(1)} MB · 업로드 준비됨`
              : 'HWP, DOCX, TXT 또는 MD · 최대 20MB'}
          </p>
        </div>
        <button className="link-button" type="button" onClick={() => inputRef.current?.click()} disabled={uploadProgress !== null}>
          {file ? '다른 파일 선택' : '파일 선택'}
        </button>
      </div>

      {validationError && <p className="form-error" role="alert">{validationError}</p>}

      {uploadProgress !== null && (
        <div className="uploading-row" aria-live="polite">
          <span>{file?.name} 업로드 중</span>
          <strong>{uploadProgress}%</strong>
          <div className="upload-track"><span style={{ width: `${uploadProgress}%` }} /></div>
        </div>
      )}

      <div className="upload-actions">
        <button className="button secondary" type="button" onClick={onClose} disabled={uploadProgress !== null}>취소</button>
        <button className="button primary" type="button" onClick={startUpload} disabled={!file || uploadProgress !== null}>
          {uploadProgress !== null ? '업로드 중…' : '업로드'}
        </button>
      </div>
    </section>
  )
}
