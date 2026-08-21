import { useEffect, useRef, useState } from 'react'
import type { User } from '../types'

type HeaderProps = {
  users: User[]
  currentUser: User
  onUserChange: (userId: string) => void
}

export function Header({ users, currentUser, onUserChange }: HeaderProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const tenants = Array.from(new Set(users.map((user) => user.tenant)))

  useEffect(() => {
    const closeMenu = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setIsOpen(false)
    }
    document.addEventListener('mousedown', closeMenu)
    return () => document.removeEventListener('mousedown', closeMenu)
  }, [])

  return (
    <header className="app-header">
      <a className="brand" href="#main-content">
        <span className="brand-symbol" aria-hidden="true">O</span>
        <strong>OpenSQL Document AI</strong>
      </a>

      <div className="user-menu" ref={menuRef}>
        <button
          type="button"
          className="user-trigger"
          aria-expanded={isOpen}
          aria-haspopup="menu"
          onClick={() => setIsOpen((open) => !open)}
        >
          <span className="user-context">
            <small>데모 사용자</small>
            <strong>{currentUser.tenant} · {currentUser.name}</strong>
          </span>
          <span className="chevron" aria-hidden="true">⌄</span>
        </button>

        {isOpen && (
          <div className="user-popover" role="menu" aria-label="데모 사용자 선택">
            <div className="popover-title">
              <strong>데모 사용자</strong>
              <span>권한 확인용 사용자</span>
            </div>
            {tenants.map((tenant) => (
              <div className="tenant-group" key={tenant}>
                <p>{tenant}</p>
                {users.filter((user) => user.tenant === tenant).map((user) => (
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={currentUser.id === user.id}
                    key={user.id}
                    onClick={() => {
                      onUserChange(user.id)
                      setIsOpen(false)
                    }}
                  >
                    <span className="radio-mark" aria-hidden="true">
                      {currentUser.id === user.id ? '●' : ''}
                    </span>
                    {user.name}
                    {currentUser.id === user.id && <small>현재 선택</small>}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </header>
  )
}
