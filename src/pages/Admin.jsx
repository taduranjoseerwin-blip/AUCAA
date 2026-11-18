import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../hooks/useSocket'
import ConfirmModal from '../components/ConfirmModal'
import LiveScoreboard from './LiveScoreboard'

// ── Stat Card ────────────────────────────────────────────────
function StatCard({ label, value, icon, color, alert }) {
  return (
    <div style={{
      background: 'var(--bg-card)', border: `1px solid ${alert ? 'rgba(239,68,68,0.3)' : 'var(--border)'}`,
      borderRadius: 10, padding: '14px 16px', flex: '1 1 180px', minWidth: 120,
      minHeight: 140, display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
    }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
        <i className={`ti ${icon}`} style={{ marginRight: 5, color: color || 'var(--orange)' }} />{label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: alert ? '#ef4444' : '#fffbeb' }}>{value}</div>
    </div>
  )
}

// ── Section wrapper ───────────────────────────────────────────
function Section({ title, icon, children, action }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-panel)' }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className={`ti ${icon}`} style={{ color: 'var(--orange)', fontSize: 16 }} />{title}
        </div>
        {action}
      </div>
      <div style={{ padding: 16 }}>{children}</div>
    </div>
  )
}

// ── Badge ────────────────────────────────────────────────────
function Badge({ value, type }) {
  const label = typeof value === 'string' ? value.replace('_', ' ') : value
  const isStatus = ['live', 'upcoming', 'completed', 'active', 'suspended', 'used', 'unused'].includes(String(value || '').toLowerCase())

  if (isStatus) {
    return <span style={{ color: 'var(--text-muted)', fontWeight: 600, textTransform: 'capitalize' }}>{label}</span>
  }

  const styles = {
    admin:          { bg: 'rgba(249,115,22,0.18)',   color: '#f97316' },
    league_manager: { bg: 'rgba(139,92,246,0.18)',   color: '#a78bfa' },
    player:         { bg: 'rgba(59,130,246,0.15)',   color: '#60a5fa' },
    fan:            { bg: 'rgba(107,112,128,0.15)',  color: '#6b7080' },
    verified:       { bg: 'rgba(34,197,94,0.15)',    color: '#22c55e' },
    rejected:       { bg: 'rgba(239,68,68,0.15)',    color: '#ef4444' },
  }
  const s = styles[value] || styles[type] || { bg: 'rgba(107,112,128,0.15)', color: '#6b7080' }
  return (
    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, fontWeight: 700, background: s.bg, color: s.color, textTransform: 'capitalize' }}>
      {label}
    </span>
  )
}

// ── Mini input ───────────────────────────────────────────────
function Input({ label, ...props }) {
  return (
    <div style={{ marginBottom: 10 }}>
      {label && <label style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, display: 'block', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</label>}
      <input style={{ width: '100%', fontSize: 13 }} {...props} />
    </div>
  )
}

function Select({ label, children, ...props }) {
  return (
    <div style={{ marginBottom: 10 }}>
      {label && <label style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, display: 'block', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</label>}
      <select style={{ width: '100%', fontSize: 13 }} {...props}>{children}</select>
    </div>
  )
}

function Btn({ children, color, onClick, style = {} }) {
  const colors = {
    orange: { bg: 'var(--orange)',            text: '#fff' },
    red:    { bg: 'rgba(239,68,68,0.15)',     text: '#ef4444' },
    green:  { bg: 'rgba(34,197,94,0.15)',     text: '#22c55e' },
    gray:   { bg: 'var(--bg-panel)',          text: 'var(--text-muted)' },
    purple: { bg: 'rgba(139,92,246,0.15)',    text: '#a78bfa' },
  }
  const c = colors[color] || colors.gray
  return (
    <button onClick={onClick} style={{
      padding: '4px 10px', fontSize: 11, fontWeight: 600, borderRadius: 5,
      border: '1px solid rgba(255,255,255,0.08)',
      background: c.bg, color: c.text, cursor: 'pointer', ...style
    }}>{children}</button>
  )
}

