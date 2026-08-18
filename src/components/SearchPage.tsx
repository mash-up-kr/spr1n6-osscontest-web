import { useEffect, useRef, useState, type FormEvent } from 'react'
import { mockSearchResults } from '../data/mockData'
import type { SearchResult, User } from '../types'

type SearchState = 'initial' | 'loading' | 'results' | 'empty' | 'denied' | 'error'
type DemoResponse = 'normal' | 'empty' | 'denied' | 'error'

type SearchPageProps = {
  user: User
  onOpenDocument: (documentId: string, versionNo?: number) => void
}

export function SearchPage({ user, onOpenDocument }: SearchPageProps) {
  const [query, setQuery] = useState('OpenSQL의 장애 복구 방법은?')
  const [state, setState] = useState<SearchState>('initial')
  const [response, setResponse] = useState<DemoResponse>('normal')
  const [results, setResults] = useState<SearchResult[]>([])
  const [elapsed, setElapsed] = useState(124)
  const [userChanged, setUserChanged] = useState(false)
  const previousUser = useRef({ id: user.id, tenant: user.tenant })
  const requestId = useRef(0)

  useEffect(() => {
    const contextChanged = previousUser.current.id !== user.id || previousUser.current.tenant !== user.tenant

    if (contextChanged) {
      requestId.current += 1
      setResults([])
      setState('initial')
      setUserChanged(true)
      previousUser.current = { id: user.id, tenant: user.tenant }
    }
  }, [user.id, user.tenant])

  const search = (event: FormEvent) => {
    event.preventDefault()
    if (!query.trim() || state === 'loading') return
    setUserChanged(false)
    setState('loading')
    const startedAt = performance.now()
    const currentRequestId = ++requestId.current

    window.setTimeout(() => {
      if (requestId.current !== currentRequestId) return
      setElapsed(Math.max(86, Math.round(performance.now() - startedAt)))
      if (response === 'error') {
        setState('error')
        return
      }
      if (response === 'denied') {
        setResults([])
        setState('denied')
        return
      }
      if (response === 'empty' || (user.tenant === '테넌트 B' && query.toLowerCase().includes('opensql'))) {
        setResults([])
        setState('empty')
        return
      }
      const permittedResults = mockSearchResults.filter((result) => (
        result.tenant === user.tenant && result.allowedUserIds.includes(user.id)
      ))
      setResults(permittedResults)
      setState(permittedResults.length ? 'results' : 'empty')
    }, 650)
  }

  return (
    <div className="page search-page">
      <div className="page-header search-page-header">
        <div>
          <h1>검색</h1>
          <p>자연어로 인덱싱된 문서의 내용을 검색합니다.</p>
        </div>
        <div className="permission-context">
          <span>현재 검색 사용자</span>
          <strong>{user.tenant} / {user.name}</strong>
        </div>
      </div>

      <section className="search-workspace" aria-labelledby="search-input-label">
        <form className="search-form" onSubmit={search}>
          <label id="search-input-label" htmlFor="semantic-search">자연어 검색어</label>
          <div className="search-input-row">
            <span className="input-search-icon" aria-hidden="true" />
            <input
              id="semantic-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="인덱싱된 문서에 대해 질문해 보세요"
            />
            <button className="button primary" type="submit" disabled={!query.trim() || state === 'loading'}>
              {state === 'loading' ? <><span className="spinner" aria-hidden="true" /> 검색 중</> : '검색'}
            </button>
          </div>
        </form>

        <div className="search-options">
          <span>권한 필터: <strong>{user.tenant}</strong></span>
          <label htmlFor="demo-response">
            데모 응답
            <select id="demo-response" value={response} onChange={(event) => setResponse(event.target.value as DemoResponse)}>
              <option value="normal">정상 결과</option>
              <option value="empty">결과 없음</option>
              <option value="denied">권한 없음 (403)</option>
              <option value="error">검색 실패</option>
            </select>
          </label>
        </div>
      </section>

      <section className="results-section" aria-labelledby="results-heading" aria-live="polite" aria-busy={state === 'loading'}>
        {state === 'initial' && (
          <div className="search-initial">
            <span className="large-search-icon" aria-hidden="true" />
            <h2 id="results-heading">{userChanged ? '검색 사용자가 변경되었습니다' : '인덱싱된 문서 검색'}</h2>
            <p>{userChanged
              ? `이전 검색 결과를 제거했습니다. ${user.tenant} / ${user.name} 권한으로 다시 검색해 주세요.`
              : '선택한 데모 사용자와 테넌트 권한을 기준으로 결과를 제공합니다.'}</p>
          </div>
        )}

        {state === 'loading' && (
          <div className="search-message">
            <span className="spinner dark" aria-hidden="true" />
            <div><h2 id="results-heading">문서를 검색하고 있습니다…</h2><p>벡터 검색을 실행하고 접근 권한을 확인합니다.</p></div>
          </div>
        )}

        {state === 'results' && (
          <>
            <div className="results-header">
              <div><h2 id="results-heading">검색 결과 {results.length}건</h2><p>벡터 유사도 순으로 정렬</p></div>
              <span>{elapsed} ms</span>
            </div>
            <div className="result-list">
              {results.map((result) => (
                <article className="result-row" key={result.id}>
                  <div className="result-topline">
                    <h3>{result.documentName}</h3>
                    <span>{result.similarity}% 일치</span>
                  </div>
                  <div className="result-location">
                    <span>{result.page}페이지 · 청크 {result.chunk} · 버전 {result.versionNo}</span>
                    {result.section && <strong>{result.section}</strong>}
                  </div>
                  <p className="result-content">{result.content}</p>
                  <button className="result-source-button" type="button" onClick={() => onOpenDocument(result.documentId, result.versionNo)}>원문 위치 보기</button>
                </article>
              ))}
            </div>
          </>
        )}

        {state === 'empty' && (
          <div className="search-initial">
            <span className="empty-number" aria-hidden="true">0</span>
            <h2 id="results-heading">검색 결과가 없습니다</h2>
            <p>다른 검색어를 입력하거나 문서 접근 권한이 있는 사용자로 변경해 주세요.</p>
          </div>
        )}

        {state === 'denied' && (
          <div className="inline-error access-error" role="alert">
            <span aria-hidden="true">!</span>
            <div>
              <h2 id="results-heading">접근 권한이 없습니다</h2>
              <p>현재 사용자는 이전 검색 결과에 접근할 수 없습니다. 기존 결과를 화면에서 제거했습니다.</p>
              <button className="link-button" type="button" onClick={() => setState('initial')}>새로 검색하기</button>
            </div>
          </div>
        )}

        {state === 'error' && (
          <div className="inline-error" role="alert">
            <span aria-hidden="true">!</span>
            <div>
              <h2 id="results-heading">검색에 실패했습니다</h2>
              <p>문서를 검색할 수 없습니다. 잠시 후 다시 시도해 주세요.</p>
              <small className="trace-id">추적 ID: 0af7651916cd43dd</small>
              <button className="link-button" type="button" onClick={() => setState('initial')}>다시 시도</button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
