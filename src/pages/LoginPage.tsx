import { useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import { useAuth } from '../features/auth/AuthProvider'
import { toMessage } from '../lib/errors'

export function LoginPage() {
  const { isAdmin, signIn } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next') || '/admin'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (isAdmin) return <Navigate to={next} replace />

  return (
    <div className="mx-auto max-w-sm pt-10">
      <p className="eyebrow">Admin</p>
      <h1 className="mt-1 mb-8 text-2xl font-semibold tracking-tight">관리자 로그인</h1>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          setError(null)
          try {
            await signIn(email.trim(), password)
            navigate(next, { replace: true })
          } catch (err) {
            setError(toMessage(err))
          } finally {
            setBusy(false)
          }
        }}
      >
        <div>
          <label className="label" htmlFor="login-email">
            이메일
          </label>
          <input
            id="login-email"
            className="input"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="login-pw">
            비밀번호
          </label>
          <input
            id="login-pw"
            className="input"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        )}
        <button className="btn btn-primary w-full" disabled={busy}>
          {busy ? '로그인 중…' : '로그인'}
        </button>
      </form>
      <p className="mt-6 text-xs text-faint">계정은 supabase/create_admin.sql 로 만들어요. (README 참고)</p>
    </div>
  )
}