// ══════════════════════════════════════════════════════════════
// SECTION: User Management
// ══════════════════════════════════════════════════════════════
function UserManagement({ onUserChanged }) {
  const [users, setUsers] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [confirmState, setConfirmState] = useState(null)

  const load = useCallback(async () => {
    try {
      const r = await axios.get('/api/admin/users')
      setUsers(r.data)
    } catch (_) {}
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const updateStatus = async (id, status) => {
    await axios.patch(`/api/admin/users/${id}/status`, { status })
    onUserChanged?.()
    load()
  }

  const handleDeleteUser = (user) => {
    setConfirmState({
      title: 'Delete user',
      message: `Delete "${user.username}"? This action cannot be undone.`,
      confirmText: 'Delete',
      tone: 'danger',
      icon: 'ti-trash',
      onConfirm: async () => {
        try {
          await axios.delete(`/api/admin/users/${user.id}`)
          setConfirmState(null)
          onUserChanged?.()
          load()
        } catch (_) {
          setConfirmState(null)
        }
      },
      onClose: () => setConfirmState(null),
    })
  }

  const filtered = users.filter(u =>
    u.username?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  )

  const thStyle = { padding: '8px 12px', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', textAlign: 'left', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }
  const tdStyle = { padding: '10px 12px', fontSize: 12, borderBottom: '1px solid rgba(255,255,255,0.04)', verticalAlign: 'middle' }

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

      <Section title="User Management" icon="ti-users" action={
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users..." style={{ fontSize: 12, padding: '4px 10px', width: 180 }} />
      }>
        {loading ? <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>Loading...</div> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={thStyle}>Username</th>
                <th style={thStyle}>Email</th>
                <th style={thStyle}>Role</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Joined</th>
                <th style={thStyle}>Actions</th>
              </tr></thead>
              <tbody>
                {filtered.map(u => (
                  <tr key={u.id}>
                    <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--text)' }}>{u.username}</td>
                    <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>{u.email}</td>
                    <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>
                      {u.role?.replace('_', ' ')}
                    </td>
                    <td style={tdStyle}><Badge value={u.status} /></td>
                    <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>{new Date(u.created_at).toLocaleDateString('en-PH')}</td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: 5 }}>
                        {u.status !== 'active'    && <Btn color="green"  onClick={() => updateStatus(u.id, 'active')}>Activate</Btn>}
                        {u.status !== 'suspended' && <Btn color="red"    onClick={() => updateStatus(u.id, 'suspended')}>Suspend</Btn>}
                        <Btn color="red" onClick={() => handleDeleteUser(u)}>Delete</Btn>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>{filtered.length} users</div>
          </div>
        )}
      </Section>

    </>
  )
}

// ══════════════════════════════════════════════════════════════
// SECTION: Coach Verification
// ══════════════════════════════════════════════════════════════
function CoachVerification({ onUserChanged }) {
  const { user } = useAuth()
  const socket = useSocket()
  const [accounts, setAccounts] = useState([])
  const [filter, setFilter] = useState('pending')
  const [confirmState, setConfirmState] = useState(null)

  const load = useCallback(async () => {
    try {
      const response = await axios.get('/api/admin/verifications')
      setAccounts(response.data)
    } catch (_) {}
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const refreshVerifications = () => load()
    socket.on('verificationUpdated', refreshVerifications)
    return () => socket.off('verificationUpdated', refreshVerifications)
  }, [socket, load])

  const verify = async (id, status, verification_type) => {
    const payload = { status, verification_type }
    try {
      const response = await axios.patch(`/api/admin/verifications/${id}`, payload)
      if (status === 'verified' && response.data?.approval_email_sent === false) {
        alert('Account approved, but the approval email could not be sent. Check the Gmail SMTP settings.')
      }
      onUserChanged?.()
      load()
    } catch (err) {
      alert(err.response?.data?.message || 'Error updating player.')
    }
  }

  const handleDeletePlayer = (player) => {
    setConfirmState({
      title: 'Delete player',
      message: `Delete "${player.name}"? This action cannot be undone.`,
      confirmText: 'Delete',
      tone: 'danger',
      icon: 'ti-trash',
      onConfirm: async () => {
        try {
          await axios.delete(`/api/admin/players/${player.player_id}`)
          setConfirmState(null)
          onUserChanged?.()
          load()
        } catch (err) {
          setConfirmState(null)
          alert(err.response?.data?.message || 'Error deleting player.')
        }
      },
      onClose: () => setConfirmState(null),
    })
  }

  const handleDeleteCoach = (coach) => {
    setConfirmState({
      title: 'Delete coach account',
      message: `Delete "${coach.username}"? This action cannot be undone.`,
      confirmText: 'Delete',
      tone: 'danger',
      icon: 'ti-trash',
      onConfirm: async () => {
        try {
          await axios.delete(`/api/admin/users/${coach.user_id}`)
          setConfirmState(null)
          onUserChanged?.()
          load()
        } catch (err) {
          setConfirmState(null)
          alert(err.response?.data?.message || 'Error deleting coach account.')
        }
      },
      onClose: () => setConfirmState(null),
    })
  }

  const filtered = accounts.filter(p => filter === 'all' || p.verification_status === filter)
  const showActions = filter === 'pending'
  const playerAccounts = filtered.filter(p => p.verification_type === 'player')
  const coachRows = filtered.filter(p => p.verification_type === 'account' && p.role === 'coach')
  const leagueManagerRows = filtered.filter(p => p.verification_type === 'account' && p.role === 'league_manager')

  const thStyle = { padding: '8px 12px', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', textAlign: 'left', borderBottom: '1px solid var(--border)' }
  const tdStyle = { padding: '10px 12px', fontSize: 12, borderBottom: '1px solid rgba(255,255,255,0.04)', verticalAlign: 'middle' }

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

      {user?.role === 'admin' && <Section title="Players Verification" icon="ti-shield-check" action={
        <div style={{ display: 'flex', gap: 5 }}>
          {['pending','verified','rejected','all'].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '3px 10px', fontSize: 11, fontWeight: 600, borderRadius: 4,
              background: filter === f ? 'var(--orange)' : 'var(--bg-panel)',
              color: filter === f ? '#fff' : 'var(--text-muted)',
              border: '1px solid var(--border)', cursor: 'pointer', textTransform: 'capitalize'
            }}>{f}</button>
          ))}
        </div>
      }>
        {playerAccounts.length === 0
          ? <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>No {filter} players.</div>
          : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={thStyle}>Account</th>
                <th style={thStyle}>Jersey</th>
                <th style={thStyle}>Position</th>
                <th style={thStyle}>DOB</th>
                <th style={thStyle}>Height</th>
                <th style={thStyle}>Weight</th>
                <th style={thStyle}>Barangay</th>
                <th style={thStyle}>Student ID</th>
                <th style={thStyle}>Status</th>
                {showActions && <th style={thStyle}>Actions</th>}
              </tr></thead>
              <tbody>
                {playerAccounts.map(p => (
                  <tr key={`${p.verification_type}-${p.verification_id}`}>
                    <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--text)' }}>{p.name}</td>
                    <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>#{p.jersey_number || '—'}</td>
                    <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>{p.position || '—'}</td>
                    <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>{p.date_of_birth ? new Date(p.date_of_birth).toLocaleDateString('en-PH') : '—'}</td>
                    <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>{p.height || '—'}</td>
                    <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>{p.weight || '—'}</td>
                    <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>{p.barangay || '—'}</td>
                    <td style={{ ...tdStyle, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{p.student_id || '—'}</td>
                    <td style={tdStyle}><Badge value={p.verification_status} /></td>
                    {showActions && <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        <Btn color="green" onClick={() => verify(p.verification_id, 'verified', p.verification_type)}>✓ Verify</Btn>
                        <Btn color="red" onClick={() => verify(p.verification_id, 'rejected', p.verification_type)}>✗ Reject</Btn>
                        <Btn color="red" onClick={() => handleDeletePlayer({ ...p, player_id: p.verification_id })}>Delete</Btn>
                      </div>
                    </td>}
                  </tr>
                ))}
              </tbody>
            </table>
          )
        }
      </Section>}

      <Section title="Coach Verification" icon="ti-user-check" action={
        <div style={{ display: 'flex', gap: 5 }}>
          {['pending','verified','rejected','all'].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '3px 10px', fontSize: 11, fontWeight: 600, borderRadius: 4,
              background: filter === f ? 'var(--orange)' : 'var(--bg-panel)',
              color: filter === f ? '#fff' : 'var(--text-muted)',
              border: '1px solid var(--border)', cursor: 'pointer', textTransform: 'capitalize'
            }}>{f}</button>
          ))}
        </div>
      }>
        {coachRows.length === 0
          ? <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>No {filter} coach.</div>
          : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={thStyle}>Username</th>
                <th style={thStyle}>Email</th>
                <th style={thStyle}>Role</th>
                <th style={thStyle}>Status</th>
                {showActions && <th style={thStyle}>Actions</th>}
              </tr></thead>
              <tbody>
                {coachRows.map(account => (
                  <tr key={`account-${account.verification_id}`}>
                    <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--text)' }}>{account.username}</td>
                    <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>{account.email}</td>
                    <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>{account.role?.replace('_', ' ')}</td>
                    <td style={tdStyle}><Badge value={account.verification_status} /></td>
                    {showActions && <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        <Btn color="green" onClick={() => verify(account.verification_id, 'verified', 'account')}>✓ Verify</Btn>
                        <Btn color="red" onClick={() => verify(account.verification_id, 'rejected', 'account')}>✗ Reject</Btn>
                        <Btn color="red" onClick={() => handleDeleteCoach(account)}>Delete</Btn>
                      </div>
                    </td>}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </Section>

      {user?.role === 'admin' && <Section title="League Manager Verification" icon="ti-user-check" action={
        <div style={{ display: 'flex', gap: 5 }}>
          {['pending','verified','rejected','all'].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '3px 10px', fontSize: 11, fontWeight: 600, borderRadius: 4,
              background: filter === f ? 'var(--orange)' : 'var(--bg-panel)',
              color: filter === f ? '#fff' : 'var(--text-muted)',
              border: '1px solid var(--border)', cursor: 'pointer', textTransform: 'capitalize'
            }}>{f}</button>
          ))}
        </div>
      }>
        {leagueManagerRows.length === 0
          ? <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>No {filter} league managers.</div>
          : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={thStyle}>Username</th>
                <th style={thStyle}>Email</th>
                <th style={thStyle}>Role</th>
                <th style={thStyle}>Status</th>
                {showActions && <th style={thStyle}>Actions</th>}
              </tr></thead>
              <tbody>
                {leagueManagerRows.map(account => (
                  <tr key={`league-manager-${account.verification_id}`}>
                    <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--text)' }}>{account.username}</td>
                    <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>{account.email}</td>
                    <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>League Manager</td>
                    <td style={tdStyle}><Badge value={account.verification_status} /></td>
                    {showActions && <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        <Btn color="green" onClick={() => verify(account.verification_id, 'verified', 'account')}>✓ Verify</Btn>
                        <Btn color="red" onClick={() => verify(account.verification_id, 'rejected', 'account')}>✗ Reject</Btn>
                        <Btn color="red" onClick={() => handleDeleteCoach(account)}>Delete</Btn>
                      </div>
                    </td>}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </Section>}
    </>
  )
}

