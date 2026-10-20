import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import { SettingsProvider } from './lib/settings'
import { migrateLegacyVotes } from './lib/votes'
import './styles.css'

// 把旧的「只按日期」的标注迁移到「日期 + 基准日」
void migrateLegacyVotes().catch((error) => {
  console.warn('[outfit-rewind] 标注迁移失败', error)
})

// 生产环境注册 Service Worker：断网也能打开
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((error) => {
      console.warn('[outfit-rewind] Service Worker 注册失败', error)
    })
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <SettingsProvider>
        <App />
      </SettingsProvider>
    </HashRouter>
  </StrictMode>,
)
