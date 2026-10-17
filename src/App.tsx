import { Route, Routes } from 'react-router-dom'
import TabBar from './components/TabBar'
import Today from './pages/Today'
import Rewind from './pages/Rewind'
import SettingsPage from './pages/Settings'

export default function App() {
  return (
    <div className="app">
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Today />} />
          <Route path="/rewind" element={<Rewind />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Today />} />
        </Routes>
      </main>
      <TabBar />
    </div>
  )
}