// ══════════════════════════════════════════════════════════════
// SECTION: Registration Codes
// ══════════════════════════════════════════════════════════════
function RegCodes() {
  const { user } = useAuth()
  const allowedRoles = user?.role === 'league_manager' ? ['coach'] : ['player', 'coach', 'league_manager', 'admin']
  const [codes, setCodes] = useState([])
  const [managedCoaches, setManagedCoaches] = useState([])
  const [managerTab, setManagerTab] = useState('codes')
  const [form, setForm] = useState({ code: '', role: allowedRoles[0] })
  const [msg, setMsg] = useState('')
  const [creatingCoachCode, setCreatingCoachCode] = useState(false)

  const load = useCallback(async () => {
    try { const r = await axios.get('/api/admin/regcodes'); setCodes(r.data) } catch (_) {}
    if (user?.role === 'league_manager') {
      try {
        const r = await axios.get('/api/admin/managed-coaches')
        setManagedCoaches(r.data || [])
      } catch (_) {}
    }
  }, [user?.role])

  useEffect(() => { load() }, [load])

  const generate = () => {
    const prefix = form.role === 'league_manager' ? 'LM'
      : form.role === 'admin' ? 'ADMIN'
      : form.role === 'coach' ? 'COACH'
      : form.role === 'player' ? 'PLAYER'
      : 'CODE'
    const rand = Math.random().toString(36).substring(2, 8).toUpperCase()
    setForm(f => ({ ...f, code: `AUCAA-${prefix}-${rand}` }))
  }

  const create = async () => {
    if (!form.code) return
    try {
      await axios.post('/api/admin/regcodes', form)
      setMsg('Code created!')
      setForm({ code: '', role: allowedRoles[0] })
      load()
      setTimeout(() => setMsg(''), 2000)
    } catch (err) {
      setMsg(err.response?.data?.message || 'Error')
    }
  }

  const createCoachCode = async () => {
    const code = `AUCAA-COACH-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
    setCreatingCoachCode(true)
    setMsg('')
    try {
      await axios.post('/api/admin/regcodes', { code, role: 'coach' })
      setMsg(`Created ${code}. Share it with the coach to register.`)
      await load()
    } catch (err) {
      setMsg(err.response?.data?.message || 'Failed to create coach code.')
    } finally {
      setCreatingCoachCode(false)
    }
  }

  const copyCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code)
      setMsg(`${code} copied.`)
    } catch {
      setMsg('Could not copy the code. Select and copy it manually.')
    }
  }

  const handleDeleteCode = async (code) => {
    try {
      await axios.delete(`/api/admin/regcodes/${code.id}`)
      load()
    } catch (_) {}
  }

  const thStyle = { padding: '8px 12px', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', textAlign: 'left', borderBottom: '1px solid var(--border)' }
  const tdStyle = { padding: '10px 12px', fontSize: 12, borderBottom: '1px solid rgba(255,255,255,0.04)' }
  const codeActionStyle = { width: 72, height: 30, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', whiteSpace: 'nowrap' }

  return (
    <>
      {user?.role === 'league_manager' && (
        <div role="tablist" aria-label="League manager registration sections" style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
          {[{ id: 'codes', label: 'Reg Codes' }, { id: 'coaches', label: 'Coaches' }].map(tab => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={managerTab === tab.id}
              onClick={() => setManagerTab(tab.id)}
              style={{
                padding: '10px 16px', border: 'none', borderBottom: managerTab === tab.id ? '2px solid var(--orange)' : '2px solid transparent',
                background: 'transparent', color: managerTab === tab.id ? 'var(--orange)' : 'var(--text-muted)',
                fontSize: 13, fontWeight: 700, cursor: 'pointer'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {user?.role === 'league_manager' && managerTab === 'coaches' && (
        <Section title="Coaches Under Your Management" icon="ti-users">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={thStyle}>Coach</th>
                <th style={thStyle}>Email</th>
                <th style={thStyle}>Assigned Team</th>
                <th style={thStyle}>Account Status</th>
              </tr></thead>
              <tbody>
                {managedCoaches.map(coach => (
                  <tr key={coach.id}>
                    <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--text)' }}>{coach.username}</td>
                    <td style={tdStyle}>{coach.email}</td>
                    <td style={{ ...tdStyle, color: coach.team_names ? 'var(--text)' : 'var(--text-muted)' }}>{coach.team_names || 'Not assigned'}</td>
                    <td style={tdStyle}><Badge value={coach.status === 'approved' ? 'verified' : coach.status === 'rejected' ? 'rejected' : 'pending'} /></td>
                  </tr>
                ))}
                {managedCoaches.length === 0 && (
                  <tr><td colSpan={4} style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)' }}>No coaches registered with your codes yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {(user?.role !== 'league_manager' || managerTab === 'codes') && (
      <Section
        title={user?.role === 'league_manager' ? 'Coach Registration Codes' : 'Registration Codes'}
        icon="ti-key"
        action={user?.role === 'league_manager' && (
          <Btn color="orange" onClick={createCoachCode} disabled={creatingCoachCode}>
            {creatingCoachCode ? 'Creating...' : 'Generate coach code'}
          </Btn>
        )}
      >
        {/* Create form */}
        {user?.role !== 'league_manager' && <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 8, padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>Create New Code</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: 160 }}>
              <Input label="Code" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="AUCAA-PLAYER-XXXX" />
            </div>
            <div style={{ minWidth: 140 }}>
              <Select label="Role" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                {allowedRoles.map(role => <option key={role} value={role}>{role.replace('_', ' ')}</option>)}
              </Select>
            </div>
            <div style={{ display: 'flex', gap: 6, paddingBottom: 10 }}>
              <Btn color="gray" onClick={generate}>🎲 Auto Generate</Btn>
              <Btn color="orange" onClick={create} style={{ padding: '4px 14px' }}>+ Create</Btn>
            </div>
          </div>
          {msg && <div style={{ fontSize: 12, color: msg.includes('!') ? '#22c55e' : '#ef4444', marginTop: 6 }}>{msg}</div>}
        </div>}
        {user?.role === 'league_manager' && (
          <p style={{ margin: '0 0 14px', fontSize: 12, color: 'var(--text-muted)' }}>
            These codes can only be used to register coach accounts.
          </p>
        )}
        {msg && <div role="status" style={{ fontSize: 12, color: msg.startsWith('Created') || msg.endsWith('copied.') || msg.includes('!') ? '#22c55e' : '#ef4444', marginBottom: 12 }}>{msg}</div>}

        {/* Codes table */}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>
            <th style={thStyle}>Code</th>
            {user?.role !== 'league_manager' && <th style={thStyle}>Role</th>}
            <th style={thStyle}>Status</th>
            <th style={thStyle}>Created</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
          </tr></thead>
          <tbody>
            {codes.map(c => (
              <tr key={c.id}>
                <td style={{ ...tdStyle, fontFamily: 'monospace', fontWeight: 600, color: 'var(--orange)' }}>{c.code}</td>
                {user?.role !== 'league_manager' && <td style={tdStyle}><Badge value={c.role} /></td>}
                {user?.role === 'league_manager'
                  ? <td style={{ ...tdStyle, color: c.used ? 'var(--text-muted)' : '#22c55e', fontWeight: 600 }}>{c.used ? 'Used' : 'Unused'}</td>
                  : <td style={tdStyle}><Badge value={c.used ? 'used' : 'unused'} /></td>}
                <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>{new Date(c.created_at).toLocaleDateString('en-PH')}</td>
                <td style={{ ...tdStyle, verticalAlign: 'middle' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                    {user?.role === 'league_manager' && <Btn color="gray" onClick={() => copyCode(c.code)} style={codeActionStyle}>Copy</Btn>}
                    <Btn color="red" onClick={() => handleDeleteCode(c)} style={codeActionStyle}>Delete</Btn>
                  </div>
                </td>
              </tr>
            ))}
            {codes.length === 0 && <tr><td colSpan={user?.role === 'league_manager' ? 4 : 5} style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)' }}>No codes yet.</td></tr>}
          </tbody>
        </table>
      </Section>
      )}
    </>
  )
}

// ══════════════════════════════════════════════════════════════
// SECTION: Leagues Management
// ══════════════════════════════════════════════════════════════
function LeaguesManagement() {
  const [leagues, setLeagues] = useState([])
  const [form, setForm] = useState({ name: '', season: '', status: 'upcoming', format: 'elimination' })
  const [editing, setEditing] = useState(null)
  const [msg, setMsg] = useState('')
  const [confirmState, setConfirmState] = useState(null)

  const load = useCallback(async () => {
    try { const r = await axios.get('/api/leagues'); setLeagues(r.data) } catch (_) {}
  }, [])

  useEffect(() => { load() }, [load])

  const save = async () => {
    if (!form.name) return
    try {
      if (editing) {
        await axios.patch(`/api/leagues/${editing}`, form)
        setEditing(null)
      } else {
        await axios.post('/api/leagues', form)
      }
      setForm({ name: '', season: '', status: 'upcoming', format: 'elimination' })
      setMsg(editing ? 'League updated!' : 'League created!')
      await load()
      setTimeout(() => setMsg(''), 2000)
    } catch (_) { setMsg('Error saving league.') }
  }

  const startEdit = (l) => {
    setEditing(l.league_id)
    setForm({ name: l.name, season: l.season || '', status: l.status || 'upcoming', format: l.format || 'elimination' })
  }

  const handleDeleteLeague = (league) => {
    setConfirmState({
      title: 'Delete league',
      message: `Delete "${league.name}"? This will remove all associated teams and games. This action cannot be undone.`,
      confirmText: 'Delete',
      tone: 'danger',
      icon: 'ti-trash',
      onConfirm: async () => {
        try {
          await axios.delete(`/api/leagues/${league.league_id}`)
          setConfirmState(null)
          setMsg('League deleted!')
          load()
          setTimeout(() => setMsg(''), 2000)
        } catch (err) {
          setConfirmState(null)
          setMsg(err.response?.data?.message || 'Error deleting league.')
          setTimeout(() => setMsg(''), 3000)
        }
      },
      onClose: () => setConfirmState(null),
    })
  }

  const thStyle = { padding: '8px 12px', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', textAlign: 'left', borderBottom: '1px solid var(--border)' }
  const tdStyle = { padding: '10px 12px', fontSize: 12, borderBottom: '1px solid rgba(255,255,255,0.04)' }

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

      <Section title="Leagues Management" icon="ti-tournament">
        <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 8, padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>{editing ? 'Edit League' : 'Add New League'}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: 160 }}>
              <Input label="League Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. AUCAA" />
            </div>
            <div style={{ minWidth: 120 }}>
              <Input label="Season" value={form.season} onChange={e => setForm(f => ({ ...f, season: e.target.value }))} placeholder="e.g. 2024-2025" />
            </div>
            <div style={{ minWidth: 120 }}>
              <Select label="Status" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                <option value="upcoming">Upcoming</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
              </Select>
            </div>
            <div style={{ minWidth: 120 }}>
              <Select label="Format" value={form.format} onChange={e => setForm(f => ({ ...f, format: e.target.value }))}>
                <option value="elimination">Elimination</option>
                <option value="round_robin">Round Robin</option>
              </Select>
            </div>
            <div style={{ display: 'flex', gap: 6, paddingBottom: 10 }}>
              <Btn color="orange" onClick={save} style={{ padding: '4px 14px' }}>{editing ? 'Update' : '+ Add'}</Btn>
              {editing && <Btn color="gray" onClick={() => { setEditing(null); setForm({ name: '', season: '', status: 'upcoming', format: 'elimination' }) }}>Cancel</Btn>}
            </div>
          </div>
          {msg && <div style={{ fontSize: 12, color: msg.includes('!') ? '#22c55e' : '#ef4444', marginTop: 6 }}>{msg}</div>}
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>
            <th style={thStyle}>League Name</th>
            <th style={thStyle}>Season</th>
            <th style={thStyle}>Format</th>
            <th style={thStyle}>Status</th>
            <th style={thStyle}>Actions</th>
          </tr></thead>
          <tbody>
            {leagues.map(l => (
              <tr key={l.league_id}>
                <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--text)' }}>{l.name}</td>
                <td style={tdStyle}>{l.season || '—'}</td>
                <td style={tdStyle}><Badge value={l.format === 'round_robin' ? 'Round Robin' : 'Elimination'} /></td>
                <td style={tdStyle}><Badge value={l.status} /></td>
                <td style={tdStyle}>
                  <div style={{ display: 'flex', gap: 5 }}>
                    <Btn color="orange" onClick={() => startEdit(l)}>Edit</Btn>
                    <Btn color="red" onClick={() => handleDeleteLeague(l)}>Delete</Btn>
                  </div>
                </td>
              </tr>
            ))}
            {leagues.length === 0 && <tr><td colSpan={5} style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)' }}>No leagues yet.</td></tr>}
          </tbody>
        </table>
      </Section>
    </>
  )
}

// ══════════════════════════════════════════════════════════════
// SECTION: Teams Management
// ══════════════════════════════════════════════════════════════
function TeamsManagement() {
  const [teams, setTeams] = useState([])
  const [leagues, setLeagues] = useState([])
  const [coaches, setCoaches] = useState([])
  const [form, setForm] = useState({ team_name: '', division: 'Open', league_id: '', coach_id: '' })
  const [editing, setEditing] = useState(null)
  const [msg, setMsg] = useState('')
  const [confirmState, setConfirmState] = useState(null)

  const load = useCallback(async () => {
    try {
      const [teamsResponse, leaguesResponse, coachesResponse] = await Promise.all([
        axios.get('/api/admin/teams'),
        axios.get('/api/leagues'),
        axios.get('/api/admin/coaches')
      ])
      setTeams(teamsResponse.data)
      setLeagues(leaguesResponse.data)
      setCoaches(coachesResponse.data)
      setForm(current => ({ ...current, league_id: current.league_id || leaguesResponse.data[0]?.league_id || '' }))
    } catch (_) {}
  }, [])

  useEffect(() => { load() }, [load])

  const save = async () => {
    if (!form.team_name.trim()) {
      setMsg('Team name is required.')
      return
    }
    if (!form.league_id) {
      setMsg('Please create or select a league first.')
      return
    }
    const payload = { ...form, league_id: Number(form.league_id), coach_id: form.coach_id ? Number(form.coach_id) : null }
    try {
      if (editing) {
        await axios.patch(`/api/admin/teams/${editing}`, payload)
        setEditing(null)
      } else {
        await axios.post('/api/admin/teams', payload)
      }
      setForm({ team_name: '', division: 'Open', league_id: form.league_id, coach_id: '' })
      setMsg(editing ? 'Team updated!' : 'Team created!')
      await load()
      setTimeout(() => setMsg(''), 2000)
    } catch (err) { setMsg(err.response?.data?.message || 'Error saving team.') }
  }

  const startEdit = (t) => {
    setMsg('')
    setEditing(t.team_id)
    setForm({ team_name: t.team_name, division: t.division || 'Open', league_id: t.league_id || '', coach_id: t.coach_id || '' })
  }

  const handleDeleteTeam = (team) => {
    setConfirmState({
      title: 'Delete team',
      message: `Delete "${team.team_name}"? This action cannot be undone.`,
      confirmText: 'Delete',
      tone: 'danger',
      icon: 'ti-trash',
      onConfirm: async () => {
        try {
          await axios.delete(`/api/admin/teams/${team.team_id}`)
          setConfirmState(null)
          load()
        } catch (_) {
          setConfirmState(null)
        }
      },
      onClose: () => setConfirmState(null),
    })
  }

  const thStyle = { padding: '8px 12px', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', textAlign: 'left', borderBottom: '1px solid var(--border)' }
  const tdStyle = { padding: '10px 12px', fontSize: 12, borderBottom: '1px solid rgba(255,255,255,0.04)' }

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

      <Section title="Teams Management" icon="ti-shield">
        <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 8, padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>{editing ? 'Edit Team' : 'Add New Team'}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: 160 }}>
              <Input label="Team Name" value={form.team_name} onChange={e => setForm(f => ({ ...f, team_name: e.target.value }))} placeholder="e.g. Legazpi Lions" />
            </div>
            <div style={{ minWidth: 120 }}>
              <Select label="Division" value={form.division} onChange={e => setForm(f => ({ ...f, division: e.target.value }))}>
                <option value="Open">Open</option>
                <option value="Seniors">Seniors</option>
                <option value="Juniors">Juniors</option>
              </Select>
            </div>
            <div style={{ minWidth: 160 }}>
              <Select label="League" value={form.league_id} onChange={e => setForm(f => ({ ...f, league_id: e.target.value }))}>
                <option value="">Select league...</option>
                {leagues.map(league => <option key={league.league_id} value={league.league_id}>{league.name}{league.season ? ` (${league.season})` : ''}</option>)}
              </Select>
            </div>
            <div style={{ minWidth: 180 }}>
              <Select label="Coach" value={form.coach_id} onChange={e => setForm(f => ({ ...f, coach_id: e.target.value }))}>
                <option value="">Unassigned</option>
                {coaches.map(coach => <option key={coach.id} value={coach.id}>{coach.username} ({coach.email})</option>)}
              </Select>
            </div>
            <div style={{ display: 'flex', gap: 6, paddingBottom: 10 }}>
              <Btn color="orange" onClick={save} style={{ padding: '4px 14px' }}>{editing ? 'Update' : '+ Add'}</Btn>
              {editing && <Btn color="gray" onClick={() => { setEditing(null); setMsg(''); setForm({ team_name: '', division: 'Open', league_id: leagues[0]?.league_id || '', coach_id: '' }) }}>Cancel</Btn>}
            </div>
          </div>
          {msg && <div style={{ fontSize: 12, color: msg.includes('!') ? '#22c55e' : '#ef4444', marginTop: 6 }}>{msg}</div>}
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>
            <th style={thStyle}>Team Name</th>
            <th style={thStyle}>Division</th>
            <th style={thStyle}>Coach</th>
            <th style={thStyle}>Players</th>
            <th style={thStyle}>Actions</th>
          </tr></thead>
          <tbody>
            {teams.map(t => (
              <tr key={t.team_id}>
                <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--text)' }}>{t.team_name}</td>
                <td style={tdStyle}><Badge value={t.division || 'Open'} /></td>
                <td style={{ ...tdStyle, color: t.coach_name ? 'var(--text)' : 'var(--text-muted)' }}>{t.coach_name || 'Unassigned'}</td>
                <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>{t.player_count} players</td>
                <td style={tdStyle}>
                  <div style={{ display: 'flex', gap: 5 }}>
                    <Btn color="orange" onClick={() => startEdit(t)}>Edit</Btn>
                    <Btn color="red" onClick={() => handleDeleteTeam(t)}>Delete</Btn>
                  </div>
                </td>
              </tr>
            ))}
            {teams.length === 0 && <tr><td colSpan={5} style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)' }}>No teams yet.</td></tr>}
          </tbody>
        </table>
      </Section>
    </>
  )
}

// ══════════════════════════════════════════════════════════════
// SECTION: Games Management
// ══════════════════════════════════════════════════════════════
function GamesManagement() {
  const socket = useSocket()
  const navigate = useNavigate()
  const [games, setGames] = useState([])
  const [teams, setTeams] = useState([])
  const [leagues, setLeagues] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ league_id: '', home_team_id: '', away_team_id: '', scheduled_time: '', venue: '', bracket_stage: '' })
  const [liveLinks, setLiveLinks] = useState({})
  const [msg, setMsg] = useState('')
  const [editingGame, setEditingGame] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [savingEdit, setSavingEdit] = useState(false)

  const load = useCallback(async () => {
    try {
      const [gr, tr, lr] = await Promise.all([axios.get('/api/admin/games'), axios.get('/api/admin/teams'), axios.get('/api/leagues')])
      setGames(gr.data)
      setTeams(tr.data)
      setLeagues(lr.data)
      setForm(current => ({ ...current, league_id: current.league_id || lr.data[0]?.league_id || '' }))
      setLiveLinks(Object.fromEntries(gr.data.map(g => [g.game_id, g.live_link || ''])))
    } catch (_) {}
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    socket.on('scheduleUpdated', load)
    return () => socket.off('scheduleUpdated', load)
  }, [socket, load])

  const isValidUrl = (value) => {
    if (!value) return true
    try {
      const url = new URL(value.trim())
      return ['http:', 'https:'].includes(url.protocol)
    } catch (_) {
      return false
    }
  }

  const create = async () => {
    if (!form.league_id || !form.home_team_id || !form.away_team_id || !form.scheduled_time)
      return setMsg('League, teams, and schedule are required.')
    if (form.home_team_id === form.away_team_id)
      return setMsg('Home and away teams must be different.')
    const scheduledDate = new Date(form.scheduled_time)
    if (Number.isNaN(scheduledDate.valueOf()) || scheduledDate < new Date())
      return setMsg('Cannot schedule games in the past. Please choose now or a future time.')
    try {
      await axios.post('/api/admin/games', form)
      setMsg('Game created!'); setShowForm(false)
      setForm({ league_id: form.league_id, home_team_id: '', away_team_id: '', scheduled_time: '', venue: '', bracket_stage: '' })
      load(); setTimeout(() => setMsg(''), 2000)
    } catch (err) { setMsg(err.response?.data?.message || 'Error creating game.') }
  }

  const updateStatus = async (id, status, link) => {
    if (status === 'live' && link && !isValidUrl(link)) {
      setMsg('Invalid live stream URL. Use http:// or https://.')
      return
    }
    try {
      await axios.patch(`/api/admin/games/${id}/status`, { status, link })
      load()
    } catch (err) {
      setMsg(err?.response?.data?.message || 'Failed to update game status.')
    }
  }

  const [confirmState, setConfirmState] = useState(null)

  const deleteGame = async (game) => {
    setConfirmState({
      title: 'Delete game',
      message: `Delete "${game.home_team_name} vs ${game.away_team_name}"? This action cannot be undone.`,
      confirmText: 'Delete',
      tone: 'danger',
      icon: 'ti-trash',
      onConfirm: async () => {
        try {
          await axios.delete(`/api/admin/games/${game.game_id}`)
          setConfirmState(null)
          setMsg('Game deleted successfully!')
          load()
          setTimeout(() => setMsg(''), 2000)
        } catch (err) {
          const errorMsg = err?.response?.data?.message || 'Failed to delete game.'
          setMsg(errorMsg)
          console.error('[Delete Game Error]', err)
          setConfirmState(null)
        }
      },
      onClose: () => setConfirmState(null),
    })
  }

  const openEditGame = (game) => {
    setEditingGame(game)
    setEditForm({
      home_team_id: game.home_team_id,
      away_team_id: game.away_team_id,
      scheduled_time: game.scheduled_time ? new Date(game.scheduled_time).toISOString().slice(0, 16) : '',
      venue: game.venue || '',
      bracket_stage: game.bracket_stage || ''
    })
  }

  useEffect(() => {
    const editGameId = new URLSearchParams(window.location.search).get('editGame')
    if (!editGameId || !games.length || editingGame) return
    const game = games.find(item => String(item.game_id) === editGameId)
    if (game) openEditGame(game)
  }, [games, editingGame])

  const saveEditGame = async () => {
    if (!editingGame) {
      setMsg('No game selected.')
      return
    }

    const currentStage = editingGame.bracket_stage || ''
    const currentScheduledTime = editingGame.scheduled_time ? new Date(editingGame.scheduled_time).toISOString().slice(0, 16) : ''
    const hasChanges = (
      editForm.home_team_id !== editingGame.home_team_id ||
      editForm.away_team_id !== editingGame.away_team_id ||
      editForm.scheduled_time !== currentScheduledTime ||
      editForm.venue !== (editingGame.venue || '') ||
      editForm.bracket_stage !== currentStage
    )
    const shouldReturnToAnnouncements = new URLSearchParams(window.location.search).has('editGame')

    if (!hasChanges) {
      setMsg('No changes to save.')
      if (shouldReturnToAnnouncements) navigate('/announcements')
      return
    }

    setSavingEdit(true)
    try {
      const payload = {
        home_team_id: editForm.home_team_id,
        away_team_id: editForm.away_team_id,
        scheduled_time: editForm.scheduled_time,
        venue: editForm.venue,
        bracket_stage: editForm.bracket_stage || null
      }
      await axios.patch(`/api/admin/games/${editingGame.game_id}`, payload)
      setMsg('Game updated!')
      setEditingGame(null)
      load()
      if (shouldReturnToAnnouncements) {
        navigate('/announcements')
        return
      }
      setTimeout(() => setMsg(''), 2000)
    } catch (err) {
      setMsg(err.response?.data?.message || 'Failed to update game.')
    } finally {
      setSavingEdit(false)
    }
  }

  const thStyle = { padding: '8px 12px', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', textAlign: 'left', borderBottom: '1px solid var(--border)' }
  const tdStyle = { padding: '10px 12px', fontSize: 12, borderBottom: '1px solid rgba(255,255,255,0.04)', verticalAlign: 'middle' }

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

      <Section title="Games Management" icon="ti-ball-basketball" action={
        <Btn color="orange" onClick={() => setShowForm(s => !s)} style={{ padding: '4px 14px' }}>
          {showForm ? 'Cancel' : '+ Add Game'}
        </Btn>
      }>
      {showForm && (
        <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 8, padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>Schedule New Game</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Select label="League *" value={form.league_id} onChange={e => setForm(f => ({ ...f, league_id: e.target.value, home_team_id: '', away_team_id: '' }))}>
              <option value="">Select league</option>
              {leagues.map(league => <option key={league.league_id} value={league.league_id}>{league.name}{league.season ? ` (${league.season})` : ''}</option>)}
            </Select>
            <Select label="Home Team *" value={form.home_team_id} onChange={e => setForm(f => ({ ...f, home_team_id: e.target.value }))}>
              <option value="">Select home team</option>
              {teams.filter(t => String(t.league_id) === String(form.league_id)).map(t => <option key={t.team_id} value={t.team_id}>{t.team_name}</option>)}
            </Select>
            <Select label="Away Team *" value={form.away_team_id} onChange={e => setForm(f => ({ ...f, away_team_id: e.target.value }))}>
              <option value="">Select away team</option>
              {teams.filter(t => String(t.league_id) === String(form.league_id)).map(t => <option key={t.team_id} value={t.team_id}>{t.team_name}</option>)}
            </Select>
            <Input label="Date & Time *" type="datetime-local" value={form.scheduled_time} onChange={e => setForm(f => ({ ...f, scheduled_time: e.target.value }))} />
            <Input label="Venue" value={form.venue} onChange={e => setForm(f => ({ ...f, venue: e.target.value }))} placeholder="e.g. Legazpi City Sports Complex" />
            <Select label="Bracket Stage" value={form.bracket_stage} onChange={e => setForm(f => ({ ...f, bracket_stage: e.target.value }))}>
              <option value="">Select stage (optional)</option>
              <option value="quarterfinal">Quarterfinal</option>
              <option value="semifinal">Semifinal</option>
              <option value="final">Final</option>
              <option value="third_place">Third Place</option>
            </Select>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <Btn color="orange" onClick={create} style={{ padding: '6px 18px' }}>Create Game</Btn>
          </div>
          {msg && <div style={{ fontSize: 12, color: msg.includes('!') ? '#22c55e' : '#ef4444', marginTop: 6 }}>{msg}</div>}
        </div>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>
          <th style={thStyle}>Matchup</th>
          <th style={thStyle}>League</th>
          <th style={thStyle}>Score</th>
          <th style={thStyle}>Stage</th>
          <th style={thStyle}>Status</th>
          <th style={thStyle}>Schedule</th>
          <th style={thStyle}>Venue</th>
          <th style={thStyle}>Actions</th>
        </tr></thead>
        <tbody>
          {games.map(g => (
            <tr key={g.game_id}>
              <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--text)' }}>
                {g.home_team_name} <span style={{ color: 'var(--text-muted)' }}>vs</span> {g.away_team_name}
              </td>
              <td style={{ ...tdStyle, color: 'var(--text-muted)', fontSize: 11 }}>{g.league_name || '—'}</td>
              <td style={{ ...tdStyle, fontFamily: 'monospace', color: 'var(--orange)', fontWeight: 700 }}>
                {g.home_score} — {g.away_score}
              </td>
              <td style={tdStyle}><Badge value={g.status} /></td>
              <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>
                {new Date(g.scheduled_time).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </td>
              <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>{g.bracket_stage ? g.bracket_stage.replace('_', ' ') : '—'}</td>
              <td style={{ ...tdStyle, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{g.status}</td>
              <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {g.status !== 'live' && (
                    <input
                      value={liveLinks[g.game_id] || ''}
                      onChange={e => setLiveLinks(prev => ({ ...prev, [g.game_id]: e.target.value }))}
                      placeholder="Live stream URL (optional)"
                      style={{ width: '100%', minWidth: 180, padding: '8px 10px', fontSize: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-panel)', color: 'var(--text)' }}
                    />
                  )}
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {g.status !== 'live' && <Btn color="red" onClick={() => updateStatus(g.game_id, 'live', liveLinks[g.game_id])}>Go Live</Btn>}
                    <Btn color="gray" onClick={() => deleteGame(g)}>Delete</Btn>
                  </div>
                </div>
              </td>
            </tr>
          ))}
          {games.length === 0 && <tr><td colSpan={8} style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)' }}>No games yet.</td></tr>}
        </tbody>
      </table>

      {editingGame && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }} onClick={(event) => {
          if (event.target !== event.currentTarget) return
          setEditingGame(null)
          navigate('/announcements')
        }}>
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14,
            width: '100%', maxWidth: 500, padding: 28
          }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>Edit Game</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Home Team</label>
                <select value={editForm.home_team_id} onChange={e => setEditForm(f => ({...f, home_team_id: e.target.value}))} style={{ width: '100%', padding: '8px 10px' }}>
                  <option value="">Select home team</option>
                  {teams.map(t => <option key={t.team_id} value={t.team_id}>{t.team_name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Away Team</label>
                <select value={editForm.away_team_id} onChange={e => setEditForm(f => ({...f, away_team_id: e.target.value}))} style={{ width: '100%', padding: '8px 10px' }}>
                  <option value="">Select away team</option>
                  {teams.map(t => <option key={t.team_id} value={t.team_id}>{t.team_name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Date & Time</label>
                <input type="datetime-local" value={editForm.scheduled_time} onChange={e => setEditForm(f => ({...f, scheduled_time: e.target.value}))} style={{ width: '100%', padding: '8px 10px' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Venue</label>
                <input type="text" value={editForm.venue} onChange={e => setEditForm(f => ({...f, venue: e.target.value}))} placeholder="e.g. Legazpi City Sports Complex" style={{ width: '100%', padding: '8px 10px' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Bracket Stage</label>
                <select value={editForm.bracket_stage} onChange={e => setEditForm(f => ({...f, bracket_stage: e.target.value}))} style={{ width: '100%', padding: '8px 10px' }}>
                  <option value="">Select stage (optional)</option>
                  <option value="quarterfinal">Quarterfinal</option>
                  <option value="semifinal">Semifinal</option>
                  <option value="final">Final</option>
                  <option value="third_place">Third Place</option>
                </select>
              </div>
            </div>
            {msg && <div style={{ fontSize: 12, color: msg.includes('!') || msg.includes('updated') ? '#22c55e' : '#ef4444', marginBottom: 12 }}>{msg}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn color="orange" onClick={saveEditGame} disabled={savingEdit} style={{ padding: '8px 16px', flex: 1 }}>{savingEdit ? 'Saving...' : 'Save'}</Btn>
              <Btn color="gray" onClick={() => {
                setEditingGame(null)
                setMsg('')
                if (new URLSearchParams(window.location.search).has('editGame')) navigate('/announcements')
              }} style={{ padding: '8px 16px' }}>Cancel</Btn>
            </div>
          </div>
        </div>
      )}
      </Section>
    </>
  )
}

// ══════════════════════════════════════════════════════════════
// MAIN ADMIN PAGE
// ══════════════════════════════════════════════════════════════
export default function Admin() {
  const { user } = useAuth()
  const socket = useSocket()
  const [stats, setStats] = useState(null)
  const [activeTab, setActiveTab] = useState(() => {
    const requestedTab = new URLSearchParams(window.location.search).get('tab') || 'dashboard'
    return user?.role === 'admin' || requestedTab !== 'highlights' ? requestedTab : 'dashboard'
  })

  const refreshDashboard = useCallback(() => {
    axios.get('/api/admin/dashboard')
      .then(r => setStats(r.data))
      .catch(() => {})
  }, [])

  useEffect(() => {
    refreshDashboard()
  }, [refreshDashboard])

  useEffect(() => {
    const refreshVerification = () => refreshDashboard()
    socket.on('verificationUpdated', refreshVerification)
    return () => socket.off('verificationUpdated', refreshVerification)
  }, [socket, refreshDashboard])

  useEffect(() => {
    socket.on('scheduleUpdated', refreshDashboard)
    return () => socket.off('scheduleUpdated', refreshDashboard)
  }, [socket, refreshDashboard])

  // Only admin and league_manager can access
  if (!user || (user.role !== 'admin' && user.role !== 'league_manager')) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: 'var(--text-muted)' }}>
        <i className="ti ti-lock" style={{ fontSize: 40, color: 'var(--orange)' }} />
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>Access Denied</div>
        <div style={{ fontSize: 13 }}>Admin or League Manager role required.</div>
      </div>
    )
  }

  const tabs = [
    { key: 'dashboard',     label: 'Dashboard',     icon: 'ti-layout-dashboard' },
    { key: 'users',         label: 'Users',          icon: 'ti-users' },
    { key: 'verification',  label: 'Verification',   icon: 'ti-shield-check' },
    { key: 'regcodes',      label: 'Reg Codes',      icon: 'ti-key' },
    { key: 'leagues',       label: 'Leagues',        icon: 'ti-tournament' },
    { key: 'teams',         label: 'Teams',          icon: 'ti-shield' },
    { key: 'games',         label: 'Games',          icon: 'ti-ball-basketball' },
    { key: 'live-stats',    label: 'Live Stats',     icon: 'ti-live-view' },
    ...(user?.role === 'admin' ? [{ key: 'highlights', label: 'Highlights', icon: 'ti-brand-youtube' }] : []),
  ]

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      {/* Admin sidebar tabs */}
      <div style={{ width: 180, background: 'var(--bg-card)', borderRight: '1px solid var(--border)', padding: '12px 0', flexShrink: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', padding: '0 16px 10px' }}>
          {user?.role === 'league_manager' ? 'My League' : 'Admin Panel'}
        </div>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
            display: 'flex', alignItems: 'center', gap: 8, width: '100%',
            padding: '8px 16px', fontSize: 12, fontWeight: 500, border: 'none', cursor: 'pointer',
            background: activeTab === t.key ? 'var(--orange-glow)' : 'transparent',
            color: activeTab === t.key ? 'var(--orange)' : 'var(--text-muted)',
            borderLeft: activeTab === t.key ? '2px solid var(--orange)' : '2px solid transparent',
            transition: 'all 0.12s', textAlign: 'left'
          }}>
            <i className={`ti ${t.icon}`} style={{ fontSize: 15 }} />{t.label}
            {t.key === 'verification' && stats?.pending_users > 0 && (
              <span style={{ marginLeft: 'auto', minWidth: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#ef4444', color: '#fff', borderRadius: 999, fontSize: 9, fontWeight: 700, padding: '0 5px', boxSizing: 'border-box' }}>
                {stats.pending_users}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Main content */}
      <div style={{ flex: 1, padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

        {/* Dashboard */}
        {activeTab === 'dashboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>
              {user?.role === 'league_manager' ? 'Dashboard' : <>Admin <span style={{ color: 'var(--orange)' }}>Dashboard</span></>}
            </div>
            {stats ? (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'stretch', flex: 1, minHeight: 0, gap: 10, marginBottom: 0 }}>
                  <StatCard label="Total Users"   value={stats.total_users}   icon="ti-users"            color="var(--orange)" />
                  <StatCard label="Teams"          value={stats.total_teams}   icon="ti-shield"           color="#38bdf8" />
                  <StatCard label="Players"        value={stats.total_players} icon="ti-run"              color="#4ade80" />
                  <StatCard label="Games"          value={stats.total_games}   icon="ti-ball-basketball"  color="#a78bfa" />
                  <StatCard label="Live Now"       value={stats.live_games}    icon="ti-live-view"        color="#ef4444" alert={stats.live_games > 0} />
                  {user?.role === 'admin' && <StatCard label="Pending Accounts" value={stats.pending_users} icon="ti-clock" color="#f59e0b" alert={stats.pending_users > 0} />}
                  <StatCard label="Active Codes"   value={stats.active_codes}  icon="ti-key"              color="#22c55e" />
                </div>
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginTop: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>Quick Actions</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {user?.role === 'admin' && <Btn color="orange" onClick={() => setActiveTab('verification')} style={{ padding: '6px 16px', fontSize: 12 }}>
                        Review Pending Accounts ({stats.pending_users})
                      </Btn>}
                    <Btn color="gray" onClick={() => setActiveTab('regcodes')} style={{ padding: '6px 16px', fontSize: 12 }}>
                      Manage Reg Codes
                    </Btn>
                    <Btn color="gray" onClick={() => setActiveTab('games')} style={{ padding: '6px 16px', fontSize: 12 }}>
                      Schedule a Game
                    </Btn>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ color: 'var(--text-muted)' }}>Loading dashboard...</div>
            )}
          </div>
        )}

        {activeTab === 'users'          && <UserManagement onUserChanged={refreshDashboard} />}
        {activeTab === 'verification'   && <CoachVerification onUserChanged={refreshDashboard} />}
        {activeTab === 'regcodes'       && <RegCodes />}
        {activeTab === 'leagues'        && <LeaguesManagement />}
        {activeTab === 'teams'          && <TeamsManagement />}
        {activeTab === 'games'          && <GamesManagement />}
        {activeTab === 'live-stats'     && <LiveScoreboard />}
        {activeTab === 'highlights'     && <HighlightManagement />}
      </div>
    </div>
  )
}

// ── Highlights Management (admin) ─────────────────────────
function HighlightManagement() {
  const [link, setLink] = useState('')
  const [title, setTitle] = useState('')
  const [image, setImage] = useState('')
  const [uploading, setUploading] = useState(false)
  const [msg, setMsg] = useState('')
  const [saving, setSaving] = useState(false)

  const load = async () => {
    try {
      const token = sessionStorage.getItem('aucaa_token')
      const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {}
      const r = await axios.get('/api/admin/highlight-link', config)
      setLink(r.data.link || '')
      setTitle(r.data.title || '')
      setImage(r.data.image || '')
    } catch (err) {
      console.error('Failed to load highlight link', err)
    }
  }

  const uploadImage = async (file) => {
    if (!file) return
    setUploading(true)
    try {
      const token = sessionStorage.getItem('aucaa_token')
      const formData = new FormData()
      formData.append('image', file)
      const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {}
      const res = await axios.post('/api/admin/highlight-image', formData, config)
      setImage(res.data.image)
      setMsg('Image uploaded successfully!')
      setTimeout(() => setMsg(''), 2500)
    } catch (err) {
      const message = err?.response?.data?.message || err.message || 'Failed to upload image.'
      setMsg(message)
      console.error('Highlight image upload failed', err)
    } finally {
      setUploading(false)
    }
  }

  useEffect(() => { load() }, [])

  const save = async () => {
    setSaving(true)
    try {
      const token = sessionStorage.getItem('aucaa_token')
      const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {}
      await axios.post('/api/admin/highlight-link', {
        link: link || null,
        title: title || null,
        image: image || null
      }, config)
      await load()
      setMsg('Saved!')
      setTimeout(() => setMsg(''), 2500)
    } catch (err) {
      const message = err?.response?.data?.message || err.message || 'Failed to save.'
      setMsg(message)
      console.error('Highlight save failed', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Section title="Highlights" icon="ti-brand-youtube" action={
      <div style={{ display: 'flex', gap: 8 }}>
        <Btn color="orange" onClick={save} style={{ opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Saving...' : 'Save'}
        </Btn>
      </div>
    }>
      <div style={{ display: 'grid', gap: 10 }}>
        <Input label="Title (optional)" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Congrats Naga Knights" />
        <div style={{ display: 'grid', gap: 6 }}>
          <label style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Highlight Image</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
            <label style={{ padding: '10px 14px', background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 8, cursor: uploading ? 'not-allowed' : 'pointer', color: uploading ? 'var(--text-muted)' : 'var(--text)' }}>
              <input type="file" accept="image/*" disabled={uploading} style={{ display: 'none' }} onChange={e => uploadImage(e.target.files?.[0])} />
              {uploading ? 'Uploading...' : 'Choose image from PC'}
            </label>
            {image && (
              <img src={image} alt="Highlight preview" style={{ width: 120, height: 80, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} />
            )}
          </div>
        </div>
        <Input label="External Link (YouTube/Facebook)" value={link} onChange={e => setLink(e.target.value)} placeholder="https://youtube.com/..." />
        {msg && <div style={{ fontSize: 12, color: msg.includes('Saved') ? '#22c55e' : '#ef4444' }}>{msg}</div>}
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Set the live stream title and optional image preview for the Highlights page. Use the link to send fans directly to the broadcast.</div>
      </div>
    </Section>
  )
}