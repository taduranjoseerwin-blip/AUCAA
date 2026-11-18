import { useEffect, useState } from 'react'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import ConfirmModal from '../components/ConfirmModal'
import EyeIcon from '../components/EyeIcon'

export default function Settings({ profileOnly = false }) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [teams, setTeams] = useState([])
  const [profile, setProfile] = useState({ email: '', username: '', name: '', student_id: '', team_id: '', team_name: '', jersey_number: '', position: '', date_of_birth: '', height: '', weight: '', region: '', province: '', city: '', barangay: '' })
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [confirmState, setConfirmState] = useState(null)
  const [showPasswords, setShowPasswords] = useState({ current: false, new: false, confirm: false })

  const passwordRules = [
    { label: 'At least 8 characters', valid: passwords.newPassword.length >= 8 },
    { label: 'One uppercase letter', valid: /[A-Z]/.test(passwords.newPassword) },
    { label: 'One lowercase letter', valid: /[a-z]/.test(passwords.newPassword) },
    { label: 'One number', valid: /\d/.test(passwords.newPassword) },
    { label: 'One special character', valid: /[^A-Za-z0-9]/.test(passwords.newPassword) },
  ]
  const newPasswordValid = passwordRules.every((rule) => rule.valid)

  const passwordInputStyle = () => ({
    ...inputStyle,
    paddingRight: 42,
  })

  useEffect(() => {
    axios.get('/api/auth/account')
      .then((res) => {
        const data = res.data || {}
        if (data.date_of_birth) {
          const date = new Date(data.date_of_birth)
          if (!Number.isNaN(date.getTime())) data.date_of_birth = date.toISOString().slice(0, 10)
        }
        setProfile((prev) => ({ ...prev, ...data }))
      })
      .catch(() => setMessage({ type: 'error', text: 'Failed to load account settings.' }))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    axios.get('/api/teams')
      .then((res) => setTeams(res.data || []))
      .catch(() => setTeams([]))
  }, [])

  const showMessage = (type, text) => setMessage({ type, text })

  const saveProfile = async () => {
    setSaving(true)
    try {
      const res = await axios.patch('/api/auth/account/profile', profile)
      setProfile((prev) => ({ ...prev, ...res.data.profile }))
      showMessage('success', 'Profile information updated successfully.')
    } catch (err) {
      showMessage('error', err?.response?.data?.message || 'Failed to update profile information.')
    } finally {
      setSaving(false)
    }
  }

  const changePassword = () => {
    if (!passwords.currentPassword || !passwords.newPassword || !passwords.confirmPassword) {
      showMessage('error', 'Please fill in all password fields.')
      return
    }
    if (passwords.currentPassword === passwords.newPassword) {
      showMessage('error', 'New password must be different from the current password.')
      return
    }
    if (passwords.newPassword !== passwords.confirmPassword) {
      showMessage('error', 'New password and confirmation password do not match.')
      return
    }

    if (!newPasswordValid) {
      showMessage('error', 'New password does not meet all password requirements.')
      return
    }

    setConfirmState({
      title: 'Change password',
      message: 'Your password will be changed immediately. You will remain logged in on this device.',
      confirmText: 'Change Password',
      tone: 'warning',
      icon: 'ti-key',
      onClose: () => setConfirmState(null),
      onConfirm: async () => {
        setConfirmState(null)
        setSaving(true)
        try {
          const res = await axios.post('/api/auth/account/change-password', passwords)
          setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' })
          setShowPasswords({ current: false, new: false, confirm: false })
          showMessage('success', res.data.message || 'Password changed successfully.')
        } catch (err) {
          showMessage('error', err?.response?.data?.message || 'Failed to change password.')
        } finally {
          setSaving(false)
        }
      }
    })
  }

  const inputStyle = {
    width: '100%', background: '#1e2330', border: '1px solid #ffffff22', color: '#ffffff', borderRadius: 8, padding: '10px 12px'
  }

  if (loading) {
    return <div className="feed-area"><div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading settings...</div></div>
  }

  return (
    <div className="feed-area">
      <ConfirmModal open={!!confirmState} title={confirmState?.title} message={confirmState?.message} confirmText={confirmState?.confirmText} tone={confirmState?.tone} icon={confirmState?.icon} onConfirm={confirmState?.onConfirm} onClose={confirmState?.onClose} />

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>{profileOnly ? 'My ' : 'Account '}<span style={{ color: 'var(--orange)' }}>{profileOnly ? 'Profile' : 'Settings'}</span></div>
        <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-muted)' }}>
          {profileOnly ? 'View and update your profile details.' : 'Update your editable information and account password.'}
        </div>
      </div>

      {message && (
        <div role="status" style={{ marginBottom: 14, padding: '12px 14px', borderRadius: 10, border: message.type === 'success' ? '1px solid #4ade80' : '1px solid #fb7185', background: message.type === 'success' ? '#166534' : '#9f1239', color: '#fff', fontWeight: 700 }}>
          {message.text}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
        {user?.role === 'player' && profileOnly && (
          <section style={{ gridColumn: '1 / -1', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 800 }}>Player Profile Information</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Update your personal and account details.</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(180px, 1fr))', gap: 10 }}>
              <label>Username<input value={profile.username || ''} onChange={(e) => setProfile({ ...profile, username: e.target.value })} style={inputStyle} /></label>
              <label>Email<input type="email" value={profile.email || ''} onChange={(e) => setProfile({ ...profile, email: e.target.value })} style={inputStyle} /></label>
              <label>Full Name<input value={profile.name || ''} onChange={(e) => setProfile({ ...profile, name: e.target.value })} style={inputStyle} /></label>
              <label>Student ID<input value={profile.student_id || ''} onChange={(e) => setProfile({ ...profile, student_id: e.target.value })} style={inputStyle} /></label>
              <label>Date of Birth<input type="date" value={profile.date_of_birth || ''} onChange={(e) => setProfile({ ...profile, date_of_birth: e.target.value })} style={inputStyle} /></label>
              <label>Height<input value={profile.height || ''} onChange={(e) => setProfile({ ...profile, height: e.target.value })} placeholder="e.g. 175 cm" style={inputStyle} /></label>
              <label>Weight<input value={profile.weight || ''} onChange={(e) => setProfile({ ...profile, weight: e.target.value })} placeholder="e.g. 70 kg" style={inputStyle} /></label>
              <label>Jersey Number<input type="number" min="0" value={profile.jersey_number || ''} onChange={(e) => setProfile({ ...profile, jersey_number: e.target.value })} style={inputStyle} /></label>
              <label>Position<input value={profile.position || ''} onChange={(e) => setProfile({ ...profile, position: e.target.value })} style={inputStyle} /></label>
              <label>Team<select value={profile.team_id || ''} onChange={(e) => setProfile({ ...profile, team_id: e.target.value })} style={inputStyle}><option value="">No team</option>{teams.map((team) => <option key={team.team_id} value={String(team.team_id)}>{team.team_name}</option>)}</select></label>
              <label>Region<input value={profile.region || ''} onChange={(e) => setProfile({ ...profile, region: e.target.value })} style={inputStyle} /></label>
              <label>Province<input value={profile.province || ''} onChange={(e) => setProfile({ ...profile, province: e.target.value })} style={inputStyle} /></label>
              <label>City<input value={profile.city || ''} onChange={(e) => setProfile({ ...profile, city: e.target.value })} style={inputStyle} /></label>
              <label>Barangay<input value={profile.barangay || ''} onChange={(e) => setProfile({ ...profile, barangay: e.target.value })} style={inputStyle} /></label>
            </div>
            <button onClick={saveProfile} disabled={saving} style={{ marginTop: 14, width: '100%', padding: '10px 12px', borderRadius: 8, background: '#f97316', color: '#fff', fontWeight: 800 }}>
              {saving ? 'Saving...' : 'Save All Profile Details'}
            </button>
          </section>
        )}

        {!profileOnly && <section style={{ gridColumn: '1 / -1', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 800 }}>Change Password</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Change your password to improve security.</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
            <label>
              Current Password
              <div style={{ position: 'relative' }}>
                <input type={showPasswords.current ? 'text' : 'password'} autoComplete="current-password" value={passwords.currentPassword} onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })} style={passwordInputStyle()} />
                <button type="button" onClick={() => setShowPasswords((prev) => ({ ...prev, current: !prev.current }))} aria-label={showPasswords.current ? 'Hide current password' : 'Show current password'} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', width: 34, height: 34, borderRadius: 6, background: 'transparent', border: 'none', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 2 }}>
                  <EyeIcon visible={showPasswords.current} />
                </button>
              </div>
            </label>
            <label>
              New Password
              <div style={{ position: 'relative' }}>
                <input type={showPasswords.new ? 'text' : 'password'} autoComplete="new-password" value={passwords.newPassword} onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })} style={passwordInputStyle()} />
                <button type="button" onClick={() => setShowPasswords((prev) => ({ ...prev, new: !prev.new }))} aria-label={showPasswords.new ? 'Hide new password' : 'Show new password'} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', width: 34, height: 34, borderRadius: 6, background: 'transparent', border: 'none', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 2 }}>
                  <EyeIcon visible={showPasswords.new} />
                </button>
              </div>
            </label>
            <label>
              Confirm New Password
              <div style={{ position: 'relative' }}>
                <input type={showPasswords.confirm ? 'text' : 'password'} autoComplete="new-password" value={passwords.confirmPassword} onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })} style={passwordInputStyle()} />
                <button type="button" onClick={() => setShowPasswords((prev) => ({ ...prev, confirm: !prev.confirm }))} aria-label={showPasswords.confirm ? 'Hide confirmation password' : 'Show confirmation password'} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', width: 34, height: 34, borderRadius: 6, background: 'transparent', border: 'none', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 2 }}>
                  <EyeIcon visible={showPasswords.confirm} />
                </button>
              </div>
            </label>
          </div>

          <button
            onClick={changePassword}
            disabled={saving}
            style={{
              marginTop: 14,
              padding: '10px 14px',
              borderRadius: 8,
              background: '#f97316',
              border: 'none',
              color: '#ffffff',
              fontWeight: 800,
              cursor: 'pointer',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Changing...' : 'Change Password'}
          </button>
        </section>}
      </div>
    </div>
  )
}
