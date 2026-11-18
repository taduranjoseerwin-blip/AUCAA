import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'

// ── Reusable Styles ──────────────────────────────────────────
const btnStyles = {
  green:  { bg: '#22c55e', text: '#000' },
  orange: { bg: '#f97316', text: '#000' },
  red:    { bg: '#ef4444', text: '#fff' },
  gray:   { bg: 'rgba(255,255,255,0.1)', text: '#fff' },
  blue:   { bg: '#3b82f6', text: '#fff' }
}

function Btn({ color = 'gray', onClick, style, children, disabled = false, type = 'button' }) {
  const c = btnStyles[color] || btnStyles.gray
  return (
    <button onClick={onClick} style={{
      background: c.bg, color: c.text, cursor: disabled ? 'not-allowed' : 'pointer', padding: '6px 12px',
      fontSize: 12, border: 'none', borderRadius: 6, fontWeight: 600, opacity: disabled ? 0.6 : 1, ...style
    }} disabled={disabled} type={type}>{children}</button>
  )
}

function Badge({ value }) {
  const styles = {
    verified: { bg: 'rgba(34,197,94,0.15)', color: '#22c55e' },
    pending:  { bg: 'rgba(249,115,22,0.15)', color: '#f97316' },
    rejected: { bg: 'rgba(239,68,68,0.15)', color: '#ef4444' },
  }
  const s = styles[value] || styles.pending
  return (
    <div style={{
      display: 'inline-block', background: s.bg, color: s.color,
      padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600, textTransform: 'capitalize'
    }}>{value}</div>
  )
}

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

