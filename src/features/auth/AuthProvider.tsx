import type { Session } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '../../lib/supabase'

interface AuthState {
  session: Session | null
  /** fa_admins 에 등록된 계정인지. 공유 Supabase 라 로그인만으로는 관리자가 아니다 */
  isAdmin: boolean
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

async function checkAdmin(userId: string | undefined): Promise<boolean> {
  if (!userId) return false
  const { data, error } = await supabase.from('fa_admins').select('user_id').eq('user_id', userId).maybeSingle()
  if (error) {
    console.warn('[auth] 관리자 확인 실패', error)
    return false
  }
  return Boolean(data)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    supabase.auth.getSession().then(async ({ data }) => {
      const admin = await checkAdmin(data.session?.user.id)
      if (!alive) return
      setSession(data.session)
      setIsAdmin(admin)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      // 콜백 안에서 supabase 를 바로 await 하면 교착될 수 있어 다음 틱으로 미룬다
      setTimeout(async () => {
        const admin = await checkAdmin(next?.user.id)
        if (alive) setIsAdmin(admin)
      }, 0)
    })
    return () => {
      alive = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthState>(
    () => ({
      session,
      isAdmin,
      loading,
      signIn: async (email, password) => {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw new Error('이메일 또는 비밀번호가 맞지 않아요.')
        const admin = await checkAdmin(data.user?.id)
        if (!admin) {
          await supabase.auth.signOut()
          throw new Error('이 계정은 아카이브 관리자로 등록되어 있지 않아요.')
        }
        setIsAdmin(true)
      },
      signOut: async () => {
        await supabase.auth.signOut()
        setIsAdmin(false)
      },
    }),
    [session, isAdmin, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('AuthProvider 가 필요합니다')
  return ctx
}
