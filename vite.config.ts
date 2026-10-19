import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // 用相对路径：既能挂在 GitHub Pages 的 /outfit-rewind/，也能挂在 Cloudflare Pages 的根目录
  base: './',
  plugins: [react()],
})
