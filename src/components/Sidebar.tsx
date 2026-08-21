import type { View } from '../types'

type SidebarProps = {
  activeView: View
  onNavigate: (view: View) => void
}

export function Sidebar({ activeView, onNavigate }: SidebarProps) {
  return (
    <aside className="sidebar" aria-label="주요 메뉴">
      <nav>
        <button
          type="button"
          className={activeView === 'documents' ? 'nav-item active' : 'nav-item'}
          aria-current={activeView === 'documents' ? 'page' : undefined}
          onClick={() => onNavigate('documents')}
        >
          <span className="nav-document-icon" aria-hidden="true" />
          문서
        </button>
        <button
          type="button"
          className={activeView === 'search' ? 'nav-item active' : 'nav-item'}
          aria-current={activeView === 'search' ? 'page' : undefined}
          onClick={() => onNavigate('search')}
        >
          <span className="nav-search-icon" aria-hidden="true" />
          검색
        </button>
      </nav>
      <div className="connection-status">
        <span aria-hidden="true" />
        <div>
          <strong>API 연결</strong>
          <small>상태 폴링 사용</small>
        </div>
      </div>
    </aside>
  )
}
