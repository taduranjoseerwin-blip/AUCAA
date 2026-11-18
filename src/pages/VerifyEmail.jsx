import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import axios from 'axios'

export default function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const [message, setMessage] = useState('Verifying your email...')
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    const token = searchParams.get('token')
    if (!token) {
      setStatus('invalid')
      setMessage('Invalid verification link.')
      return
    }

    axios.get(`/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(response => {
        const awaitingApproval = response.data?.awaiting_approval === true
        setStatus(awaitingApproval ? 'pending' : 'success')
        setMessage(response.data?.message || 'Your email has been verified.')
      })
      .catch(err => {
        const backendMessage = err.response?.data?.message
        setStatus(backendMessage === 'Your verification link has expired.' ? 'expired' : 'invalid')
        setMessage(backendMessage === 'Your verification link has expired.'
          ? 'Your verification link has expired.'
          : 'Invalid verification link.')
      })
  }, [searchParams])

  return (
    <div style={{ minHeight: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'var(--bg-deep)' }}>
      <div style={{ width: '100%', maxWidth: 420, padding: 28, textAlign: 'center', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: status === 'invalid' || status === 'expired' ? '#ef4444' : status === 'success' || status === 'pending' ? '#22c55e' : 'var(--orange)', marginBottom: 12 }}>
          {status === 'success' || status === 'pending' ? 'Verification successful' : status === 'loading' ? 'Email verification' : 'Verification failed'}
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>{message}</div>
        {status === 'success' ? (
          <Link to="/login" style={{ display: 'inline-block', background: 'var(--orange)', color: '#fff', fontWeight: 700, padding: '9px 14px', borderRadius: 8, textDecoration: 'none' }}>Go to Login</Link>
        ) : status === 'expired' ? (
          <Link to="/login" style={{ color: 'var(--orange)', fontWeight: 700, textDecoration: 'none' }}>Back to Login</Link>
        ) : status === 'invalid' ? (
          <Link to="/login" style={{ color: 'var(--orange)', fontWeight: 700, textDecoration: 'none' }}>Go to Login</Link>
        ) : null}
      </div>
    </div>
  )
}
