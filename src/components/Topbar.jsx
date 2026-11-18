import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../hooks/useSocket'

const tabs = [
  { to: '/highlights', label: 'Highlights' },
  { to: '/standings', label: 'Standings' },
  { to: '/bracket', label: 'Bracket' },
  { to: '/stats', label: 'Stats' },
  { to: '/teams', label: 'Teams' },
  { to: '/players', label: 'Players' },
]

export default function Topbar({ title }) {
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const socket = useSocket()
  const [liveNotifications, setLiveNotifications] = useState(0)
  const [announcementNotifications, setAnnouncementNotifications] = useState(0)
  const today = new Date().toLocaleDateString('en-US', { weekday: undefined, month: 'long', day: 'numeric', year: 'numeric' })

  useEffect(() => {
    if (location.pathname === '/highlights') {
      setLiveNotifications(0)
    }
    if (location.pathname === '/announcements') {
      setAnnouncementNotifications(0)
    }
  }, [location.pathname])

  useEffect(() => {
    const handleLiveUpdate = () => {
      console.log('[Topbar] gameLive received')
      if (location.pathname !== '/highlights') {
        setLiveNotifications((count) => count + 1)
      }
    }

    const handleAnnouncementCreated = () => {
      console.log('[Topbar] announcementCreated received')
      if (location.pathname !== '/announcements') {
        setAnnouncementNotifications((count) => count + 1)
      }
    }

    socket.on('gameLive', handleLiveUpdate)
    socket.on('announcementCreated', handleAnnouncementCreated)
    return () => {
      socket.off('gameLive', handleLiveUpdate)
      socket.off('announcementCreated', handleAnnouncementCreated)
    }
  }, [socket, location.pathname])

  return (
    <header style={{
      background: 'var(--bg-card)', borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', gap: 0, height: 48, flexShrink: 0
    }}>
      <div style={{ padding: '0 20px', fontWeight: 700, fontSize: 16, whiteSpace: 'nowrap' }}>
        {title?.split(' ').map((w, i) => (
          <span key={i} style={{ color: i === 1 ? 'var(--orange)' : 'var(--text)' }}>{w}{' '}</span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 0, flex: 1, height: '100%' }}>
        {tabs.map(tab => (
          <NavLink key={tab.to} to={tab.to} style={({ isActive }) => ({
            display: 'flex', alignItems: 'center', gap: 6, padding: '0 14px',
            fontSize: 12, textDecoration: 'none', height: '100%',
            color: isActive ? 'var(--orange)' : 'var(--text-muted)',
            borderBottom: isActive ? '2px solid var(--orange)' : '2px solid transparent',
            transition: 'all 0.12s'
          })}>
            {tab.label}
            {tab.to === '/announcements' && announcementNotifications > 0 && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                minWidth: 18, height: 18, borderRadius: 999, background: '#0f766e',
                color: '#fff', fontSize: 10, fontWeight: 700, padding: '0 5px'
              }}>
                {announcementNotifications}
              </span>
            )}
          </NavLink>
        ))}
        {user && (
          <NavLink to="/announcements" style={({ isActive }) => ({
            display: 'flex', alignItems: 'center', gap: 6, padding: '0 14px',
            fontSize: 12, textDecoration: 'none', height: '100%',
            color: isActive ? 'var(--orange)' : 'var(--text-muted)',
            borderBottom: isActive ? '2px solid var(--orange)' : '2px solid transparent',
          })}>
            Announcements
            {announcementNotifications > 0 && (
              <span style={{
                minWidth: 18, height: 18, borderRadius: 999, background: '#0f766e',
                color: '#fff', fontSize: 10, fontWeight: 700, display: 'inline-flex',
                alignItems: 'center', justifyContent: 'center', padding: '0 5px'
              }}>
                {announcementNotifications}
              </span>
            )}
          </NavLink>
        )}
        {user?.role === 'coach' && (
          <NavLink to="/coach" style={({ isActive }) => ({
            display: 'flex', alignItems: 'center', padding: '0 14px',
            fontSize: 12, textDecoration: 'none', height: '100%',
            color: isActive ? 'var(--orange)' : 'var(--text-muted)',
            borderBottom: isActive ? '2px solid var(--orange)' : '2px solid transparent',
          })}>
            My Roster
          </NavLink>
        )}
        {user?.role === 'player' && (
          <NavLink to="/profile" style={({ isActive }) => ({
            display: 'flex', alignItems: 'center', padding: '0 14px',
            fontSize: 12, textDecoration: 'none', height: '100%',
            color: isActive ? 'var(--orange)' : 'var(--text-muted)',
            borderBottom: isActive ? '2px solid var(--orange)' : '2px solid transparent',
          })}>
            My Profile
          </NavLink>
        )}
        {(user?.role === 'admin' || user?.role === 'league_manager') && (
          <>
            <NavLink to="/reports" style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', padding: '0 14px',
              fontSize: 12, textDecoration: 'none', height: '100%',
              color: isActive ? 'var(--orange)' : 'var(--text-muted)',
              borderBottom: isActive ? '2px solid var(--orange)' : '2px solid transparent',
            })}>
              Reports
            </NavLink>
            <NavLink to={user?.role === 'league_manager' ? '/league' : '/admin'} style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', padding: '0 14px',
              fontSize: 12, textDecoration: 'none', height: '100%',
              color: isActive ? 'var(--orange)' : 'var(--text-muted)',
              borderBottom: isActive ? '2px solid var(--orange)' : '2px solid transparent',
            })}>
              {user?.role === 'league_manager' ? 'Manage League' : 'Admin'}
            </NavLink>
          </>
        )}
      </div>
      <div style={{ padding: '0 20px', display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
        <span>Today · {today}</span>
        {!user ? (
          <button
            type="button"
            onClick={() => navigate('/login')}
            style={{ border: '1px solid var(--orange)', background: 'var(--orange)', color: '#fff', borderRadius: 6, padding: '7px 12px', fontWeight: 700, cursor: 'pointer' }}
          >
            Sign In
          </button>
        ) : null}
      </div>
    </header>
  )
}