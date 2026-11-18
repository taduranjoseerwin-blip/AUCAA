import { useState, useEffect, useRef } from 'react'
import { Navigate } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'

const styles = {
  page: {
    padding: 24,
    color: 'var(--text)',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    position: 'relative',
  },
  titleSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: 700,
  },
  subtitle: {
    fontSize: 13,
    color: 'var(--text-muted)',
  },
  section: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    padding: 12,
    gap: 12,
    display: 'flex',
    flexDirection: 'column',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: 'var(--text)',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  controlsContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 12,
  },
  control: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  select: {
    padding: 8,
    borderRadius: 8,
    border: '1px solid var(--border)',
    backgroundColor: 'var(--bg-card)',
    color: 'var(--text)',
    fontSize: 13,
    cursor: 'pointer',
  },
  reportsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: 12,
  },
  reportCard: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: 12,
    gap: 8,
    display: 'flex',
    flexDirection: 'column',
  },
  reportCardTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: 'var(--text)',
  },
  reportCardDesc: {
    fontSize: 12,
    color: 'var(--text-muted)',
    lineHeight: '1.4',
  },
  reportCardButtons: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },
  smallButton: {
    padding: '6px 12px',
    borderRadius: 6,
    border: 'none',
    backgroundColor: 'var(--orange)',
    color: 'white',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: 12,
    transition: 'background-color 0.2s',
  },
  error: {
    background: '#fee2e2',
    border: '1px solid #fca5a5',
    color: '#991b1b',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    fontSize: 13,
  },
  toastError: {
    position: 'fixed',
    top: 20,
    right: 20,
    zIndex: 1000,
    minWidth: 280,
    maxWidth: 'calc(100vw - 40px)',
    boxShadow: '0 12px 28px rgba(0,0,0,0.15)',
    borderRadius: 12,
    padding: '14px 16px',
    background: '#fee2e2',
    border: '1px solid #fca5a5',
    color: '#991b1b',
    fontSize: 13,
  },
}

export default function Reports() {
  const { user } = useAuth()
  
  // Restrict access to admin and league_manager only
  if (user && user.role !== 'admin' && user.role !== 'league_manager') {
    return <Navigate to="/highlights" replace />
  }

  const [leagues, setLeagues] = useState([])
  const [selectedLeague, setSelectedLeague] = useState(1)
  const [format, setFormat] = useState('csv')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const timeoutRef = useRef(null)

  useEffect(() => {
    fetchLeagues()
  }, [])

  const fetchLeagues = async () => {
    try {
      const res = await axios.get('/api/leagues')
      const nextLeagues = Array.isArray(res.data) ? res.data : []
      setLeagues(nextLeagues)
      if (nextLeagues.length > 0) {
        setSelectedLeague((current) => {
          const exists = nextLeagues.some((league) => String(league.league_id) === String(current))
          return exists ? current : nextLeagues[0].league_id
        })
      }
    } catch (error) {
      setMessage(`Error loading leagues: ${error.message}`)
      clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => setMessage(''), 5000)
    }
  }

  const downloadReport = async (reportType) => {
    setLoading(true)
    setMessage('')
    try {
      const token = sessionStorage.getItem('aucaa_token')
      const response = await axios.get(
        `/api/reports/${reportType}/${selectedLeague}?format=${format}`,
        {
          responseType: 'blob',
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        }
      )

      const ext = format === 'pdf' ? 'txt' : 'csv'
      const filename = `${reportType}-${selectedLeague}-${new Date().getTime()}.${ext}`

      const url = window.URL.createObjectURL(response.data)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', filename)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => setMessage(''), 5000)
    } catch (error) {
      setMessage(`✗ Error downloading report: ${error.message}`)
      clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => setMessage(''), 5000)
    } finally {
      setLoading(false)
    }
  }

  // Check authorization
  if (!user || (user.role !== 'admin' && user.role !== 'league_manager')) {
    return (
      <div style={styles.page}>
        <div style={styles.section}>
          <div style={styles.error}>
            You don't have permission to access reports. Contact an administrator.
          </div>
        </div>
      </div>
    )
  }

  const reports = [
    {
      type: 'standings',
      title: 'Standings Report',
      description: 'Team records, wins, losses, points for/against, and point differential by league.',
    },
    {
      type: 'players',
      title: 'Player Statistics Report',
      description: 'Individual player stats including games played, points, rebounds, and assists.',
    },
    {
      type: 'games',
      title: 'Game Statistics Report',
      description: 'Completed and live games with scores, dates, venues, and game status.',
    },
    {
      type: 'league-overview',
      title: 'League Overview Report',
      description: 'High-level league statistics: teams, players, games, and completion status.',
    },
  ]

  return (
    <div style={styles.page}>
      <div style={styles.titleSection}>
        <div style={styles.title}>Reports</div>
        <div style={styles.subtitle}>Generate and download reports by league</div>
      </div>

      {/* Report Generation Controls */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Generate Reports</div>

        <div style={styles.controlsContainer}>
          <div style={styles.control}>
            <label style={styles.label}>Select League</label>
            <select
              style={styles.select}
              value={selectedLeague}
              onChange={(e) => setSelectedLeague(e.target.value)}
              disabled={loading}
            >
              {leagues.map((league) => (
                <option key={`league-${league.league_id}`} value={league.league_id}>
                  {league.name} ({league.season || 'TBA'})
                </option>
              ))}
            </select>
          </div>

          <div style={styles.control}>
            <label style={styles.label}>Export Format</label>
            <select
              style={styles.select}
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              disabled={loading}
            >
              <option value="csv">CSV (Excel/Spreadsheet)</option>
              <option value="pdf">TXT (Plain Text)</option>
            </select>
          </div>
        </div>

        <p style={{ fontSize: '0.875rem', color: '#666', marginTop: '1rem' }}>
          Select a league and format, then click any report card below to generate and download.
        </p>
      </div>

      {/* Report Cards Grid */}
      <div style={styles.reportsGrid}>
        {reports.map((report) => (
          <div key={report.type} style={styles.reportCard}>
            <h3 style={styles.reportCardTitle}>{report.title}</h3>
            <p style={styles.reportCardDesc}>{report.description}</p>
            <div style={styles.reportCardButtons}>
              <button
                style={styles.smallButton}
                onClick={() => downloadReport(report.type)}
                disabled={loading}
                onMouseEnter={(e) =>
                  (e.target.style.backgroundColor = '#e89b3c')
                }
                onMouseLeave={(e) =>
                  (e.target.style.backgroundColor = 'var(--orange)')
                }
              >
                {loading ? 'Generating...' : 'Download'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {message && (
        <div style={styles.toastError}>{message}</div>
      )}
    </div>
  )
}
