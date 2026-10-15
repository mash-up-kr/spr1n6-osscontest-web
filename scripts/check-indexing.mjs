/*
 * Copyright (c) 2026 매쉬업스프링YB
 * SPDX-License-Identifier: MIT
 */

import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
try {
  const {
    IndexingFacts, IndexingErrorCallout, formatNextRetry, phaseLabel,
  } = await server.ssrLoadModule('/src/components/IndexingFacts.tsx')
  const facts = (indexing) => renderToStaticMarkup(createElement('dl', null, createElement(IndexingFacts, { indexing })))
  const callout = (props) => renderToStaticMarkup(createElement(IndexingErrorCallout, props))
  const now = Date.parse('2026-10-15T00:00:00Z')

  assert.equal(phaseLabel('EMBEDDING'), '임베딩')
  assert.equal(phaseLabel('UNKNOWN_STEP'), 'UNKNOWN_STEP')
  assert.match(formatNextRetry('2026-10-15T00:00:30Z', now), /\(약 30초 후\)$/)
  assert.match(formatNextRetry('2026-10-15T00:02:00Z', now), /\(약 2분 후\)$/)
  assert.match(formatNextRetry('2026-10-14T23:59:50Z', now), /\(곧 재시도\)$/)
  console.log('포맷 함수 검증 통과')

  assert.match(facts({ status: 'PROCESSING', phase: 'EMBEDDING' }), /처리 단계.*임베딩/)
  assert.doesNotMatch(facts({ status: 'COMPLETED', phase: 'EMBEDDING' }), /처리 단계/)
  const future = new Date(Date.now() + 45_000).toISOString()
  assert.match(facts({ status: 'RETRY_WAIT', nextRetryAt: future }), /다음 재시도.*후\)/)
  assert.doesNotMatch(facts({ status: 'PROCESSING', nextRetryAt: future }), /다음 재시도/)
  assert.match(facts({ status: 'PENDING' }), /작업 상태/)
  assert.doesNotMatch(renderToStaticMarkup(createElement('dl', null, createElement(IndexingFacts, { indexing: { status: 'PENDING' }, withStatus: false }))), /작업 상태/)
  console.log('항목 표시 검증 통과')

  const retry = () => {}
  assert.equal(callout({ indexing: { status: 'COMPLETED', lastErrorMessage: '지난 실패' }, canWrite: true, onRetry: retry }), '')
  assert.equal(callout({ indexing: { status: 'FAILED' }, canWrite: true, onRetry: retry }), '')
  const retryWait = callout({ indexing: { status: 'RETRY_WAIT', lastErrorCode: 'RATE_LIMITED', lastErrorMessage: '한도 초과' }, canWrite: true })
  assert.match(retryWait, /직전 시도 오류/)
  assert.match(retryWait, /<code class="error-code">RATE_LIMITED<\/code>/)
  assert.match(retryWait, /한도 초과/)
  assert.doesNotMatch(retryWait, /재인덱싱/)
  const failed = callout({ indexing: { status: 'FAILED', lastErrorMessage: '파일 손상' }, canWrite: true, onRetry: retry })
  assert.match(failed, /인덱싱 실패/)
  assert.match(failed, /<button[^>]*>재인덱싱<\/button>/)
  assert.doesNotMatch(failed, /disabled/)
  const readOnly = callout({ indexing: { status: 'FAILED', lastErrorCode: 'CorruptedFileException' }, canWrite: false, onRetry: retry })
  assert.match(readOnly, /<button[^>]*disabled[^>]*>재인덱싱<\/button>/)
  console.log('오류 콜아웃 검증 통과')
} finally {
  await server.close()
}
