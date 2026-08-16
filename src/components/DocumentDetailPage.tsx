import { useMemo, useState, type FormEvent } from 'react'
import type {
  DetailTab,
  DocumentItem,
  DocumentPermission,
  DocumentVersion,
  IndexingStage,
  PermissionLevel,
  PrincipalType,
  User,
} from '../types'
import { Modal } from './Modal'
import { StatusBadge } from './StatusBadge'
import { VersionDrawer } from './VersionDrawer'

type DocumentDetailPageProps = {
  document: DocumentItem
  user: User
  users: User[]
  initialVersionNo?: number | null
  onBack: () => void
  onRename: (title: string) => void
  onDelete: () => void
  onUploadVersion: (file: File) => void
  onRetryVersion: (versionNo: number) => void
  onSetSearchableVersion: (versionNo: number) => void
  onUpsertPermission: (permission: DocumentPermission) => void
  onRemovePermission: (permission: DocumentPermission) => void
  onNotify: (message: string, tone?: 'default' | 'success' | 'error') => void
}

const indexingStages: Array<{ key: IndexingStage; label: string; description: string }> = [
  { key: 'UPLOADED', label: '업로드 완료', description: 'API 서버에 원본 파일 저장' },
  { key: 'PARSING', label: '파싱', description: '텍스트와 문서 구조 추출' },
  { key: 'CHUNKING', label: '청킹', description: '검색에 사용할 단위로 내용 분할' },
  { key: 'EMBEDDING', label: '임베딩', description: '벡터 표현 생성' },
  { key: 'INDEXED', label: '인덱싱 완료', description: '자연어 검색 사용 가능' },
]

const tabLabels: Record<DetailTab, string> = {
  overview: '개요',
  versions: '버전',
  permissions: '권한',
}

const permissionLabel = (permission: PermissionLevel | null) => permission === 'WRITE' ? '쓰기' : permission === 'READ' ? '읽기' : '없음'

const formatDateTime = (value: string) => new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
}).format(new Date(value))

