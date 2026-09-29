import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// GitHub Pages 는 /<저장소 이름>/ 아래에서 서빙된다. 라우팅은 HashRouter 라 base 만 맞추면 된다.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/fashion-archive/' : '/',
  plugins: [react(), tailwindcss()],
  // supabase-js + react 가 대부분이라 600kB 안팎. 관리 화면은 이미 따로 나뉘어 있다
  build: { chunkSizeWarningLimit: 800 },
}))
