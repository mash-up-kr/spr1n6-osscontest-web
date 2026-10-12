import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
try {
  const { DocumentDetailPage } = await server.ssrLoadModule('/src/components/DocumentDetailPage.tsx')
  const user = { id: '2', tenantId: '1', tenant: 'A', name: '사용자' }
  const noop = async () => {}
  for (const permission of ['ADMIN', 'WRITE', 'READ']) {
    const html = renderToStaticMarkup(createElement(DocumentDetailPage, {
      user, users: [user],
      document: {
        id: 1, title: '권한 시험', createdAt: '2026-10-13T00:00:00Z',
        latestUploadVersionNo: 1, latestEmbeddingVersionNo: 0,
        searchableVersionNo: null, latestVersionIndexingStatus: 'PENDING',
        effectivePermission: permission, ownerPrincipalId: '1',
        permissionsAvailable: permission === 'ADMIN', permissions: [], versions: [],
        indexing: { versionNo: 1, status: 'PENDING' },
      },
      onBack: noop, onRename: noop, onDelete: noop, onUploadVersion: noop,
      onRetryVersion: noop, onSetSearchableVersion: noop, onLoadVersionDetail: noop,
      onDownloadVersion: noop, onUpsertPermission: noop, onRemovePermission: noop,
    }))
    for (const label of ['＋ 새 버전 업로드', '이름 변경', '삭제']) {
      const button = html.match(new RegExp(`<button[^>]*>${label.replace('＋', '\\＋')}</button>`))?.[0]
      assert.ok(button, `${permission}: ${label} 버튼 존재`)
      assert.equal(button.includes('disabled'), permission === 'READ', `${permission}: ${label} 허용 여부`)
    }
    console.log(`${permission}: 편집 버튼 권한 검증 통과`)
  }
} finally {
  await server.close()
}