export function DocumentDetailPage({
  document, user, users, initialVersionNo, onBack, onRename, onDelete, onUploadVersion,
  onRetryVersion, onSetSearchableVersion, onUpsertPermission, onRemovePermission, onNotify,
}: DocumentDetailPageProps) {
  const [tab, setTab] = useState<DetailTab>(initialVersionNo ? 'versions' : 'overview')
  const [versionDetail, setVersionDetail] = useState<DocumentVersion | null>(
    initialVersionNo ? document.versions.find((version) => version.versionNo === initialVersionNo) ?? null : null,
  )
  const [modal, setModal] = useState<'rename' | 'delete' | 'upload-version' | 'searchable' | 'permission' | null>(null)
  const [newTitle, setNewTitle] = useState(document.name)
  const [newVersionFile, setNewVersionFile] = useState<File | null>(null)
  const [newVersionError, setNewVersionError] = useState<string | null>(null)
  const [visibleVersionCount, setVisibleVersionCount] = useState(2)
  const [targetVersion, setTargetVersion] = useState<DocumentVersion | null>(null)
  const [principalType, setPrincipalType] = useState<PrincipalType>('USER')
  const [principalId, setPrincipalId] = useState(users.find((candidate) => candidate.tenant === document.tenant)?.id ?? '')
  const [permissionLevel, setPermissionLevel] = useState<PermissionLevel>('READ')

  const currentPermission = useMemo(() => {
    const direct = document.permissions.find((permission) => permission.principalType === 'USER' && permission.principalId === user.id)
    const tenantPermission = document.permissions.find((permission) => permission.principalType === 'TENANT' && permission.principalName === user.tenant)
    return direct?.permission ?? tenantPermission?.permission ?? null
  }, [document.permissions, user.id, user.tenant])

  const canWrite = currentPermission === 'WRITE'
  const currentVersion = document.versions.find((version) => version.versionNo === document.latestUploadVersionNo) ?? document.versions[0]
  const activeStageIndex = indexingStages.findIndex((stage) => stage.key === document.stage)
  const tenantUsers = users.filter((candidate) => candidate.tenant === document.tenant)

  const openSearchableDialog = (version: DocumentVersion) => {
    setTargetVersion(version)
    setModal('searchable')
  }

  const selectNewVersionFile = (file: File | null) => {
    if (!file) return
    const extension = file.name.split('.').pop()?.toLowerCase()
    if (!extension || !['pdf', 'docx', 'md'].includes(extension)) {
      setNewVersionFile(null)
      setNewVersionError('지원하지 않는 파일 형식입니다. PDF, DOCX 또는 MD 파일을 선택해 주세요.')
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      setNewVersionFile(null)
      setNewVersionError('선택한 파일이 최대 업로드 용량인 20MB를 초과했습니다.')
      return
    }
    setNewVersionFile(file)
    setNewVersionError(null)
  }

  const savePermission = (event: FormEvent) => {
    event.preventDefault()
    const principalName = principalType === 'TENANT'
      ? document.tenant
      : tenantUsers.find((candidate) => candidate.id === principalId)?.name ?? principalId
    onUpsertPermission({ principalType, principalId: principalType === 'TENANT' ? (document.tenant === '테넌트 A' ? '1' : '2') : principalId, principalName, permission: permissionLevel })
    setModal(null)
  }

  return (
    <div className="page document-detail-page">
      <button className="breadcrumb" type="button" onClick={onBack}>‹ 문서 목록</button>

      <div className="detail-page-header">
        <div>
          <div className="detail-title-line">
            <h1>{document.name}</h1>
            <StatusBadge status={document.status} stage={document.stage} />
          </div>
          <p>최신 업로드 v{document.latestUploadVersionNo} · 검색 대상 {document.searchableVersionNo ? `v${document.searchableVersionNo}` : '없음'}</p>
        </div>
        <div className="detail-actions">
          <button className="button primary" type="button" onClick={() => setModal('upload-version')} disabled={!canWrite}>＋ 새 버전 업로드</button>
          <button className="button secondary" type="button" onClick={() => { setNewTitle(document.name); setModal('rename') }} disabled={!canWrite}>이름 변경</button>
          <button className="danger-text-button" type="button" onClick={() => setModal('delete')} disabled={!canWrite}>삭제</button>
        </div>
      </div>

      <nav className="detail-tabs" aria-label="문서 상세 메뉴">
        {(['overview', 'versions', 'permissions'] as DetailTab[]).map((item) => (
          <button key={item} type="button" className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>
            {tabLabels[item]}
            {item === 'versions' && <span>{document.versions.length}</span>}
            {item === 'permissions' && <span>{document.permissions.length}</span>}
          </button>
        ))}
      </nav>

      {tab === 'overview' && (
        <div className="detail-tab-content overview-tab">
          <section className="detail-section">
            <div className="detail-section-heading"><div><h2>버전 상태</h2><p>업로드, 임베딩, 검색이 서로 다른 버전을 가리킬 수 있습니다.</p></div></div>
            <div className="version-state-grid">
              <div><span>최신 업로드</span><strong>v{document.latestUploadVersionNo}</strong><small>{document.status === 'COMPLETED' ? '처리 완료' : '처리 중'}</small></div>
              <div><span>최신 임베딩</span><strong>{document.latestEmbeddingVersionNo ? `v${document.latestEmbeddingVersionNo}` : '—'}</strong><small>{document.latestEmbeddingVersionNo ? '처리 완료' : '없음'}</small></div>
              <div><span>검색 대상</span><strong>{document.searchableVersionNo ? `v${document.searchableVersionNo}` : '—'}</strong><small>{document.searchableVersionNo ? '사용 중' : '검색 불가'}</small></div>
            </div>
            {document.latestUploadVersionNo !== document.searchableVersionNo && document.searchableVersionNo && (
              <div className="information-callout"><span aria-hidden="true">i</span><p>버전 {document.latestUploadVersionNo}을 인덱싱하고 있습니다. 현재 검색에는 버전 {document.searchableVersionNo}을 사용합니다.</p></div>
            )}
          </section>

          <section className="detail-section indexing-overview">
            <div className="detail-section-heading">
              <div><h2>인덱싱 상태</h2><p>최신 업로드 버전의 실시간 처리 상태입니다.</p></div>
              <span className="live-label"><i aria-hidden="true" /> SSE 연결됨</span>
            </div>
            <div className="indexing-layout">
              <ol className="indexing-steps detail-indexing-steps">
                {indexingStages.map((stage, index) => {
                  const complete = document.status === 'COMPLETED' || index < activeStageIndex
                  const active = index === activeStageIndex && document.status !== 'COMPLETED'
                  const failed = active && document.status === 'FAILED'
                  return (
                    <li key={stage.key} className={complete ? 'complete' : failed ? 'failed' : active ? 'active' : 'pending'}>
                      <span className="step-marker" aria-hidden="true">{complete ? '✓' : failed ? '!' : ''}</span>
                      <div><strong>{stage.label}</strong><small>{stage.description}</small></div>
                      <span className="step-state">{complete ? '완료' : failed ? '실패' : active ? '현재 단계' : '대기'}</span>
                    </li>
                  )
                })}
              </ol>
              <dl className="job-facts">
                <div><dt>작업 상태</dt><dd><StatusBadge status={document.status} stage={document.stage} /></dd></div>
                <div><dt>시도 횟수</dt><dd>{currentVersion?.attemptCount ?? 1}</dd></div>
                <div><dt>진행률</dt><dd>{document.progress === null ? '—' : `${document.progress}%`}</dd></div>
                <div><dt>청크 수</dt><dd>{document.chunks ?? '—'}</dd></div>
                <div><dt>시작 시각</dt><dd>{currentVersion?.startedAt ? formatDateTime(currentVersion.startedAt) : '—'}</dd></div>
                <div><dt>완료 시각</dt><dd>{currentVersion?.completedAt ? formatDateTime(currentVersion.completedAt) : '—'}</dd></div>
              </dl>
            </div>
            {(document.status === 'FAILED' || document.status === 'RETRY_WAIT') && (
              <div className={document.status === 'FAILED' ? 'failure-callout wide-callout' : 'failure-callout retry-callout wide-callout'}>
                <span className="callout-symbol" aria-hidden="true">!</span>
                <div>
                  <strong>{document.status === 'FAILED' ? '인덱싱 실패' : '재시도 대기 중'}</strong>
                  <p>{document.error}</p>
                  <p>시도 {currentVersion?.attemptCount ?? 1} / 3{currentVersion?.nextRetry ? ` · 다음 재시도 ${currentVersion.nextRetry}` : ''}</p>
                </div>
                {document.status === 'FAILED' && currentVersion && <button className="button secondary" type="button" onClick={() => onRetryVersion(currentVersion.versionNo)} disabled={!canWrite}>재인덱싱</button>}
              </div>
            )}
          </section>

          <section className="detail-section document-info-section">
            <div className="detail-section-heading"><div><h2>문서 정보</h2><p>사용자에게 필요한 문서 정보만 표시하며 내부 식별자는 숨깁니다.</p></div></div>
            <dl>
              <div><dt>생성 시각</dt><dd>{formatDateTime(document.createdAt)}</dd></div>
              <div><dt>최신 업로드</dt><dd>버전 {document.latestUploadVersionNo}</dd></div>
              <div><dt>최신 임베딩</dt><dd>{document.latestEmbeddingVersionNo ? `버전 ${document.latestEmbeddingVersionNo}` : '—'}</dd></div>
              <div><dt>검색 대상</dt><dd>{document.searchableVersionNo ? `버전 ${document.searchableVersionNo}` : '없음'}</dd></div>
              <div><dt>내 권한</dt><dd>{permissionLabel(currentPermission)}</dd></div>
            </dl>
          </section>
        </div>
      )}

      {tab === 'versions' && (
        <section className="detail-section versions-section">
          <div className="detail-section-heading">
            <div><h2>버전</h2><p>업로드된 파일을 관리하고 검색에 사용할 완료 버전을 선택합니다.</p></div>
            <button className="button secondary" type="button" onClick={() => setModal('upload-version')} disabled={!canWrite}>＋ 새 버전 업로드</button>
          </div>
          <div className="table-container">
            <table className="document-table version-table">
              <thead><tr><th>버전</th><th>파일</th><th>인덱싱</th><th>청크</th><th>검색 대상</th><th>업로드 시각</th><th>작업</th></tr></thead>
              <tbody>
                {document.versions.slice(0, visibleVersionCount).map((version) => (
                  <tr key={version.versionNo} className={initialVersionNo === version.versionNo ? 'highlighted-row' : undefined}>
                    <td><strong>v{version.versionNo}</strong>{version.duplicateOfVersionNo && <small className="duplicate-label">v{version.duplicateOfVersionNo}과 동일</small>}</td>
                    <td><button className="version-file-button" type="button" onClick={() => setVersionDetail(version)}><strong>{version.originalFilename}</strong><small>{version.fileSize} · {version.mimeType}</small></button></td>
                    <td><StatusBadge status={version.status} stage={version.stage} /><small className="attempt-label">시도 {version.attemptCount}회</small></td>
                    <td>{version.chunkCount ?? '—'}</td>
                    <td>{version.searchable ? <span className="searchable-state"><i aria-hidden="true" /> 사용 중</span> : '아님'}</td>
                    <td className="metadata">{formatDateTime(version.uploadedAt)}</td>
                    <td>
                      <div className="table-actions">
                        <button type="button" onClick={() => setVersionDetail(version)}>상세</button>
                        <button type="button" onClick={() => onNotify(`${version.originalFilename} 다운로드를 시작합니다.`, 'success')}>다운로드</button>
                        {version.status === 'COMPLETED' && !version.searchable && <button type="button" onClick={() => openSearchableDialog(version)} disabled={!canWrite}>검색에 사용</button>}
                        {version.status === 'FAILED' && <button type="button" onClick={() => onRetryVersion(version.versionNo)} disabled={!canWrite}>재시도</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {visibleVersionCount < document.versions.length && (
            <div className="load-more-row"><button className="button secondary" type="button" onClick={() => setVisibleVersionCount((count) => count + 10)}>버전 더 보기</button></div>
          )}
        </section>
      )}

      {tab === 'permissions' && (
        <section className="detail-section permissions-section">
          <div className="detail-section-heading">
            <div><h2>권한</h2><p>이 문서를 읽거나 수정할 수 있는 사용자와 테넌트를 관리합니다.</p></div>
            <button className="button secondary" type="button" onClick={() => setModal('permission')} disabled={!canWrite}>＋ 권한 부여</button>
          </div>
          <div className={canWrite ? 'access-summary' : 'access-summary read-only'}>
            <strong>내 권한: {permissionLabel(currentPermission)}</strong>
            <span>{canWrite ? '문서 접근 권한을 관리할 수 있습니다.' : '쓰기 권한이 있는 사용자만 접근 권한을 변경할 수 있습니다.'}</span>
          </div>
          <div className="table-container">
            <table className="document-table permission-table">
              <thead><tr><th>대상</th><th>유형</th><th>권한</th><th>작업</th></tr></thead>
              <tbody>
                {document.permissions.map((permission) => (
                  <tr key={`${permission.principalType}-${permission.principalId}`}>
                    <td><strong>{permission.principalName}</strong></td>
                    <td className="metadata">{permission.principalType === 'USER' ? '사용자' : '테넌트'}</td>
                    <td><span className={`permission-badge permission-${permission.permission.toLowerCase()}`}>{permissionLabel(permission.permission)}</span></td>
                    <td>
                      <div className="table-actions">
                        <button type="button" disabled={!canWrite} onClick={() => onUpsertPermission({ ...permission, permission: permission.permission === 'READ' ? 'WRITE' : 'READ' })}>{permission.permission === 'READ' ? '쓰기로 변경' : '읽기로 변경'}</button>
                        <button className="danger" type="button" disabled={!canWrite || (permission.principalType === 'USER' && permission.principalId === user.id)} onClick={() => onRemovePermission(permission)}>회수</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {versionDetail && <VersionDrawer version={versionDetail} onClose={() => setVersionDetail(null)} onDownload={() => onNotify(`${versionDetail.originalFilename} 다운로드를 시작합니다.`, 'success')} />}

      {modal === 'rename' && (
        <Modal title="문서 이름 변경" description="이름을 변경해도 재인덱싱은 실행되지 않습니다." onClose={() => setModal(null)}>
          <form onSubmit={(event) => { event.preventDefault(); if (newTitle.trim()) { onRename(newTitle.trim()); setModal(null) } }}>
            <div className="modal-body"><label className="field-stack"><span>문서 제목</span><input value={newTitle} onChange={(event) => setNewTitle(event.target.value)} autoFocus /></label></div>
            <div className="modal-actions"><button className="button secondary" type="button" onClick={() => setModal(null)}>취소</button><button className="button primary" type="submit" disabled={!newTitle.trim()}>저장</button></div>
          </form>
        </Modal>
      )}

      {modal === 'delete' && (
        <Modal title="문서를 삭제할까요?" description={`${document.name} 문서를 더 이상 조회하거나 검색할 수 없습니다.`} onClose={() => setModal(null)}>
          <div className="modal-body"><div className="destructive-note">원본 파일과 청크는 이후 정리 작업에서 삭제됩니다. 이 콘솔에서는 삭제를 되돌릴 수 없습니다.</div></div>
          <div className="modal-actions"><button className="button secondary" type="button" onClick={() => setModal(null)}>취소</button><button className="button danger-button" type="button" onClick={onDelete}>문서 삭제</button></div>
        </Modal>
      )}

      {modal === 'upload-version' && (
        <Modal title="새 버전 업로드" description={`${document.name} 문서에 새 버전을 추가합니다.`} onClose={() => setModal(null)}>
          <form onSubmit={(event) => { event.preventDefault(); if (newVersionFile) { onUploadVersion(newVersionFile); setNewVersionFile(null); setModal(null) } }}>
            <div className="modal-body">
              <div className="current-version-note"><span>현재 최신 버전</span><strong>v{document.latestUploadVersionNo}</strong></div>
              <label className="file-picker"><input type="file" accept=".pdf,.docx,.md" onChange={(event) => selectNewVersionFile(event.target.files?.[0] ?? null)} /><span>{newVersionFile ? newVersionFile.name : 'PDF, DOCX 또는 MD 파일 선택'}</span><small>같은 내용의 파일을 올려도 새 버전이 생성됩니다.</small></label>
              {newVersionError && <p className="form-error" role="alert">{newVersionError}</p>}
            </div>
            <div className="modal-actions"><button className="button secondary" type="button" onClick={() => setModal(null)}>취소</button><button className="button primary" type="submit" disabled={!newVersionFile}>버전 업로드</button></div>
          </form>
        </Modal>
      )}

      {modal === 'searchable' && targetVersion && (
        <Modal title={`검색에 버전 ${targetVersion.versionNo}을 사용할까요?`} description="이 문서의 검색 결과는 선택한 버전을 기준으로 제공됩니다." onClose={() => setModal(null)}>
          <div className="modal-body"><div className="information-callout"><span aria-hidden="true">i</span><p>더 최신 버전의 임베딩이 완료되면 검색 대상 버전은 자동으로 최신 버전으로 이동합니다.</p></div></div>
          <div className="modal-actions"><button className="button secondary" type="button" onClick={() => setModal(null)}>취소</button><button className="button primary" type="button" onClick={() => { onSetSearchableVersion(targetVersion.versionNo); setModal(null) }}>버전 {targetVersion.versionNo} 사용</button></div>
        </Modal>
      )}

      {modal === 'permission' && (
        <Modal title="권한 부여" description="사용자 또는 테넌트의 문서 접근 권한을 추가하거나 변경합니다." onClose={() => setModal(null)}>
          <form onSubmit={savePermission}>
            <div className="modal-body form-grid">
              <label className="field-stack"><span>대상 유형</span><select value={principalType} onChange={(event) => setPrincipalType(event.target.value as PrincipalType)}><option value="USER">사용자</option><option value="TENANT">테넌트</option></select></label>
              {principalType === 'USER' ? (
                <label className="field-stack"><span>권한 대상</span><select value={principalId} onChange={(event) => setPrincipalId(event.target.value)}>{tenantUsers.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}</select></label>
              ) : <div className="field-stack"><span>권한 대상</span><div className="readonly-field">{document.tenant}</div></div>}
              <label className="field-stack"><span>권한</span><select value={permissionLevel} onChange={(event) => setPermissionLevel(event.target.value as PermissionLevel)}><option value="READ">읽기</option><option value="WRITE">쓰기</option></select></label>
            </div>
            <div className="modal-actions"><button className="button secondary" type="button" onClick={() => setModal(null)}>취소</button><button className="button primary" type="submit">권한 저장</button></div>
          </form>
        </Modal>
      )}
    </div>
  )
}
