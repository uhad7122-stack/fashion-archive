import { NavLink, Navigate, Outlet, useLocation } from 'react-router'
import { Spinner } from '../components/ui/States'
import { useAuth } from '../features/auth/AuthProvider'

const TABS = [
  { to: '/admin/contents', label: '콘텐츠' },
  { to: '/admin/items', label: '제품' },
  { to: '/admin/people', label: '인물' },
  { to: '/admin/brands', label: '브랜드' },
  { to: '/admin/categories', label: '카테고리' },
  { to: '/admin/content-types', label: '콘텐츠 종류' },
  { to: '/admin/tags', label: '태그' },
  { to: '/admin/info-statuses', label: '정보 상태' },
  { to: '/admin/languages', label: '언어' },
]

/** 관리자만 들어올 수 있다. 공개 방문자는 로그인 화면으로 */
export function AdminLayout() {
  const { isAdmin, loading } = useAuth()
  const location = useLocation()
  if (loading) return <Spinner />
  if (!isAdmin) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />

  return (
    <div>
      <nav aria-label="관리 메뉴" className="-mx-1 mb-8 flex gap-1 overflow-x-auto border-b border-line pb-3">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            className={({ isActive }) =>
              `shrink-0 rounded-full px-3 py-1.5 text-sm ${isActive ? 'bg-ink text-white' : 'text-muted hover:bg-soft hover:text-ink'}`
            }
          >
            {t.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  )
}
