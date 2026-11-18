import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../hooks/useSocket'
import ConfirmModal from '../components/ConfirmModal'

const typeStyles = {
  general:   { bg: 'rgba(107,114,128,0.12)', color: '#6b7280' },
  schedule:  { bg: 'rgba(59,130,246,0.12)', color: '#2563eb' },
  live:      { bg: 'rgba(239,68,68,0.12)', color: '#ef4444' },
  important: { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
  upcoming:  { bg: 'rgba(34,197,94,0.12)', color: '#22c55e' }
}

function Badge({ type, isUpcoming = false }) {
  let style = typeStyles[type] || typeStyles.general
  let label = type.replace('_', ' ')
  
  if (isUpcoming) {
    style = typeStyles.upcoming
    label = 'UPCOMING GAME'
  }
  
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '4px 8px', fontSize: 10, fontWeight: 700, borderRadius: 999, background: style.bg, color: style.color, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
      {label}
    </span>
  )
}

function formatDate(timestamp) {
  return new Date(timestamp).toLocaleString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}

export default function Announcements() {
  const { user } = useAuth()
  const canCreateAnnouncements = ['admin', 'league_manager'].includes(user?.role)
  const canManageAnnouncements = ['admin', 'league_manager'].includes(user?.role)
  const [announcements, setAnnouncements] = useState([])
  const [upcomingGames, setUpcomingGames] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [menuOpenId, setMenuOpenId] = useState(null)
  const [gameMenuOpenId, setGameMenuOpenId] = useState(null)
  const [confirmState, setConfirmState] = useState(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState({ title: '', message: '', type: 'general' })
  const [createMessage, setCreateMessage] = useState('')
  const [creating, setCreating] = useState(false)
  const [editingAnnouncementId, setEditingAnnouncementId] = useState(null)
  const [editingGame, setEditingGame] = useState(null)
  const [gameEditForm, setGameEditForm] = useState({ scheduled_time: '', venue: '' })
  const [savingGame, setSavingGame] = useState(false)
  const socket = useSocket()
  const navigate = useNavigate()

  const loadAnnouncements = async () => {
    setLoading(true)
    try {
      const [annRes, gamesRes] = await Promise.all([
        axios.get('/api/announcements'),
        axios.get('/api/games?status=upcoming')
      ])
      setAnnouncements(Array.isArray(annRes.data) ? annRes.data : [])
      setUpcomingGames(Array.isArray(gamesRes.data) ? gamesRes.data : [])
      setError('')
    } catch (err) {
      console.error(err)
      setError('Failed to load announcements.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAnnouncements()
  }, [])

  useEffect(() => {
    if (menuOpenId === null) return

    const handleClickOutside = (event) => {
      const trigger = document.querySelector(`[data-announcement-menu-button="${menuOpenId}"]`)
      const menu = document.querySelector(`[data-announcement-menu="${menuOpenId}"]`)

      if (trigger && trigger.contains(event.target)) return
      if (menu && menu.contains(event.target)) return

      setMenuOpenId(null)
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpenId])

  useEffect(() => {
    if (gameMenuOpenId === null) return

    const handleClickOutside = (event) => {
      const trigger = document.querySelector(`[data-game-menu-button="${gameMenuOpenId}"]`)
      const menu = document.querySelector(`[data-game-menu="${gameMenuOpenId}"]`)

      if (trigger && trigger.contains(event.target)) return
      if (menu && menu.contains(event.target)) return

      setGameMenuOpenId(null)
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [gameMenuOpenId])

  useEffect(() => {
    const handleCreate = (announcement) => {
      setAnnouncements((prev) => [announcement, ...prev])
    }
    const handleUpdate = (announcement) => {
      setAnnouncements((prev) => prev.map((item) => item.announcement_id === announcement.announcement_id ? announcement : item))
    }
    const handleDelete = ({ announcement_id }) => {
      setAnnouncements((prev) => prev.filter((item) => item.announcement_id !== announcement_id))
    }

    socket.on('announcementCreated', handleCreate)
    socket.on('announcementUpdated', handleUpdate)
    socket.on('announcementDeleted', handleDelete)

    return () => {
      socket.off('announcementCreated', handleCreate)
      socket.off('announcementUpdated', handleUpdate)
      socket.off('announcementDeleted', handleDelete)
    }
  }, [socket])

  const handleDeleteAnnouncement = (id) => {
    setConfirmState({
      title: 'Delete announcement',
      message: 'Delete this announcement? This action cannot be undone.',
      confirmText: 'Delete',
      tone: 'danger',
      icon: 'ti-trash',
      onConfirm: async () => {
        try {
          await axios.delete(`/api/announcements/${id}`)
          setAnnouncements((prev) => prev.filter((item) => item.announcement_id !== id))
          setMenuOpenId(null)
          setConfirmState(null)
        } catch (err) {
          console.error(err)
          setError('Failed to delete announcement.')
          setConfirmState(null)
        }
      },
      onClose: () => setConfirmState(null),
    })
  }

  const handleDeleteGame = (game) => {
    setConfirmState({
      title: 'Delete game',
      message: `Delete "${game.home_team_name} vs ${game.away_team_name}"? This action cannot be undone.`,
      confirmText: 'Delete',
      tone: 'danger',
      icon: 'ti-trash',
      onConfirm: async () => {
        try {
          await axios.delete(`/api/admin/games/${game.game_id}`)
          setUpcomingGames((prev) => prev.filter((item) => item.game_id !== game.game_id))
          setConfirmState(null)
        } catch (err) {
          console.error(err)
          setError('Failed to delete game.')
          setConfirmState(null)
        }
      },
      onClose: () => setConfirmState(null),
    })
  }

  const handleEditGame = (game) => {
    setGameMenuOpenId(null)
    setEditingGame(game)
    setGameEditForm({
      scheduled_time: game.scheduled_time ? new Date(game.scheduled_time).toISOString().slice(0, 16) : '',
      venue: game.venue || ''
    })
  }

  const saveGameEdit = async () => {
    if (!editingGame) return
    setSavingGame(true)
    try {
      await axios.patch(`/api/admin/games/${editingGame.game_id}`, gameEditForm)
      setEditingGame(null)
      await loadAnnouncements()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update game.')
    } finally {
      setSavingGame(false)
    }
  }

  const publishAnnouncement = async () => {
    if (!createForm.title.trim() || !createForm.message.trim()) {
      setCreateMessage('Title and message are required.')
      return
    }

    setCreating(true)
    try {
      if (editingAnnouncementId) {
        await axios.patch(`/api/announcements/${editingAnnouncementId}`, createForm)
      } else {
        await axios.post('/api/announcements', createForm)
      }
      setCreateForm({ title: '', message: '', type: 'general' })
      setEditingAnnouncementId(null)
      setCreateMessage(editingAnnouncementId ? 'Announcement updated.' : 'Announcement published.')
      setCreateOpen(false)
      await loadAnnouncements()
    } catch (err) {
      setCreateMessage(err.response?.data?.message || 'Failed to publish announcement.')
    } finally {
      setCreating(false)
    }
  }

  const handleEditAnnouncement = (announcement) => {
    setCreateForm({
      title: announcement.title,
      message: announcement.message,
      type: announcement.type || 'general',
    })
    setEditingAnnouncementId(announcement.announcement_id)
    setCreateMessage('')
    setMenuOpenId(null)
    setCreateOpen(true)
  }

  return (
    <>
      <ConfirmModal
        open={!!confirmState}
        title={confirmState?.title || 'Confirm action'}
        message={confirmState?.message}
        confirmText={confirmState?.confirmText || 'Confirm'}
        tone={confirmState?.tone || 'warning'}
        icon={confirmState?.icon || 'ti-alert-circle'}
        onConfirm={confirmState?.onConfirm || (() => setConfirmState(null))}
        onClose={confirmState?.onClose || (() => setConfirmState(null))}
      />

      {editingGame && (
        <div
          role="presentation"
          onClick={() => setEditingGame(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(2, 6, 23, 0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-game-title"
            onClick={event => event.stopPropagation()}
            style={{ width: 460, maxWidth: '92vw', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, boxShadow: '0 24px 60px rgba(2, 6, 23, 0.6)' }}
          >
            <div id="edit-game-title" style={{ fontSize: 18, fontWeight: 800, marginBottom: 16 }}>Edit game</div>
            <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--text-muted)' }}>
              {editingGame.home_team_name} vs {editingGame.away_team_name}
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              <label style={{ display: 'grid', gap: 4, fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                Date &amp; Time
                <input type="datetime-local" value={gameEditForm.scheduled_time} onChange={event => setGameEditForm(form => ({ ...form, scheduled_time: event.target.value }))} style={{ padding: 10, fontSize: 13, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-panel)', color: 'var(--text)' }} />
              </label>
              <label style={{ display: 'grid', gap: 4, fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                Venue
                <input value={gameEditForm.venue} onChange={event => setGameEditForm(form => ({ ...form, venue: event.target.value }))} placeholder="Venue" style={{ padding: 10, fontSize: 13, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-panel)', color: 'var(--text)' }} />
              </label>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" onClick={() => setEditingGame(null)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-panel)', color: 'var(--text-muted)', cursor: 'pointer' }}>Cancel</button>
                <button type="button" onClick={saveGameEdit} disabled={savingGame} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: 'var(--orange)', color: '#fff', cursor: savingGame ? 'wait' : 'pointer' }}>{savingGame ? 'Saving...' : 'Save changes'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {createOpen && (
        <div
          role="presentation"
          onClick={() => setCreateOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 998, background: 'rgba(2, 6, 23, 0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-announcement-title"
            onClick={event => event.stopPropagation()}
            style={{ width: 520, maxWidth: '92vw', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, boxShadow: '0 24px 60px rgba(2, 6, 23, 0.6)' }}
          >
            <div id="create-announcement-title" style={{ fontSize: 18, fontWeight: 800, marginBottom: 16 }}>{editingAnnouncementId ? 'Edit announcement' : 'Create announcement'}</div>
            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Title</label>
                <input value={createForm.title} onChange={event => setCreateForm(form => ({ ...form, title: event.target.value }))} style={{ width: '100%', padding: 10, fontSize: 13, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-panel)', color: 'var(--text)' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Type</label>
                <select value={createForm.type} onChange={event => setCreateForm(form => ({ ...form, type: event.target.value }))} style={{ width: '100%', padding: 10, fontSize: 13, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-panel)', color: 'var(--text)' }}>
                  <option value="general">General</option>
                  <option value="important">Important</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Message</label>
                <textarea value={createForm.message} rows={5} onChange={event => setCreateForm(form => ({ ...form, message: event.target.value }))} style={{ width: '100%', padding: 10, fontSize: 13, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-panel)', color: 'var(--text)', resize: 'vertical' }} />
              </div>
              {createMessage && <div style={{ fontSize: 12, color: createMessage.includes('published') ? '#22c55e' : '#ef4444' }}>{createMessage}</div>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" onClick={() => setCreateOpen(false)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-panel)', color: 'var(--text-muted)', cursor: 'pointer' }}>Cancel</button>
                <button type="button" onClick={publishAnnouncement} disabled={creating} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: 'var(--orange)', color: '#fff', cursor: creating ? 'wait' : 'pointer', opacity: creating ? 0.7 : 1 }}>{creating ? 'Saving...' : editingAnnouncementId ? 'Update announcement' : 'Publish announcement'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ padding: 32, minHeight: '100%', color: 'var(--text)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Announcements</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Important notices, schedule alerts, and league announcements in one place.</div>
          </div>
          {canCreateAnnouncements && (
            <button type="button" onClick={() => { setCreateForm({ title: '', message: '', type: 'general' }); setEditingAnnouncementId(null); setCreateMessage(''); setCreateOpen(true) }} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: 'var(--orange)', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>
              Create announcement
            </button>
          )}
        </div>

        {loading && (
          <div style={{ padding: 20, background: 'var(--bg-card)', borderRadius: 12, color: 'var(--text-muted)' }}>
            Loading announcements...
          </div>
        )}

        {error && (
          <div style={{ padding: 20, background: 'rgba(239,68,68,0.08)', borderRadius: 12, color: '#ef4444' }}>{error}</div>
        )}

        {!loading && !error && announcements.length === 0 && upcomingGames.length === 0 && (
          <div style={{ padding: 20, background: 'var(--bg-card)', borderRadius: 12, color: 'var(--text-muted)' }}>
            No announcements yet.
          </div>
        )}

        {!loading && (announcements.length > 0 || upcomingGames.length > 0) && (
          <div style={{ display: 'grid', gap: 16 }}>
            {/* Upcoming Games Section */}
            {upcomingGames.length > 0 && (
              <>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginTop: 16 }}>Upcoming Games</div>
                {upcomingGames.map((game) => (
                  <div
                    key={`game-${game.game_id}`}
                    onClick={() => navigate(`/game/${game.game_id}`)}
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 18, cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 10 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{game.home_team_name} vs {game.away_team_name}</div>
                      <Badge type="schedule" isUpcoming={true} />
                      {canManageAnnouncements && (
                      <div style={{ marginLeft: 'auto', position: 'relative' }}>
                        <button
                          type="button"
                          data-game-menu-button={game.game_id}
                          onClick={(event) => {
                            event.stopPropagation()
                            setGameMenuOpenId((prev) => prev === game.game_id ? null : game.game_id)
                          }}
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 8,
                            border: '1px solid var(--border)',
                            background: 'var(--bg-panel)',
                            color: 'var(--text)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            fontSize: 18,
                            lineHeight: 1,
                            padding: 0,
                          }}
                          aria-label="Open game actions"
                        >
                          ⋮
                        </button>

                        {gameMenuOpenId === game.game_id && (
                          <div
                            data-game-menu={game.game_id}
                            style={{
                              position: 'absolute',
                              top: 'calc(100% + 8px)',
                              right: 0,
                              minWidth: 150,
                              background: 'var(--bg-card)',
                              border: '1px solid var(--border)',
                              borderRadius: 10,
                              boxShadow: '0 18px 42px rgba(2, 6, 23, 0.24)',
                              overflow: 'hidden',
                              zIndex: 20,
                            }}
                          >
                            {canManageAnnouncements && (
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  handleEditGame(game)
                                }}
                                style={{
                                  width: '100%',
                                  background: 'transparent',
                                  border: 'none',
                                  color: 'var(--text)',
                                  textAlign: 'left',
                                  padding: '10px 12px',
                                  cursor: 'pointer',
                                  fontSize: 13,
                                  fontWeight: 600,
                                }}
                              >
                                Edit game
                              </button>
                            )}
                            {canManageAnnouncements && (
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  setGameMenuOpenId(null)
                                  handleDeleteGame(game)
                                }}
                                style={{
                                  width: '100%',
                                  background: 'transparent',
                                  border: 'none',
                                  color: '#ef4444',
                                  textAlign: 'left',
                                  padding: '10px 12px',
                                  cursor: 'pointer',
                                  fontSize: 13,
                                  fontWeight: 600,
                                }}
                              >
                                Delete game
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      )}
                    </div>
                    <div style={{ color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 14, fontSize: 13 }}>
                      <div><strong>{game.league_name}</strong></div>
                      <div>{new Date(game.scheduled_time).toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
                      <div>{new Date(game.scheduled_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>
                      {game.venue && <div>Venue: {game.venue}</div>}
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* Regular Announcements Section */}
            {announcements.length > 0 && (
              <>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginTop: 16 }}>Announcements</div>
                {announcements.map((announcement) => (
                  <div key={announcement.announcement_id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 18 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 10 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{announcement.title}</div>
                      <Badge type={announcement.type} />

                      {canManageAnnouncements && (
                        <div style={{ marginLeft: 'auto', position: 'relative' }}>
                          <button
                            type="button"
                            data-announcement-menu-button={announcement.announcement_id}
                            onClick={(event) => {
                              event.stopPropagation()
                              setMenuOpenId((prev) => prev === announcement.announcement_id ? null : announcement.announcement_id)
                            }}
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 8,
                              border: '1px solid var(--border)',
                              background: 'var(--bg-panel)',
                              color: 'var(--text)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              fontSize: 18,
                              lineHeight: 1,
                              padding: 0,
                            }}
                            aria-label="Open announcement actions"
                          >
                            ⋮
                          </button>

                          {menuOpenId === announcement.announcement_id && (
                            <div
                              data-announcement-menu={announcement.announcement_id}
                              style={{
                                position: 'absolute',
                                top: 'calc(100% + 8px)',
                                right: 0,
                                minWidth: 140,
                                background: 'var(--bg-card)',
                                border: '1px solid var(--border)',
                                borderRadius: 10,
                                boxShadow: '0 18px 42px rgba(2, 6, 23, 0.24)',
                                overflow: 'hidden',
                                zIndex: 20,
                              }}
                            >
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  handleEditAnnouncement(announcement)
                                }}
                                style={{
                                  width: '100%',
                                  background: 'transparent',
                                  border: 'none',
                                  color: 'var(--text)',
                                  textAlign: 'left',
                                  padding: '10px 12px',
                                  cursor: 'pointer',
                                  fontSize: 13,
                                  fontWeight: 600,
                                }}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  setMenuOpenId(null)
                                  handleDeleteAnnouncement(announcement.announcement_id)
                                }}
                                style={{
                                  width: '100%',
                                  background: 'transparent',
                                  border: 'none',
                                  color: '#ef4444',
                                  textAlign: 'left',
                                  padding: '10px 12px',
                                  cursor: 'pointer',
                                  fontSize: 13,
                                  fontWeight: 600,
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div style={{ color: 'var(--text-muted)', whiteSpace: 'pre-wrap', lineHeight: 1.6, marginBottom: 14 }}>{announcement.message}</div>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', color: 'var(--text-muted)', fontSize: 11 }}>
                      <span>{formatDate(announcement.created_at)}</span>
                      {announcement.author && <span>By {announcement.author}</span>}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </>
  )
}