// ── Main Coach Dashboard ─────────────────────────────────────
export default function Coach() {
  const [teams, setTeams] = useState([])
  const [activeTab, setActiveTab] = useState('verification')
  const [regCodesView, setRegCodesView] = useState('codes')
  const [playerVerifications, setPlayerVerifications] = useState([])
  const [verificationFilter, setVerificationFilter] = useState('pending')
  const [verificationTeamFilter, setVerificationTeamFilter] = useState('all')
  const [verificationMsg, setVerificationMsg] = useState('')
  const [loadingVerifications, setLoadingVerifications] = useState(false)
  const [loading, setLoading] = useState(true)
  const [playerCodes, setPlayerCodes] = useState([])
  const [codeMsg, setCodeMsg] = useState('')
  const [creatingCode, setCreatingCode] = useState(false)
  const [editingPlayer, setEditingPlayer] = useState(null)
  const [editPlayerForm, setEditPlayerForm] = useState({})
  const [savingPlayer, setSavingPlayer] = useState(false)
  const [playerEditMsg, setPlayerEditMsg] = useState('')

  // Load coach's teams
  const loadTeams = useCallback(async () => {
    setLoading(true)
    try {
      const r = await axios.get('/api/coach/teams')
      setTeams(r.data)
    } catch (err) {
      setVerificationMsg('Failed to load teams.')
      console.error(err)
    }
    setLoading(false)
  }, [])

  const loadPlayerVerifications = useCallback(async () => {
    setLoadingVerifications(true)
    try {
      const response = await axios.get('/api/coach/verifications')
      setPlayerVerifications(response.data || [])
    } catch (err) {
      setVerificationMsg(err.response?.data?.message || 'Failed to load player verifications.')
    } finally {
      setLoadingVerifications(false)
    }
  }, [])

  useEffect(() => {
    loadTeams()
  }, [loadTeams])

  useEffect(() => {
    loadPlayerVerifications()
  }, [loadPlayerVerifications])

  useEffect(() => {
    axios.get('/api/coach/regcodes').then(r => setPlayerCodes(r.data || [])).catch(() => {})
  }, [])

  const createPlayerCode = async () => {
    const code = `AUCAA-PLAYER-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
    setCreatingCode(true)
    setCodeMsg('')
    try {
      await axios.post('/api/coach/regcodes', { code })
      const r = await axios.get('/api/coach/regcodes')
      setPlayerCodes(r.data || [])
      setCodeMsg(`Created ${code}. Share it with the player to register.`)
    } catch (err) {
      setCodeMsg(err.response?.data?.message || 'Failed to create player code.')
    } finally {
      setCreatingCode(false)
    }
  }

  const copyPlayerCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code)
      setCodeMsg(`${code} copied.`)
    } catch {
      setCodeMsg('Could not copy the code. Select and copy it manually.')
    }
  }

  const verifyPlayer = async (player, status) => {
    setVerificationMsg('')
    try {
      const response = await axios.patch(`/api/coach/verifications/${player.player_id}`, {
        status,
      })
      const emailWarning = ['verified', 'rejected'].includes(status) && response.data.notification_email_sent === false
        ? ' Email could not be delivered.'
        : ''
      setVerificationMsg(`${response.data.message}${emailWarning}`)
      await Promise.all([loadPlayerVerifications(), loadTeams()])
    } catch (err) {
      setVerificationMsg(err.response?.data?.message || 'Failed to update player verification.')
    }
  }

  const deletePlayerCode = async (code) => {
    try {
      await axios.delete(`/api/coach/regcodes/${code.id}`)
      setPlayerCodes(current => current.filter(item => item.id !== code.id))
      setCodeMsg(`Deleted ${code.code}.`)
    } catch (err) {
      setCodeMsg(err.response?.data?.message || 'Failed to delete player code.')
    }
  }

  const startEditPlayer = (player) => {
    setEditingPlayer(player)
    setPlayerEditMsg('')
    setEditPlayerForm({
      name: player.name || '',
      student_id: player.student_id || '',
      jersey_number: player.jersey_number ?? '',
      position: player.position || '',
      date_of_birth: player.date_of_birth ? String(player.date_of_birth).slice(0, 10) : '',
      height: player.height || '',
      weight: player.weight || '',
      barangay: player.barangay || '',
      team_id: player.team_id || '',
    })
  }

  const savePlayer = async (event) => {
    event.preventDefault()
    setSavingPlayer(true)
    setPlayerEditMsg('')
    try {
      await axios.patch(`/api/coach/players/${editingPlayer.player_id}`, {
        ...editPlayerForm,
        team_id: editPlayerForm.team_id || null,
        jersey_number: editPlayerForm.jersey_number || null,
        date_of_birth: editPlayerForm.date_of_birth || null,
      })
      await loadPlayerVerifications()
      setEditingPlayer(null)
    } catch (err) {
      setPlayerEditMsg(err.response?.data?.message || 'Failed to update player.')
    } finally {
      setSavingPlayer(false)
    }
  }

  const getAccountStatus = (player) => player.account_status === 'approved'
    ? 'verified'
    : player.account_status === 'rejected' ? 'rejected' : 'pending'
  const filteredVerifications = playerVerifications.filter(player =>
    (verificationFilter === 'all' || getAccountStatus(player) === verificationFilter) &&
    (verificationTeamFilter === 'all' || String(player.team_id || '') === verificationTeamFilter)
  )
  const filteredPlayers = playerVerifications
  const emptyPlayersMessage = verificationFilter === 'all'
    ? 'No players registered with your codes yet.'
    : `No ${verificationFilter} players to show.`
  const emptyDirectoryMessage = 'No players under your management yet.'
  const pendingVerificationCount = playerVerifications.filter(player => getAccountStatus(player) === 'pending').length
  const thStyle = { padding: '8px 12px', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', textAlign: 'left', borderBottom: '1px solid var(--border)' }
  const tdStyle = { padding: '10px 12px', fontSize: 12, borderBottom: '1px solid rgba(255,255,255,0.04)' }
  const codeActionStyle = { width: 72, height: 30, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', whiteSpace: 'nowrap' }
  const copyActionStyle = { ...codeActionStyle, background: 'var(--bg-panel)', color: 'var(--text-muted)', border: '1px solid var(--border)' }
  const deleteActionStyle = { ...codeActionStyle, background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }

  return (
    <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      <aside style={{ width: 180, background: 'var(--bg-card)', borderRight: '1px solid var(--border)', padding: '12px 0', flexShrink: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', padding: '0 16px 10px' }}>
          My Team
        </div>
        <div role="tablist" aria-label="My Team sections">
          {[{ id: 'teams', label: 'Teams' }, { id: 'verification', label: 'Pending Players' }, { id: 'regcodes', label: 'Reg Codes' }].map(tab => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                padding: '8px 16px', fontSize: 12, fontWeight: 500, border: 'none', cursor: 'pointer',
                background: activeTab === tab.id ? 'var(--orange-glow)' : 'transparent',
                color: activeTab === tab.id ? 'var(--orange)' : 'var(--text-muted)',
                borderLeft: activeTab === tab.id ? '2px solid var(--orange)' : '2px solid transparent',
                textAlign: 'left'
              }}
            >
              {tab.label}
              {tab.id === 'verification' && pendingVerificationCount > 0 && (
                <span style={{ marginLeft: 'auto', minWidth: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#ef4444', color: '#fff', borderRadius: 999, fontSize: 9, fontWeight: 700, padding: '0 5px', boxSizing: 'border-box' }}>
                  {pendingVerificationCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </aside>

      <main style={{ flex: 1, minWidth: 0, padding: 20, overflowY: 'auto' }}>
        {activeTab === 'teams' && (
          <Section title="Teams Under Your Management" icon="ti-shield">
            {loading ? (
              <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>Loading teams...</div>
            ) : teams.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>No teams have been assigned to you yet.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>
                    <th style={thStyle}>Team</th>
                    <th style={thStyle}>League</th>
                    <th style={thStyle}>Season</th>
                    <th style={thStyle}>Division</th>
                    <th style={thStyle}>Players</th>
                  </tr></thead>
                  <tbody>
                    {teams.map(team => (
                      <tr key={team.team_id}>
                        <td style={{ ...tdStyle, fontWeight: 700, color: 'var(--text)' }}>{team.team_name}</td>
                        <td style={{ ...tdStyle, color: 'var(--text)' }}>{team.league_name || '—'}</td>
                        <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>{team.season || '—'}</td>
                        <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>{team.division || 'Open'}</td>
                        <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>{team.roster_count || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        )}

        {activeTab === 'verification' && (
          <Section title="Pending Players" icon="ti-user-check" action={
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {['pending', 'verified', 'rejected', 'all'].map(filter => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setVerificationFilter(filter)}
                  style={{
                    padding: '3px 10px', fontSize: 11, fontWeight: 600, borderRadius: 4,
                    background: verificationFilter === filter ? 'var(--orange)' : 'var(--bg-panel)',
                    color: verificationFilter === filter ? '#fff' : 'var(--text-muted)',
                    border: '1px solid var(--border)', cursor: 'pointer', textTransform: 'capitalize'
                  }}
                >{filter}</button>
              ))}
            </div>
          }>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              <label htmlFor="verification-team-filter" style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>Filter by assigned team</label>
              <select
                id="verification-team-filter"
                value={verificationTeamFilter}
                onChange={event => setVerificationTeamFilter(event.target.value)}
                disabled={loading}
                style={{ minWidth: 220, padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-panel)', color: 'var(--text)' }}
              >
                <option value="all">All teams</option>
                <option value="">Unassigned</option>
                {teams.map(team => <option key={team.team_id} value={team.team_id}>{team.team_name}</option>)}
              </select>
            </div>
            {verificationMsg && <div role="status" style={{ marginBottom: 12, fontSize: 12, color: verificationMsg.includes('Failed') || verificationMsg.includes('could not') ? '#ef4444' : '#22c55e' }}>{verificationMsg}</div>}
            {loadingVerifications ? (
              <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>Loading players...</div>
            ) : filteredVerifications.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>{emptyPlayersMessage}</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
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
                    <th style={thStyle}>Account Status</th>
                    <th style={thStyle}>Actions</th>
                  </tr></thead>
                  <tbody>
                    {filteredVerifications.map(player => (
                      <tr key={player.player_id}>
                        <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--text)' }}>{player.username || player.name}</td>
                        <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>{player.jersey_number ? `#${player.jersey_number}` : '—'}</td>
                        <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>{player.position || '—'}</td>
                        <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>{player.date_of_birth ? new Date(`${String(player.date_of_birth).slice(0, 10)}T00:00:00`).toLocaleDateString('en-PH') : '—'}</td>
                        <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>{player.height || '—'}</td>
                        <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>{player.weight || '—'}</td>
                        <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>{player.barangay || '—'}</td>
                        <td style={{ ...tdStyle, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{player.student_id || '—'}</td>
                        <td style={tdStyle}><Badge value={getAccountStatus(player)} /></td>
                        <td style={tdStyle}>
                          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                            {getAccountStatus(player) === 'pending' && <>
                              <Btn color="green" onClick={() => verifyPlayer(player, 'verified')}>✓ Verify</Btn>
                              <Btn color="red" onClick={() => verifyPlayer(player, 'rejected')}>✗ Reject</Btn>
                            </>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        )}

        {activeTab === 'regcodes' && <div role="tablist" aria-label="Registration code sections" style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
          {[{ id: 'codes', label: 'Players Registration Codes' }, { id: 'players', label: 'Players' }].map(tab => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={regCodesView === tab.id}
              onClick={() => setRegCodesView(tab.id)}
              style={{
                padding: '10px 16px', border: 'none', borderBottom: regCodesView === tab.id ? '2px solid var(--orange)' : '2px solid transparent',
                background: 'transparent', color: regCodesView === tab.id ? 'var(--orange)' : 'var(--text-muted)',
                fontSize: 13, fontWeight: 700, cursor: 'pointer'
              }}
            >
              {tab.label}
              {tab.id === 'players' && pendingVerificationCount > 0 && (
                <span style={{ marginLeft: 6, background: '#ef4444', color: '#fff', borderRadius: 10, fontSize: 9, fontWeight: 700, padding: '1px 6px' }}>
                  {pendingVerificationCount}
                </span>
              )}
            </button>
          ))}
        </div>}

      {activeTab === 'regcodes' && regCodesView === 'codes' && (
        <Section
          title="Player Registration Codes"
          icon="ti-key"
          action={<Btn color="orange" onClick={createPlayerCode} disabled={creatingCode}>{creatingCode ? 'Creating...' : 'Generate player code'}</Btn>}
        >
          <p style={{ margin: '0 0 14px', fontSize: 12, color: 'var(--text-muted)' }}>
            These codes can only be used to register player accounts.
          </p>
          {codeMsg && <div role="status" style={{ marginBottom: 12, fontSize: 12, color: codeMsg.startsWith('Created') || codeMsg.startsWith('Deleted') || codeMsg.endsWith('copied.') ? '#22c55e' : '#ef4444' }}>{codeMsg}</div>}
          {playerCodes.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>No player codes yet.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>
                  <th style={thStyle}>Code</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Created</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
                </tr></thead>
                <tbody>
                  {playerCodes.map(code => (
                    <tr key={code.id}>
                      <td style={{ ...tdStyle, fontFamily: 'monospace', color: 'var(--text)' }}>{code.code}</td>
                      <td style={{ ...tdStyle, color: code.used ? 'var(--text-muted)' : '#22c55e', fontWeight: 600 }}>{code.used ? 'Used' : 'Unused'}</td>
                      <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>{code.created_at ? new Date(code.created_at).toLocaleDateString() : '—'}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                          <Btn color="gray" onClick={() => copyPlayerCode(code.code)} style={copyActionStyle}>Copy</Btn>
                          <Btn color="red" onClick={() => deletePlayerCode(code)} style={deleteActionStyle}>Delete</Btn>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      )}

      {activeTab === 'regcodes' && regCodesView === 'players' && <>
      {loading && <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>Loading...</div>}

      <Section title="Players Under Your Management" icon="ti-user-check">
        {editingPlayer && (
          <form onSubmit={savePlayer} style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 8, padding: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>Edit Player Bio</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(130px, 1fr))', gap: 8 }}>
              <label style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700 }}>NAME<input value={editPlayerForm.name} onChange={event => setEditPlayerForm(form => ({ ...form, name: event.target.value }))} style={{ width: '100%', fontSize: 12, marginTop: 3 }} /></label>
              <label style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700 }}>STUDENT ID<input value={editPlayerForm.student_id} onChange={event => setEditPlayerForm(form => ({ ...form, student_id: event.target.value }))} style={{ width: '100%', fontSize: 12, marginTop: 3 }} /></label>
              <label style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700 }}>JERSEY<input value={editPlayerForm.jersey_number} onChange={event => setEditPlayerForm(form => ({ ...form, jersey_number: event.target.value.replace(/\D/g, '') }))} style={{ width: '100%', fontSize: 12, marginTop: 3 }} /></label>
              <label style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700 }}>POSITION<input value={editPlayerForm.position} onChange={event => setEditPlayerForm(form => ({ ...form, position: event.target.value }))} style={{ width: '100%', fontSize: 12, marginTop: 3 }} /></label>
              <label style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700 }}>DATE OF BIRTH<input type="date" value={editPlayerForm.date_of_birth} onChange={event => setEditPlayerForm(form => ({ ...form, date_of_birth: event.target.value }))} style={{ width: '100%', fontSize: 12, marginTop: 3 }} /></label>
              <label style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700 }}>BARANGAY<input value={editPlayerForm.barangay} onChange={event => setEditPlayerForm(form => ({ ...form, barangay: event.target.value }))} style={{ width: '100%', fontSize: 12, marginTop: 3 }} /></label>
              <label style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700 }}>HEIGHT<input value={editPlayerForm.height} onChange={event => setEditPlayerForm(form => ({ ...form, height: event.target.value }))} style={{ width: '100%', fontSize: 12, marginTop: 3 }} /></label>
              <label style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700 }}>WEIGHT<input value={editPlayerForm.weight} onChange={event => setEditPlayerForm(form => ({ ...form, weight: event.target.value }))} style={{ width: '100%', fontSize: 12, marginTop: 3 }} /></label>
              <label style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700 }}>ASSIGNED TEAM<select value={editPlayerForm.team_id} onChange={event => setEditPlayerForm(form => ({ ...form, team_id: event.target.value }))} style={{ width: '100%', fontSize: 12, marginTop: 3 }}><option value="">Unassigned</option>{teams.map(team => <option key={team.team_id} value={team.team_id}>{team.team_name}</option>)}</select></label>
            </div>
            {playerEditMsg && <div role="alert" style={{ marginTop: 10, color: '#ef4444', fontSize: 12 }}>{playerEditMsg}</div>}
            <div style={{ display: 'flex', gap: 6, marginTop: 12 }}><Btn color="orange" type="submit" disabled={savingPlayer}>{savingPlayer ? 'Saving...' : 'Save Changes'}</Btn><Btn color="gray" type="button" onClick={() => setEditingPlayer(null)} disabled={savingPlayer}>Cancel</Btn></div>
          </form>
        )}
        {loadingVerifications ? (
          <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>Loading players...</div>
        ) : filteredPlayers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>{emptyDirectoryMessage}</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={thStyle}>Player</th>
                <th style={thStyle}>Email</th>
                <th style={thStyle}>Jersey</th>
                <th style={thStyle}>Position</th>
                <th style={thStyle}>DOB</th>
                <th style={thStyle}>Height</th>
                <th style={thStyle}>Weight</th>
                <th style={thStyle}>Barangay</th>
                <th style={thStyle}>Student ID</th>
                <th style={thStyle}>Assigned Team</th>
                <th style={thStyle}>Account Status</th>
                <th style={thStyle}>Actions</th>
              </tr></thead>
              <tbody>
                {filteredPlayers.map(player => (
                  <tr key={player.player_id}>
                    <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--text)' }}>
                      {player.name}
                      {player.username && <div style={{ marginTop: 2, fontSize: 10, color: 'var(--text-muted)', fontWeight: 400 }}>{player.username}</div>}
                    </td>
                    <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>{player.email}</td>
                    <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>{player.jersey_number ? `#${player.jersey_number}` : '—'}</td>
                    <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>{player.position || '—'}</td>
                    <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>{player.date_of_birth ? new Date(`${String(player.date_of_birth).slice(0, 10)}T00:00:00`).toLocaleDateString('en-PH') : '—'}</td>
                    <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>{player.height || '—'}</td>
                    <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>{player.weight || '—'}</td>
                    <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>{player.barangay || '—'}</td>
                    <td style={{ ...tdStyle, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{player.student_id || '—'}</td>
                    <td style={{ ...tdStyle, color: player.team_name ? 'var(--text)' : 'var(--text-muted)' }}>{player.team_name || 'Not assigned'}</td>
                    <td style={tdStyle}><Badge value={getAccountStatus(player)} /></td>
                    <td style={tdStyle}><Btn color="orange" onClick={() => startEditPlayer(player)}>Edit Bio</Btn></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      </>}
      </main>
    </div>
  )
}
