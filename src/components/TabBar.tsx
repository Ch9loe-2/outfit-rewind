import { NavLink } from 'react-router-dom'

const items = [
  { to: '/', label: '今天', icon: '☀️' },
  { to: '/rewind', label: '回忆', icon: '🎞️' },
  { to: '/settings', label: '设置', icon: '⚙️' },
]

export default function TabBar() {
  return (
    <nav className="tabbar">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) => (isActive ? 'tab tab-active' : 'tab')}
        >
          <span className="tab-icon">{item.icon}</span>
          <span className="tab-label">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
