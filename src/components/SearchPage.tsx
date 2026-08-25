import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ApiError, apiErrorMessage } from '../api/client'
import { searchDocuments } from '../api/search'
import type { SearchResult, User } from '../types'

type SearchState = 'initial' | 'loading' | 'results' | 'empty' | 'denied' | 'error'

type SearchPageProps = {
  user: User
  onOpenDocument: (documentId: number) => void
}

const pageLabel = (result: SearchResult) => {
  if (result.pageFrom === null) return null
  if (result.pageTo === null || result.pageFrom === result.pageTo) return `${result.pageFrom}페이지`
  return `${result.pageFrom}–${result.pageTo}페이지`
}

export function SearchPage({ user, onOpenDocument }: SearchPageProps) {
  const [query, setQuery] = useState('OpenSQL의 장애 복구 방법은?')
  const [state, setState] = useState<SearchState>('initial')
  const [results, setResults] = useState<SearchResult[]>([])
  const [elapsed, setElapsed] = useState(0)
  const [topK, setTopK] = useState(10)
  const [contextWindow, setContextWindow] = useState(1)
  const [rerank, setRerank] = useState(false)
  const [traceId, setTraceId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [userChanged, setUserChanged] = useState(false)
  const previousUserId = useRef(user.id)
  const requestController = useRef<AbortController | null>(null)

  useEffect(() => {
    if (previousUserId.current === user.id) return
    requestController.current?.abort()
    requestController.current = null
    setResults([])
    setState('initial')
    setUserChanged(true)
    setTraceId(null)
    previousUserId.current = user.id
  }, [user.id])

  useEffect(() => () => requestController.current?.abort(), [])

  const search = async (event: FormEvent) => {
    event.preventDefault()
    if (!query.trim() || state === 'loading') return

    requestController.current?.abort()
    const controller = new AbortController()
    requestController.current = controller
    setUserChanged(false)
    setState('loading')
    setTraceId(null)
    setErrorMessage(null)
    const startedAt = performance.now()

    try {
      const response = await searchDocuments(user.id, {
        query: query.trim(), topK, contextWindow, rerank,
      }, controller.signal)
      setElapsed(Math.round(performance.now() - startedAt))
      setResults(response.items)
      setState(response.items.length ? 'results' : 'empty')
    } catch (error) {
      if (controller.signal.aborted) return
      setResults([])
      setElapsed(Math.round(performance.now() - startedAt))
      setErrorMessage(apiErrorMessage(error))
      if (error instanceof ApiError) setTraceId(error.traceId ?? null)
      setState(error instanceof ApiError && error.status === 403 ? 'denied' : 'error')
    } finally {
      if (requestController.current === controller) requestController.current = null
    }
  }

  return (
    <div className="page search-page">
      <div className="page-header search-page-header">
        <div><h1>검색</h1><p>자연어로 인덱싱된 문서의 내용을 검색합니다.</p></div>
        <div className="permission-context"><span>현재 검색 사용자</span><strong>{user.tenant} / {user.name}</strong></div>
      </div>

      <section className="search-workspace" aria-labelledby="search-input-label">
        <form className="search-form" onSubmit={search}>
          <label id="search-input-label" htmlFor="semantic-search">자연어 검색어</label>
          <div className="search-input-row">
            <span className="input-search-icon" aria-hidden="true" />
            <input id="semantic-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="인덱싱된 문서에 대해 질문해 보세요" />
            <button className="button primary" type="submit" disabled={!query.trim() || state === 'loading'}>
              {state === 'loading' ? <><span className="spinner" aria-hidden="true" /> 검색 중</> : '검색'}
            </button>
          </div>
        </form>
        <div className="search-options">
          <span>권한 필터: <strong>{user.tenant}</strong></span>
          <label>결과 수 <select value={topK} onChange={(event) => setTopK(Number(event.target.value))}><option value={5}>5</option><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option></select></label>
          <label>앞뒤 문맥 <select value={contextWindow} onChange={(event) => setContextWindow(Number(event.target.value))}>{[0, 1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}개</option>)}</select></label>
          <label><input type="checkbox" checked={rerank} onChange={(event) => setRerank(event.target.checked)} /> 재정렬(정확도 우선)</label>
        </div>
      </section>

      <section className="results-section" aria-labelledby="results-heading" aria-live="polite" aria-busy={state === 'loading'}>
        {state === 'initial' && (
          <div className="search-initial">
            <span className="large-search-icon" aria-hidden="true" />
            <h2 id="results-heading">{userChanged ? '검색 사용자가 변경되었습니다' : '인덱싱된 문서 검색'}</h2>
            <p>{userChanged ? `이전 검색 결과를 제거했습니다. ${user.tenant} / ${user.name} 권한으로 다시 검색해 주세요.` : '선택한 데모 사용자의 권한을 기준으로 결과를 제공합니다.'}</p>
          </div>
        )}
        {state === 'loading' && <div className="search-message"><span className="spinner dark" aria-hidden="true" /><div><h2 id="results-heading">문서를 검색하고 있습니다…</h2><p>벡터와 키워드 검색 결과를 결합하고 있습니다.</p></div></div>}
        {state === 'results' && (
          <>
            <div className="results-header"><div><h2 id="results-heading">검색 결과 {results.length}건</h2><p>결합 검색 점수 순</p></div><span>{elapsed} ms</span></div>
            <div className="result-list">
              {results.map((result) => (
                <article className="result-row" key={result.chunkId}>
                  <div className="result-topline"><h3>{result.title}</h3><span>점수 {result.score.toFixed(4)}</span></div>
                  <div className="result-location">
                    <span>{[pageLabel(result), `청크 ID ${result.chunkId}`].filter(Boolean).join(' · ')}</span>
                    {result.sectionPath && <strong>{result.sectionPath}</strong>}
                  </div>
                  {result.contextBefore.map((context, index) => <p className="result-context" key={`before-${index}`}>{context}</p>)}
                  <p className="result-content">{result.content}</p>
                  {result.contextAfter.map((context, index) => <p className="result-context" key={`after-${index}`}>{context}</p>)}
                  <button className="result-source-button" type="button" onClick={() => onOpenDocument(result.documentId)}>문서 보기</button>
                </article>
              ))}
            </div>
          </>
        )}
        {state === 'empty' && <div className="search-initial"><span className="empty-number" aria-hidden="true">0</span><h2 id="results-heading">검색 결과가 없습니다</h2><p>다른 검색어를 입력하거나 문서 접근 권한을 확인해 주세요.</p></div>}
        {state === 'denied' && <div className="inline-error access-error" role="alert"><span aria-hidden="true">!</span><div><h2 id="results-heading">접근 권한이 없습니다</h2><p>{errorMessage}</p><button className="link-button" type="button" onClick={() => setState('initial')}>새로 검색하기</button></div></div>}
        {state === 'error' && <div className="inline-error" role="alert"><span aria-hidden="true">!</span><div><h2 id="results-heading">검색에 실패했습니다</h2><p>{errorMessage}</p>{traceId && <small className="trace-id">추적 ID: {traceId}</small>}<button className="link-button" type="button" onClick={() => setState('initial')}>다시 시도</button></div></div>}
      </section>
    </div>
  )
}
