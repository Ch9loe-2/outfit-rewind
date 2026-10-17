import { Suspense, lazy } from 'react'
import { Route, Routes } from 'react-router-dom'
import TabBar from './components/TabBar'
import ErrorBoundary from './components/ErrorBoundary'
import Today from './pages/Today'
import Rewind from './pages/Rewind'

const SettingsPage = lazy(() => import('./pages/Settings'))
const ImportPage = lazy(() => import('./pages/Import'))
const Day = lazy(() => import('./pages/Day'))

function PageFallback() {
  return (
    <div className="page">
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-card" />
    </div>
  )
}

export default function App() {
  return (
    <div className="app">
      <main className="app-main">
        <ErrorBoundary>
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/" element={<Today />} />
              <Route path="/rewind" element={<Rewind />} />
              <Route path="/import" element={<ImportPage />} />
              <Route path="/day/:date" element={<Day />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Today />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </main>
      <TabBar />
    </div>
  )
}
