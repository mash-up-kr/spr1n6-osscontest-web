import { useMemo, useState, type FormEvent } from 'react'
import type {
  DetailTab,
  DocumentDetail,
  DocumentPermission,
  DocumentVersion,
  PermissionLevel,
  PrincipalType,
  User,
} from '../types'
import { Modal } from './Modal'
import { StatusBadge } from './StatusBadge'
import { VersionDrawer } from './VersionDrawer'

type DocumentDetailPageProps = {
  document: DocumentDetail
  user: User
  users: User[]
  initialVersionNo?: number | null
  onBack: () => void
  onRename: (title: string) => Promise<void>
  onDelete: () => Promise<void>
  onUploadVersion: (file: File) => Promise<void>
  onRetryVersion: (versionNo: number) => Promise<void>
  onSetSearchableVersion: (versionNo: number) => Promise<void>
  onLoadVersionDetail: (versionNo: number) => Promise<DocumentVersion>
  onDownloadVersion: (version: DocumentVersion) => Promise<void>
  onUpsertPermission: (permission: DocumentPermission) => Promise<void>
  onRemovePermission: (permission: DocumentPermission) => Promise<void>
}

const tabLabels: Record<DetailTab, string> = { overview: '개요', versions: '버전', permissions: '권한' }
const allowedExtensions = ['pdf', 'docx', 'md', 'markdown', 'hwp', 'txt']
const permissionLabel = (permission: PermissionLevel | null) => permission === 'WRITE' ? '쓰기' : permission === 'READ' ? '읽기' : '없음'
const formatDateTime = (value: string) => new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
}).format(new Date(value))
const formatBytes = (bytes: number) => bytes < 1024 ** 2 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 ** 2).toFixed(1)} MB`

export function DocumentDetailPage({
  document, user, users, initialVersionNo, onBack, onRename, onDelete, onUploadVersion,
  onRetryVersion, onSetSearchableVersion, onLoadVersionDetail, onDownloadVersion,
  onUpsertPermission, onRemovePermission,
}: DocumentDetailPageProps) {
  const [tab, setTab] = useState<DetailTab>(initialVersionNo ? 'versions' : 'overview')
  const [versionDetail, setVersionDetail] = useState<DocumentVersion | null>(null)
  const [loadingVersionNo, setLoadingVersionNo] = useState<number | null>(null)
  const [modal, setModal] = useState<'rename' | 'delete' | 'upload-version' | 'searchable' | 'permission' | null>(null)
  const [newTitle, setNewTitle] = useState(document.title)
  const [newVersionFile, setNewVersionFile] = useState<File | null>(null)
  const [newVersionError, setNewVersionError] = useState<string | null>(null)
  const [visibleVersionCount, setVisibleVersionCount] = useState(10)
  const [targetVersion, setTargetVersion] = useState<DocumentVersion | null>(null)
  const [principalType, setPrincipalType] = useState<PrincipalType>('USER')
  const [principalId, setPrincipalId] = useState(users.find((candidate) => candidate.tenantId === user.tenantId)?.id ?? '')
  const [permissionLevel, setPermissionLevel] = useState<PermissionLevel>('READ')
  const [isSaving, setIsSaving] = useState(false)

  const currentPermission = useMemo(() => {
    const direct = document.permissions.find((permission) => permission.principalType === 'USER' && permission.principalId === user.id)
    const tenantPermission = document.permissions.find((permission) => permission.principalType === 'TENANT' && permission.principalId === user.tenantId)
    return direct?.permission ?? tenantPermission?.permission ?? null
  }, [document.permissions, user.id, user.tenantId])

  const canWrite = document.permissionsAvailable && currentPermission === 'WRITE'
  const tenantUsers = users.filter((candidate) => candidate.tenantId === user.tenantId)

  const principalName = (permission: DocumentPermission) => {
    if (permission.principalType === 'TENANT') return permission.principalId === user.tenantId ? user.tenant : `테넌트 ${permission.principalId}`
    return users.find((candidate) => candidate.id === permission.principalId)?.name ?? permission.principalId
  }

  const selectNewVersionFile = (file: File | null) => {
    if (!file) return
    const extension = file.name.split('.').pop()?.toLowerCase()
    if (!extension || !allowedExtensions.includes(extension)) {
      setNewVersionFile(null)
      setNewVersionError('PDF, DOCX, Markdown, HWP 또는 TXT 파일을 선택해 주세요.')
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

  const openVersionDetail = async (versionNo: number) => {
    setLoadingVersionNo(versionNo)
    try { setVersionDetail(await onLoadVersionDetail(versionNo)) } catch { /* 상위 Toast 사용 */ } finally { setLoadingVersionNo(null) }
  }

  const savePermission = async (event: FormEvent) => {
    event.preventDefault()
    setIsSaving(true)
    try {
      await onUpsertPermission({
        principalType,
        principalId: principalType === 'TENANT' ? user.tenantId : principalId,
        permission: permissionLevel,
      })
      setModal(null)
    } catch {
      // 상위에서 API 오류를 Toast로 표시한다.
    } finally { setIsSaving(false) }
  }

  return (
    <div className="page document-detail-page">
      <button className="breadcrumb" type="button" onClick={onBack}>‹ 문서 목록</button>

      <div className="detail-page-header">
        <div><div className="detail-title-line"><h1>{document.title}</h1><StatusBadge status={document.latestVersionIndexingStatus} /></div><p>최신 업로드 v{document.latestUploadVersionNo} · 검색 대상 {document.searchableVersionNo ? `v${document.searchableVersionNo}` : '없음'}</p></div>
        <div className="detail-actions">
          <button className="button primary" type="button" onClick={() => setModal('upload-version')} disabled={!canWrite}>＋ 새 버전 업로드</button>
          <button className="button secondary" type="button" onClick={() => { setNewTitle(document.title); setModal('rename') }} disabled={!canWrite}>이름 변경</button>
          <button className="danger-text-button" type="button" onClick={() => setModal('delete')} disabled={!canWrite}>삭제</button>
        </div>
      </div>

      <nav className="detail-tabs" aria-label="문서 상세 메뉴">
        {(['overview', 'versions', 'permissions'] as DetailTab[]).map((item) => <button key={item} type="button" className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>{tabLabels[item]}{item === 'versions' && <span>{document.versions.length}</span>}{item === 'permissions' && document.permissionsAvailable && <span>{document.permissions.length}</span>}</button>)}
      </nav>

      {tab === 'overview' && (
        <div className="detail-tab-content overview-tab">
          <section className="detail-section">
            <div className="detail-section-heading"><div><h2>버전 상태</h2><p>업로드, 임베딩, 검색 대상은 서로 다른 버전을 가리킬 수 있습니다.</p></div></div>
            <div className="version-state-grid">
              <div><span>최신 업로드</span><strong>v{document.latestUploadVersionNo}</strong><small>{document.latestVersionIndexingStatus === 'COMPLETED' ? '처리 완료' : '처리 중'}</small></div>
              <div><span>최신 임베딩</span><strong>{document.latestEmbeddingVersionNo ? `v${document.latestEmbeddingVersionNo}` : '—'}</strong><small>{document.latestEmbeddingVersionNo ? '처리 완료' : '없음'}</small></div>
              <div><span>검색 대상</span><strong>{document.searchableVersionNo ? `v${document.searchableVersionNo}` : '—'}</strong><small>{document.searchableVersionNo ? '사용 중' : '검색 불가'}</small></div>
            </div>
            {document.latestUploadVersionNo !== document.searchableVersionNo && document.searchableVersionNo && <div className="information-callout"><span aria-hidden="true">i</span><p>버전 {document.latestUploadVersionNo}을 인덱싱하고 있습니다. 현재 검색에는 버전 {document.searchableVersionNo}을 사용합니다.</p></div>}
          </section>

          <section className="detail-section indexing-overview">
            <div className="detail-section-heading"><div><h2>인덱싱 상태</h2><p>최신 업로드 버전의 상태를 완료 또는 실패까지 주기적으로 조회합니다.</p></div><span className="live-label"><i aria-hidden="true" /> 폴링 중</span></div>
            <dl className="job-facts">
              <div><dt>작업 상태</dt><dd><StatusBadge status={document.indexing.status} /></dd></div>
              <div><dt>시도 횟수</dt><dd>{document.indexing.attemptCount ?? '—'}</dd></div>
              <div><dt>청크 수</dt><dd>{document.indexing.chunkCount ?? '—'}</dd></div>
              <div><dt>시작 시각</dt><dd>{document.indexing.startedAt ? formatDateTime(document.indexing.startedAt) : '—'}</dd></div>
              <div><dt>완료 시각</dt><dd>{document.indexing.completedAt ? formatDateTime(document.indexing.completedAt) : '—'}</dd></div>
            </dl>
            {document.indexing.lastErrorMessage && (
              <div className={document.indexing.status === 'FAILED' ? 'failure-callout wide-callout' : 'failure-callout retry-callout wide-callout'}>
                <span className="callout-symbol" aria-hidden="true">!</span><div><strong>{document.indexing.status === 'FAILED' ? '인덱싱 실패' : '인덱싱 오류'}</strong><p>{document.indexing.lastErrorMessage}</p></div>
                {document.indexing.status === 'FAILED' && <button className="button secondary" type="button" onClick={() => void onRetryVersion(document.latestUploadVersionNo).catch(() => undefined)} disabled={!canWrite}>재인덱싱</button>}
              </div>
            )}
          </section>

          <section className="detail-section document-info-section">
            <div className="detail-section-heading"><div><h2>문서 정보</h2><p>외부 API 식별자와 UTC 시각을 기준으로 표시합니다.</p></div></div>
            <dl><div><dt>문서 ID</dt><dd>{document.id}</dd></div><div><dt>생성 시각</dt><dd>{formatDateTime(document.createdAt)}</dd></div><div><dt>최신 업로드</dt><dd>버전 {document.latestUploadVersionNo}</dd></div><div><dt>최신 임베딩</dt><dd>{document.latestEmbeddingVersionNo ? `버전 ${document.latestEmbeddingVersionNo}` : '—'}</dd></div><div><dt>검색 대상</dt><dd>{document.searchableVersionNo ? `버전 ${document.searchableVersionNo}` : '없음'}</dd></div><div><dt>내 권한</dt><dd>{document.permissionsAvailable ? permissionLabel(currentPermission) : '조회 불가'}</dd></div></dl>
          </section>
        </div>
      )}

      {tab === 'versions' && (
        <section className="detail-section versions-section">
          <div className="detail-section-heading"><div><h2>버전</h2><p>업로드된 원본과 버전별 인덱싱 상태를 관리합니다.</p></div><button className="button secondary" type="button" onClick={() => setModal('upload-version')} disabled={!canWrite}>＋ 새 버전 업로드</button></div>
          <div className="table-container"><table className="document-table version-table">
            <thead><tr><th>버전</th><th>파일</th><th>인덱싱</th><th>청크</th><th>검색 대상</th><th>업로드 시각</th><th>작업</th></tr></thead>
            <tbody>{document.versions.slice(0, visibleVersionCount).map((version) => (
              <tr key={version.versionNo} className={initialVersionNo === version.versionNo ? 'highlighted-row' : undefined}>
                <td><strong>v{version.versionNo}</strong>{version.duplicateOfVersionNo && <small className="duplicate-label">v{version.duplicateOfVersionNo}과 동일</small>}</td>
                <td><button className="version-file-button" type="button" onClick={() => void openVersionDetail(version.versionNo)} disabled={loadingVersionNo === version.versionNo}><strong>{version.originalFilename}</strong><small>{formatBytes(version.fileSize)} · {version.mimeType}</small></button></td>
                <td><StatusBadge status={version.indexing.status} />{version.indexing.attemptCount !== undefined && <small className="attempt-label">시도 {version.indexing.attemptCount}회</small>}</td>
                <td>{version.indexing.chunkCount ?? '—'}</td><td>{version.searchable ? <span className="searchable-state"><i aria-hidden="true" /> 사용 중</span> : '아님'}</td><td className="metadata">{formatDateTime(version.uploadedAt)}</td>
                <td><div className="table-actions"><button type="button" onClick={() => void openVersionDetail(version.versionNo)}>상세</button><button type="button" onClick={() => void onDownloadVersion(version)}>다운로드</button>{version.indexing.status === 'COMPLETED' && !version.searchable && <button type="button" onClick={() => { setTargetVersion(version); setModal('searchable') }} disabled={!canWrite}>검색에 사용</button>}{version.indexing.status === 'FAILED' && <button type="button" onClick={() => void onRetryVersion(version.versionNo).catch(() => undefined)} disabled={!canWrite}>재시도</button>}</div></td>
              </tr>
            ))}</tbody>
          </table></div>
          {visibleVersionCount < document.versions.length && <div className="load-more-row"><button className="button secondary" type="button" onClick={() => setVisibleVersionCount((count) => count + 10)}>버전 더 보기</button></div>}
        </section>
      )}

      {tab === 'permissions' && (
        <section className="detail-section permissions-section">
          <div className="detail-section-heading"><div><h2>권한</h2><p>사용자 또는 테넌트의 READ·WRITE 권한을 관리합니다.</p></div><button className="button secondary" type="button" onClick={() => setModal('permission')} disabled={!canWrite}>＋ 권한 부여</button></div>
          {!document.permissionsAvailable ? <div className="inline-error access-error"><span aria-hidden="true">!</span><div><strong>권한 목록을 조회할 수 없습니다</strong><p>현재 사용자에게 권한 관리 권한이 없습니다.</p></div></div> : (
            <><div className={canWrite ? 'access-summary' : 'access-summary read-only'}><strong>내 권한: {permissionLabel(currentPermission)}</strong><span>{canWrite ? '문서 접근 권한을 관리할 수 있습니다.' : 'WRITE 권한이 있는 사용자만 권한을 변경할 수 있습니다.'}</span></div>
            <div className="table-container"><table className="document-table permission-table"><thead><tr><th>대상</th><th>유형</th><th>권한</th><th>작업</th></tr></thead><tbody>{document.permissions.map((permission) => (
              <tr key={`${permission.principalType}-${permission.principalId}`}><td><strong>{principalName(permission)}</strong></td><td className="metadata">{permission.principalType === 'USER' ? '사용자' : '테넌트'}</td><td><span className={`permission-badge permission-${permission.permission.toLowerCase()}`}>{permissionLabel(permission.permission)}</span></td><td><div className="table-actions"><button type="button" disabled={!canWrite} onClick={() => void onUpsertPermission({ ...permission, permission: permission.permission === 'READ' ? 'WRITE' : 'READ' }).catch(() => undefined)}>{permission.permission === 'READ' ? '쓰기로 변경' : '읽기로 변경'}</button><button className="danger" type="button" disabled={!canWrite || (permission.principalType === 'USER' && permission.principalId === user.id)} onClick={() => void onRemovePermission(permission).catch(() => undefined)}>회수</button></div></td></tr>
            ))}</tbody></table></div></>
          )}
        </section>
      )}

      {versionDetail && <VersionDrawer version={versionDetail} onClose={() => setVersionDetail(null)} onDownload={() => onDownloadVersion(versionDetail)} />}

      {modal === 'rename' && <Modal title="문서 이름 변경" description="이름을 변경해도 재인덱싱은 실행되지 않습니다." onClose={() => setModal(null)}><form onSubmit={async (event) => { event.preventDefault(); if (!newTitle.trim()) return; setIsSaving(true); try { await onRename(newTitle.trim()); setModal(null) } catch { /* 상위 Toast 사용 */ } finally { setIsSaving(false) } }}><div className="modal-body"><label className="field-stack"><span>문서 제목</span><input value={newTitle} onChange={(event) => setNewTitle(event.target.value)} autoFocus /></label></div><div className="modal-actions"><button className="button secondary" type="button" onClick={() => setModal(null)}>취소</button><button className="button primary" type="submit" disabled={!newTitle.trim() || isSaving}>{isSaving ? '저장 중…' : '저장'}</button></div></form></Modal>}

      {modal === 'delete' && <Modal title="문서를 삭제할까요?" description={`${document.title} 문서를 더 이상 조회하거나 검색할 수 없습니다.`} onClose={() => setModal(null)}><div className="modal-body"><div className="destructive-note">삭제 시각이 기록된 뒤 Worker가 원본 파일과 청크를 정리합니다. 이 작업은 되돌릴 수 없습니다.</div></div><div className="modal-actions"><button className="button secondary" type="button" onClick={() => setModal(null)}>취소</button><button className="button danger-button" type="button" disabled={isSaving} onClick={async () => { setIsSaving(true); try { await onDelete() } catch { /* 상위 Toast 사용 */ } finally { setIsSaving(false) } }}>{isSaving ? '삭제 중…' : '문서 삭제'}</button></div></Modal>}

      {modal === 'upload-version' && <Modal title="새 버전 업로드" description={`${document.title} 문서에 새 버전을 추가합니다.`} onClose={() => setModal(null)}><form onSubmit={async (event) => { event.preventDefault(); if (!newVersionFile) return; setIsSaving(true); try { await onUploadVersion(newVersionFile); setNewVersionFile(null); setModal(null) } catch { /* 상위 Toast 사용 */ } finally { setIsSaving(false) } }}><div className="modal-body"><div className="current-version-note"><span>현재 최신 버전</span><strong>v{document.latestUploadVersionNo}</strong></div><label className="file-picker"><input type="file" accept=".pdf,.docx,.md,.markdown,.hwp,.txt" onChange={(event) => selectNewVersionFile(event.target.files?.[0] ?? null)} /><span>{newVersionFile ? newVersionFile.name : 'PDF, DOCX, Markdown, HWP 또는 TXT 파일 선택'}</span><small>같은 내용의 파일을 올려도 새 버전이 생성됩니다.</small></label>{newVersionError && <p className="form-error" role="alert">{newVersionError}</p>}</div><div className="modal-actions"><button className="button secondary" type="button" onClick={() => setModal(null)}>취소</button><button className="button primary" type="submit" disabled={!newVersionFile || isSaving}>{isSaving ? '업로드 중…' : '버전 업로드'}</button></div></form></Modal>}

      {modal === 'searchable' && targetVersion && <Modal title={`검색에 버전 ${targetVersion.versionNo}을 사용할까요?`} description="임베딩이 완료된 버전만 지정할 수 있습니다." onClose={() => setModal(null)}><div className="modal-body"><div className="information-callout"><span aria-hidden="true">i</span><p>더 최신 버전의 임베딩이 완료되면 검색 대상은 자동으로 최신 버전으로 이동합니다.</p></div></div><div className="modal-actions"><button className="button secondary" type="button" onClick={() => setModal(null)}>취소</button><button className="button primary" type="button" disabled={isSaving} onClick={async () => { setIsSaving(true); try { await onSetSearchableVersion(targetVersion.versionNo); setModal(null) } catch { /* 상위 Toast 사용 */ } finally { setIsSaving(false) } }}>버전 {targetVersion.versionNo} 사용</button></div></Modal>}

      {modal === 'permission' && <Modal title="권한 부여" description="사용자 또는 테넌트의 문서 접근 권한을 추가하거나 변경합니다." onClose={() => setModal(null)}><form onSubmit={savePermission}><div className="modal-body form-grid"><label className="field-stack"><span>대상 유형</span><select value={principalType} onChange={(event) => setPrincipalType(event.target.value as PrincipalType)}><option value="USER">사용자</option><option value="TENANT">테넌트</option></select></label>{principalType === 'USER' ? <label className="field-stack"><span>권한 대상</span><select value={principalId} onChange={(event) => setPrincipalId(event.target.value)}>{tenantUsers.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}</select></label> : <div className="field-stack"><span>권한 대상</span><div className="readonly-field">{user.tenant}</div></div>}<label className="field-stack"><span>권한</span><select value={permissionLevel} onChange={(event) => setPermissionLevel(event.target.value as PermissionLevel)}><option value="READ">읽기</option><option value="WRITE">쓰기</option></select></label></div><div className="modal-actions"><button className="button secondary" type="button" onClick={() => setModal(null)}>취소</button><button className="button primary" type="submit" disabled={isSaving}>{isSaving ? '저장 중…' : '권한 저장'}</button></div></form></Modal>}
    </div>
  )
}
