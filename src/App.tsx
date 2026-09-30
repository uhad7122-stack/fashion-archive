import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { Spinner } from './components/ui/States'
import { AdminLayout } from './layouts/AdminLayout'
import { SiteLayout } from './layouts/SiteLayout'
import { ContentPage } from './pages/ContentPage'
import { ContentsPage } from './pages/ContentsPage'
import { BrandsPage, PeoplePage } from './pages/DirectoryPages'
import { BrandPage, GroupPage, ItemPage, PersonPage } from './pages/EntityPages'
import { HomePage } from './pages/HomePage'
import { ItemsPage } from './pages/ItemsPage'
import { LoginPage } from './pages/LoginPage'
import { SearchPage } from './pages/SearchPage'
// 관리 화면은 로그인한 관리자만 쓰니 따로 불러온다 (공개 방문자 번들을 가볍게)
const admin = () => import('./pages/admin')
const AdminContentsPage = lazy(() => admin().then((m) => ({ default: m.AdminContentsPage })))
const AdminItemsPage = lazy(() => admin().then((m) => ({ default: m.AdminItemsPage })))
const AdminPeoplePage = lazy(() => admin().then((m) => ({ default: m.AdminPeoplePage })))
const AdminGroupsPage = lazy(() => admin().then((m) => ({ default: m.AdminGroupsPage })))
const AdminBrandsPage = lazy(() => admin().then((m) => ({ default: m.AdminBrandsPage })))
const CategoriesAdminPage = lazy(() => admin().then((m) => ({ default: m.CategoriesAdminPage })))
const ContentEditorPage = lazy(() => admin().then((m) => ({ default: m.ContentEditorPage })))
const LookupAdminPage = lazy(() => admin().then((m) => ({ default: m.LookupAdminPage })))

export default function App() {
  return (
    <Routes>
      <Route element={<SiteLayout />}>
        <Route index element={<HomePage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="contents" element={<ContentsPage />} />
        <Route path="items" element={<ItemsPage />} />
        <Route path="people" element={<PeoplePage />} />
        <Route path="brands" element={<BrandsPage />} />
        <Route path="c/:id" element={<ContentPage />} />
        <Route path="i/:id" element={<ItemPage />} />
        <Route path="p/:id" element={<PersonPage />} />
        <Route path="b/:id" element={<BrandPage />} />
        <Route path="g/:id" element={<GroupPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route
          path="admin"
          element={
            <Suspense fallback={<Spinner />}>
              <AdminLayout />
            </Suspense>
          }
        >
          <Route index element={<Navigate to="contents" replace />} />
          <Route path="contents" element={<AdminContentsPage />} />
          <Route path="contents/new" element={<ContentEditorPage />} />
          <Route path="contents/:id" element={<ContentEditorPage />} />
          <Route path="items" element={<AdminItemsPage />} />
          <Route path="people" element={<AdminPeoplePage />} />
          <Route path="groups" element={<AdminGroupsPage />} />
          <Route path="brands" element={<AdminBrandsPage />} />
          <Route path="categories" element={<CategoriesAdminPage />} />
          <Route path="content-types" element={<LookupAdminPage key="ct" kind="content_types" />} />
          <Route path="tags" element={<LookupAdminPage key="tags" kind="tags" />} />
          <Route path="info-statuses" element={<LookupAdminPage key="st" kind="info_statuses" />} />
          <Route path="languages" element={<LookupAdminPage key="lang" kind="languages" />} />
        </Route>
        <Route path="*" element={<p className="py-20 text-center text-sm text-muted">페이지를 찾을 수 없어요.</p>} />
      </Route>
    </Routes>
  )
}
