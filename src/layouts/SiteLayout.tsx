import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router'
import { useAuth } from '../features/auth/AuthProvider'
import { isSupabaseConfigured } from '../lib/supabase'

const NAV = [
  { to: '/contents', label: '아카이브' },
  { to: '/items', label: '제품' },
  { to: '/people', label: '인물' },
  { to: '/brands', label: '브랜드' },
]

export function SiteLayout() {
  const { isAdmin, signOut } = useAuth()
  const location = useLocation()
  const inAdmin = location.pathname.startsWith('/admin')

  // 페이지를 옮기면 맨 위로
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">
        본문으로 건너뛰기
      </a>
      <header className="sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
          <Link to="/" className="text-[15px] font-bold tracking-[0.2em]">
            ARCHIVE
          </Link>
          <nav aria-label="주 메뉴" className="order-3 -mx-1 flex w-full gap-1 overflow-x-auto sm:order-none sm:w-auto">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  `shrink-0 rounded-full px-3 py-1.5 text-sm ${isActive ? 'bg-ink text-white' : 'text-muted hover:text-ink'}`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <HeaderSearch />
            {isAdmin && (
              <>
                <Link to="/admin/contents/new" className="btn btn-primary btn-sm hidden sm:inline-flex">
                  + 새 아카이브
                </Link>
                <Link to="/admin" className={`btn btn-sm ${inAdmin ? 'border-ink' : ''}`}>
                  관리
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {!isSupabaseConfigured && (
        <div className="bg-danger px-4 py-2 text-center text-sm text-white">
          Supabase 환경변수가 없어요. README 의 “환경변수 설정”을 확인하세요.
        </div>
      )}

      <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <Outlet />
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-6 text-xs text-faint sm:px-6">
          <span>Personal Fashion Archive</span>
          {isAdmin ? (
            <button className="hover:text-ink" onClick={() => void signOut()}>
              로그아웃
            </button>
          ) : (
            <Link to="/login" className="hover:text-ink">
              관리자 로그인
            </Link>
          )}
        </div>
      </footer>
    </div>
  )
}

function HeaderSearch() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const location = useLocation()
  const [q, setQ] = useState('')
  useEffect(() => {
    if (location.pathname === '/search') setQ(params.get('q') ?? '')
  }, [location.pathname, params])
  if (location.pathname === '/') return null
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault()
        if (q.trim()) navigate(`/search?q=${encodeURIComponent(q.trim())}`)
      }}
    >
      <input
        type="search"
        className="input w-36 rounded-full py-1.5 sm:w-56"
        placeholder="검색"
        aria-label="사이트 전체 검색"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
    </form>
  )
}
