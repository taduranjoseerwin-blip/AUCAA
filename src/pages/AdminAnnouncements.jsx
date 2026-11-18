import { useEffect, useState } from 'react'
import axios from 'axios'
import ConfirmModal from '../components/ConfirmModal'

const typeOptions = [
  { value: 'general', label: 'General' },
  { value: 'important', label: 'Important' },
]

function Badge({ type }) {
  const styles = {
    general:   { bg: 'rgba(107,114,128,0.12)', color: '#6b7280' },
    schedule:  { bg: 'rgba(59,130,246,0.12)', color: '#2563eb' },
    live:      { bg: 'rgba(239,68,68,0.12)', color: '#ef4444' },
    important: { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
  }
  const style = styles[type] || styles.general
  return (
    <span style={{ padding: '4px 9px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: style.bg, color: style.color, textTransform: 'uppercase' }}>
      {type}
    </span>
  )
}

export default function AnnouncementsManagement() {
  const [announcements, setAnnouncements] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ title: '', message: '', type: 'general' })
  const [editingId, setEditingId] = useState(null)
  const [msg, setMsg] = useState('')
  const [confirmState, setConfirmState] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await axios.get('/api/announcements')
      setAnnouncements(res.data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const save = async () => {
    if (!form.title.trim() || !form.message.trim()) {
      setMsg('Title and message are required.')
      return
    }

    try {
      if (editingId) {
        await axios.patch(`/api/announcements/${editingId}`, form)
        setMsg('Announcement updated.')
      } else {
        await axios.post('/api/announcements', form)
        setMsg('Announcement published.')
      }
      setForm({ title: '', message: '', type: 'general' })
      setEditingId(null)
      load()
      setTimeout(() => setMsg(''), 2500)
    } catch (err) {
      console.error(err)
      setMsg(err.response?.data?.message || 'Failed to save announcement.')
    }
  }

  const edit = (announcement) => {
    setEditingId(announcement.announcement_id)
    setForm({ title: announcement.title, message: announcement.message, type: announcement.type })
    setMsg('Editing announcement...')
  }

  const remove = async (id) => {
    setConfirmState({
      title: 'Delete announcement',
      message: 'Delete this announcement? This action cannot be undone.',
      confirmText: 'Delete',
      tone: 'danger',
      icon: 'ti-trash',
      onConfirm: async () => {
        try {
          await axios.delete(`/api/announcements/${id}`)
          setConfirmState(null)
          load()
        } catch (err) {
          console.error(err)
          setMsg('Failed to delete announcement.')
          setConfirmState(null)
        }
      },
      onClose: () => setConfirmState(null),
    })
  }

  return (
    <div>
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

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Announcements</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Create and manage in-app announcement messages.</div>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 14, marginBottom: 18 }}>
        <div style={{ display: 'grid', gap: 10, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 16 }}>
          <div style={{ display: 'grid', gap: 8 }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Title</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} style={{ width: '100%', padding: '10px 12px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-panel)', color: 'var(--text)' }} />
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Message</label>
            <textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} rows={4} style={{ width: '100%', padding: '10px 12px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-panel)', color: 'var(--text)', resize: 'vertical' }} />
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ minWidth: 160 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Type</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} style={{ width: '100%', padding: '10px 12px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-panel)', color: 'var(--text)' }}>
                {typeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 10, marginLeft: 'auto' }}>
              <button onClick={() => { setForm({ title: '', message: '', type: 'general' }); setEditingId(null); setMsg('') }} style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-panel)', color: 'var(--text)', cursor: 'pointer' }}>Clear</button>
              <button onClick={save} style={{ padding: '10px 14px', borderRadius: 8, border: 'none', background: 'var(--orange)', color: '#fff', cursor: 'pointer' }}>{editingId ? 'Update' : 'Publish'}</button>
            </div>
          </div>
          {msg && <div style={{ fontSize: 12, color: msg.includes('Failed') ? '#ef4444' : '#22c55e' }}>{msg}</div>}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        {loading ? (
          <div style={{ padding: 20, background: 'var(--bg-card)', borderRadius: 14, color: 'var(--text-muted)' }}>Loading announcements...</div>
        ) : announcements.length === 0 ? (
          <div style={{ padding: 20, background: 'var(--bg-card)', borderRadius: 14, color: 'var(--text-muted)' }}>No announcements yet.</div>
        ) : announcements.map(item => (
          <div key={item.announcement_id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 16 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{item.title}</div>
              <Badge type={item.type} />
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <button onClick={() => edit(item)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-panel)', color: 'var(--text)', cursor: 'pointer' }}>Edit</button>
                <button onClick={() => remove(item.announcement_id)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.08)', color: '#ef4444', cursor: 'pointer' }}>Delete</button>
              </div>
            </div>
            <div style={{ color: 'var(--text-muted)', whiteSpace: 'pre-wrap', lineHeight: 1.6, marginBottom: 10 }}>{item.message}</div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 11, color: 'var(--text-muted)' }}>
              <span>{new Date(item.created_at).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              {item.author && <span>By {item.author}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
