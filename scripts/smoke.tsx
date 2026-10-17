import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import App from '../src/App'
import { SettingsProvider } from '../src/lib/settings'

const routes = ['/', '/rewind', '/settings']
for (const route of routes) {
  const html = renderToString(
    <MemoryRouter initialEntries={[route]}>
      <SettingsProvider>
        <App />
      </SettingsProvider>
    </MemoryRouter>,
  )
  console.log(route, '-> ok, length', html.length)
}
