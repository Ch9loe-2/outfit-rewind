import { Route, Routes } from 'react-router-dom'
import TabBar from './components/TabBar'
import Today from './pages/Today'
import Rewind from './pages/Rewind'
import SettingsPage from './pages/Settings'
import ImportPage from './pages/Import'
import Day from './pages/Day'

export default function App() {
  return (
    <div className="app">
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Today />} />
          <Route path="/rewind" element={<Rewind />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/day/:date" element={<Day />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Today />} />
        </Routes>
      </main>
      <TabBar />
    </div>
  )
}
