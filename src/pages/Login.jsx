import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import {
  getAllRegions,
  getProvincesByRegion,
  getMunicipalitiesByProvince,
  getBarangaysByMunicipality
} from '@aivangogh/ph-address'

const PASSWORD_RULES = [
  { test: (value) => value.length >= 8 },
  { test: (value) => /[A-Z]/.test(value) },
  { test: (value) => /[a-z]/.test(value) },
  { test: (value) => /\d/.test(value) },
  { test: (value) => /[^A-Za-z0-9]/.test(value) }
]
const PASSWORD_POLICY_MESSAGE = 'Password is too weak. It must be at least 8 characters and include an uppercase letter and a unique special character (e.g., !@#$%^&*()-+).'

function getDateOfBirthError(value) {
  if (!value) return 'Date of birth is required.'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'Date of birth must be a valid date.'

  const selectedDate = new Date(`${value}T00:00:00`)
  const [year, month, day] = value.split('-').map(Number)
  if (
    selectedDate.getFullYear() !== year ||
    selectedDate.getMonth() + 1 !== month ||
    selectedDate.getDate() !== day
  ) return 'Date of birth must be a valid date.'
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (Number.isNaN(selectedDate.getTime())) return 'Date of birth must be a valid date.'
  if (selectedDate > today) return 'Date of birth cannot be in the future.'

  return null
}

function getPlayerFieldError(registerForm) {
  const height = String(registerForm.height || '').trim()
  const weight = String(registerForm.weight || '').trim()
  const jersey = String(registerForm.jersey_number || '').trim()

  if (!/^\d+$/.test(height) || Number(height) < 100 || Number(height) > 250) {
    return 'Height must be a number from 100 to 250 cm.'
  }
  if (!/^\d+$/.test(weight) || Number(weight) < 30 || Number(weight) > 200) {
    return 'Weight must be a number from 30 to 200 kg.'
  }
  if (!/^\d+$/.test(jersey) || Number(jersey) < 0 || Number(jersey) > 99) {
    return 'Jersey number must be a whole number from 0 to 99.'
  }
  return getDateOfBirthError(registerForm.date_of_birth) || null
}

function getRegistrationCodeHint(role) {
  switch (role) {
    case 'player':
      return 'Get this code from your coach.'
    case 'coach':
      return 'Get this code from your league manager.'
    case 'league_manager':
      return 'Get this code from your admin.'
    default:
      return 'Get this code from your Admin or League Manager.'
  }
}

function PasswordInput({ value, onChange, id }) {
  const [show, setShow] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <input
        id={id}
        className="password-input"
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        required
        autoComplete="off"
        style={{ padding: '8px 40px 8px 12px', width: '100%', fontSize: 12 }}
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        style={{
          position: 'absolute', right: 10, top: '50%',
          transform: 'translateY(-50%)',
          background: 'transparent', border: 'none',
          cursor: 'pointer', color: 'var(--text-muted)',
          display: 'flex', alignItems: 'center', padding: 0
        }}
        aria-label={show ? 'Hide password' : 'Show password'}
      >
        {show
          ? <i className="far fa-eye-slash" style={{ fontSize: 16 }} />
          : <i className="far fa-eye" style={{ fontSize: 16 }} />
        }
      </button>
    </div>
  )
}

export default function Login() {
  const [tab, setTab] = useState('login')

  const [loginForm, setLoginForm] = useState({ username: '', password: '' })
  const emptyRegister = { username: '', email: '', password: '', reg_code: '', role: '', full_name: '', jersey_number: '', position: '', date_of_birth: '', height: '', weight: '', region: '', province: '', city: '', barangay: '', barangay_code: '', barangay_lat: '', barangay_lng: '', barangay_place_id: '' }
  const [registerForm, setRegisterForm] = useState(emptyRegister)
  const [selectedRegion, setSelectedRegion] = useState('')
  const [selectedProvince, setSelectedProvince] = useState('')
  const [selectedCity, setSelectedCity] = useState('')

  const [error, setError] = useState('')
  const [registrationMessage, setRegistrationMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const registerPasswordValid = PASSWORD_RULES.every((rule) => rule.test(registerForm.password))
  const showPasswordWarning = registerForm.password.length > 0 && !registerPasswordValid
  const dobError = registerForm.role === 'player' ? getDateOfBirthError(registerForm.date_of_birth) : null
  const [resetStep, setResetStep] = useState('email')
  const [resetUsername, setResetUsername] = useState('')
  const [resetEmail, setResetEmail] = useState('')
  const [resetOtp, setResetOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [resetMessage, setResetMessage] = useState('')
  const [resendMessage, setResendMessage] = useState('')
  const [resendMessageType, setResendMessageType] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)
  const [showResendVerification, setShowResendVerification] = useState(false)
  const [resendEmail, setResendEmail] = useState('')
  const [checkingUsername, setCheckingUsername] = useState(false)
  const { login, register, requestPasswordReset, verifyResetOtp, resetPassword } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (resendCooldown <= 0) return undefined
    const timer = setInterval(() => {
      setResendCooldown(current => {
        if (current <= 1) {
          setResendMessage('')
          setResendMessageType('')
          return 0
        }
        return current - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [resendCooldown])

  const setL = (k) => (e) => setLoginForm(f => ({ ...f, [k]: e.target.value }))
  const setR = (k) => (e) => setRegisterForm(f => ({ ...f, [k]: e.target.value }))
  const setRNumberOnly = (k) => (e) => setRegisterForm(f => ({
    ...f,
    [k]: e.target.value.replace(/\D/g, '')
  }))

  const regionOptions = getAllRegions()
  const provinceOptions = selectedRegion ? getProvincesByRegion(selectedRegion) : []
  const cityOptions = selectedProvince ? getMunicipalitiesByProvince(selectedProvince) : []
  const barangayOptions = selectedCity ? getBarangaysByMunicipality(selectedCity) : []

  const handleRegionChange = (e) => {
    const regionCode = e.target.value
    const regionName = regionOptions.find(r => r.psgcCode === regionCode)?.name || ''
    setSelectedRegion(regionCode)
    setSelectedProvince('')
    setSelectedCity('')
    setRegisterForm(f => ({ ...f, region: regionName, province: '', city: '', barangay: '', barangay_code: '' }))
  }

  const handleProvinceChange = (e) => {
    const provinceCode = e.target.value
    const provinceName = provinceOptions.find(p => p.psgcCode === provinceCode)?.name || ''
    setSelectedProvince(provinceCode)
    setSelectedCity('')
    setRegisterForm(f => ({ ...f, province: provinceName, city: '', barangay: '', barangay_code: '' }))
  }

  const handleCityChange = (e) => {
    const cityCode = e.target.value
    const cityName = cityOptions.find(c => c.psgcCode === cityCode)?.name || ''
    setSelectedCity(cityCode)
    setRegisterForm(f => ({ ...f, city: cityName, barangay: '', barangay_code: '' }))
  }

  const handleBarangayChange = (e) => {
    const barangayOption = barangayOptions.find(brgy => brgy.psgcCode === e.target.value)
    const barangayName = barangayOption?.name || ''
    const barangayCode = barangayOption?.psgcCode || ''
    setRegisterForm(f => ({
      ...f,
      barangay: barangayName,
      barangay_code: barangayCode
    }))
  }

  const handleTabSwitch = (t) => {
    setTab(t)
    setError('')
    setRegistrationMessage('')
    setLoginForm({ username: '', password: '' })
    setRegisterForm(emptyRegister)
    setSelectedRegion('')
    setSelectedProvince('')
    setSelectedCity('')
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(loginForm.username, loginForm.password)
      navigate('/highlights')
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed.')
    }
    setLoading(false)
  }

  const getBarangayNameFromAddress = (address = {}) => {
    return address.neighbourhood || address.suburb || address.hamlet || address.village || address.town || address.city_district || address.county || ''
  }

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser.')
      return
    }

    navigator.geolocation.getCurrentPosition(async (position) => {
      try {
        const { latitude, longitude } = position.coords
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&addressdetails=1`)
        const payload = await response.json()
        const barangay = getBarangayNameFromAddress(payload.address) || payload.display_name || registerForm.barangay

        setRegisterForm((prev) => ({
          ...prev,
          barangay,
          barangay_code: '',
          barangay_lat: latitude.toFixed(7),
          barangay_lng: longitude.toFixed(7),
          barangay_place_id: payload.place_id ? String(payload.place_id) : prev.barangay_place_id
        }))
      } catch (error) {
        setError('Unable to resolve location. Please enter barangay manually.')
      }
    }, (err) => {
      setError(`Unable to detect location: ${err.message}`)
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 })
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    setError('')

    if (!registerPasswordValid) {
      setError(PASSWORD_POLICY_MESSAGE)
      return
    }

    if (registerForm.role === 'player') {
      const playerFieldError = getPlayerFieldError(registerForm)
      if (playerFieldError) {
        setError(playerFieldError)
        return
      }
    }

    setLoading(true)
    try {
      const response = await register(registerForm)
      setRegistrationMessage(response?.message || 'Registration successful. Check your email to verify your account.')
      setRegisterForm(emptyRegister)
      setSelectedRegion('')
      setSelectedProvince('')
      setSelectedCity('')
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed.')
    }
    setLoading(false)
  }

  const resetForgotPasswordForm = () => {
    setShowForgotPassword(false)
    setResetStep('email')
    setResetUsername('')
    setResetEmail('')
    setResetOtp('')
    setNewPassword('')
    setConfirmPassword('')
    setResetMessage('')
    setError('')
  }

  const openForgotPassword = async () => {
    const username = loginForm.username.trim()
    if (!username) {
      setError('Please enter the registered username first.')
      return
    }

    setError('')
    setCheckingUsername(true)
    try {
      await axios.post('/api/auth/check-username', { username })
      setResetUsername(username)
      setResetEmail('')
      setResetOtp('')
      setNewPassword('')
      setConfirmPassword('')
      setResetMessage('')
      setResetStep('email')
      setShowForgotPassword(true)
    } catch (err) {
      setError(err.response?.data?.message || 'Username does not exist. Please enter the correct registered username.')
    } finally {
      setCheckingUsername(false)
    }
  }

  const handleResendVerification = () => {
    if (resendCooldown > 0) return

    setResendEmail('')
    setResendMessage('')
    setResendMessageType('')
    setShowResendVerification(true)
  }

  const handleSubmitResendVerification = async (event) => {
    event.preventDefault()
    const email = resendEmail.trim()
    if (!email) {
      setResendMessage('Please enter your email first.')
      setResendMessageType('error')
      return
    }

    setResendMessage('')
    setResendMessageType('')
    setResendCooldown(60)
    setShowResendVerification(false)
    axios.post('/api/auth/resend-verification', { email })
      .then(response => {
        setResendMessage(response.data.message)
        setResendMessageType('success')
      })
      .catch(err => {
        setResendMessage(err.response?.data?.message || 'Unable to resend verification email.')
        setResendMessageType('error')
      })
  }

  const handleForgotPassword = async (e) => {
    e.preventDefault()
    setError('')
    setResetMessage('')

    const username = loginForm.username.trim() || resetUsername.trim()

    if (!username) {
      setResetMessage('Username is required before sending the verification code.')
      return
    }

    setResetUsername(username)

    setLoading(true)
    try {
      const data = await requestPasswordReset(resetUsername, resetEmail)
      setResetMessage(data?.message || 'A 6-digit verification code has been sent to your email.')
      setResetStep('reset')
    } catch (err) {
      setResetMessage(err.response?.data?.message || 'Unable to process password reset request.')
    }
    setLoading(false)
  }

  const handleResendCode = async () => {
    if (!resetUsername.trim() || !resetEmail.trim()) return
    setResetMessage('')
    setLoading(true)
    try {
      const data = await requestPasswordReset(resetUsername, resetEmail)
      setResetMessage(data?.message || 'A new verification code has been sent.')
    } catch (err) {
      setResetMessage(err.response?.data?.message || 'Unable to resend verification code.')
    }
    setLoading(false)
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()
    setError('')
    setResetMessage('')

    if (!resetUsername.trim()) {
      setResetMessage('Username is required before resetting your password.')
      return
    }

    if (newPassword.length < 6) {
      setResetMessage('Password must be at least 6 characters long.')
      return
    }

    if (newPassword !== confirmPassword) {
      setResetMessage('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      const data = await resetPassword({
        email: resetEmail,
        otp: resetOtp,
        username: resetUsername,
        password: newPassword
      })
      setResetMessage(data?.message || 'Your password has been reset successfully.')
      setTimeout(() => {
        resetForgotPasswordForm()
        setTab('login')
      }, 1200)
    } catch (err) {
      setResetMessage(err.response?.data?.message || 'Unable to reset password.')
    }
    setLoading(false)
  }

  const inputStyle = { width: '100%', padding: '8px 12px', fontSize: 12 }
  const labelStyle = { fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.3px' }

  return (
    <div style={{
      minHeight: '100%', height: '100%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'var(--bg-deep)',
      padding: 'clamp(10px, 3vw, 24px)', position: 'relative', overflowY: 'auto'
    }}>
      <div className={tab === 'register' ? 'login-card login-card-register' : 'login-card'} style={{ width: '100%', maxWidth: tab === 'register' ? 760 : 400, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: 'clamp(16px, 4vh, 28px) clamp(20px, 5vw, 36px)', boxShadow: '0 12px 30px rgba(0,0,0,0.24)' }}>
        {/* 3D Photorealistic AUCAA Badge Medallion */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: tab === 'register' ? 10 : 'clamp(12px, 3vh, 28px)' }}>
          <svg
            width="190"
            height="190"
            viewBox="0 0 220 220"
            style={{ width: 180, height: 'auto', maxWidth: '100%' }}
          >
            <defs>
              {/* Burnt Orange Matte Texture Gradient */}
              <radialGradient id="burntOrangeField" cx="35%" cy="35%" r="65%">
                <stop offset="0%" stopColor="#d97706" />
                <stop offset="60%" stopColor="#b45309" />
                <stop offset="100%" stopColor="#92400e" />
              </radialGradient>

              {/* Navy Blue Outer Ring Gradient */}
              <linearGradient id="navyRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#1e293b" />
                <stop offset="50%" stopColor="#0f172a" />
                <stop offset="100%" stopColor="#020617" />
              </linearGradient>

              {/* 3D Text Metallic Gradient */}
              <linearGradient id="textMetallic" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#fb923c" />
                <stop offset="30%" stopColor="#d97706" />
                <stop offset="70%" stopColor="#b45309" />
                <stop offset="100%" stopColor="#92400e" />
              </linearGradient>

              {/* Studio Lighting Highlight */}
              <radialGradient id="highlight" cx="25%" cy="25%" r="50%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.3" />
                <stop offset="50%" stopColor="#ffffff" stopOpacity="0.08" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
              </radialGradient>

              {/* Inner Shadow for Depth */}
              <radialGradient id="innerShade" cx="50%" cy="50%" r="55%">
                <stop offset="0%" stopColor="#000000" stopOpacity="0" />
                <stop offset="85%" stopColor="#000000" stopOpacity="0.15" />
              </radialGradient>

              {/* Text Shadow Filter */}
              <filter id="textShadow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="2" dy="3" stdDeviation="1.5" floodOpacity="0.4" />
              </filter>
            </defs>

            {/* Outer Navy Ring - Bottom Shadow */}
            <circle cx="110" cy="110" r="106" fill="#000000" opacity="0.25" />

            {/* Outer Navy Ring - Beveled Edge (darker bottom) */}
            <circle cx="110" cy="110" r="104" fill="url(#navyRingGrad)" stroke="#000000" strokeWidth="1" />

            {/* Outer Ring - Top Bevel Highlight */}
            <circle cx="110" cy="110" r="104" fill="none" stroke="#3d4a56" strokeWidth="2" opacity="0.35" />

            {/* Inner Navy Concentric Ring */}
            <circle cx="110" cy="110" r="92" fill="none" stroke="#0f172a" strokeWidth="2.5" opacity="0.8" />
            <circle cx="110" cy="110" r="91" fill="none" stroke="#1e293b" strokeWidth="0.8" opacity="0.4" />

            {/* Burnt Orange Main Field */}
            <circle cx="110" cy="110" r="88" fill="url(#burntOrangeField)" />

            {/* Orange Field - Subtle Texture Overlay */}
            <circle cx="110" cy="110" r="88" fill="url(#innerShade)" />

            {/* Orange Field - Top Studio Light Highlight */}
            <ellipse cx="110" cy="60" rx="60" ry="40" fill="url(#highlight)" />

            {/* AUCAA Text - Dark Navy Shadow Layer (Depth) */}
            <text
              x="110"
              y="105"
              textAnchor="middle"
              fontSize="52"
              fontWeight="900"
              fill="none"
              stroke="#020617"
              strokeWidth="3.5"
              fontFamily="Georgia, 'Palatino Linotype', serif"
              letterSpacing="2.5"
              filter="url(#textShadow)"
            >
              AUCAA
            </text>

            {/* AUCAA Text - Main Metallic Burnt Orange */}
            <text
              x="110"
              y="102"
              textAnchor="middle"
              fontSize="52"
              fontWeight="900"
              fill="url(#textMetallic)"
              fontFamily="Georgia, 'Palatino Linotype', serif"
              letterSpacing="2.5"
              stroke="#0f172a"
              strokeWidth="1"
            >
              AUCAA
            </text>

            {/* AUCAA Text - Bright Highlight (3D Bevel Effect) */}
            <text
              x="110"
              y="100"
              textAnchor="middle"
              fontSize="52"
              fontWeight="900"
              fill="none"
              stroke="#fbbf24"
              strokeWidth="0.8"
              fontFamily="Georgia, 'Palatino Linotype', serif"
              letterSpacing="2.5"
              opacity="0.5"
            >
              AUCAA
            </text>

            {/* Basketball League System - Direct Positioning Below AUCAA Inside Orange */}
            <text
              x="110"
              y="127"
              textAnchor="middle"
              fontSize="11"
              fontWeight="900"
              fill="#0f172a"
              fontFamily="Arial, Helvetica, sans-serif"
              letterSpacing="0.6"
            >
              Basketball League System
            </text>
          </svg>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', marginBottom: tab === 'register' ? 10 : 'clamp(16px, 3vh, 28px)', background: 'var(--bg-panel)', borderRadius: 10, padding: 4 }}>
          {['login', 'register'].map(t => (
            <button key={t} onClick={() => handleTabSwitch(t)} style={{
              flex: 1, padding: '8px 0', fontSize: 12, fontWeight: 600, borderRadius: 8,
              background: tab === t ? 'var(--orange)' : 'transparent',
              color: tab === t ? '#fff' : 'var(--text-muted)',
              border: 'none', cursor: 'pointer', transition: 'all 0.15s', textTransform: 'capitalize'
            }}>{t}</button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 6, padding: '8px 12px', fontSize: 12,
            color: 'var(--live)', marginBottom: 14
          }}>{error}</div>
        )}

        {registrationMessage && (
          <div style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 6, padding: '8px 12px', fontSize: 12, color: 'var(--text)', marginBottom: 14 }}>
            {registrationMessage}
          </div>
        )}

        {tab === 'login' && (
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(12px, 2vh, 18px)' }}>
            <div>
              <label style={labelStyle}>Username</label>
              <input
                value={loginForm.username}
                onChange={setL('username')}
                required
                autoComplete="off"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Password</label>
              <PasswordInput
                id="login-password"
                value={loginForm.password}
                onChange={setL('password')}
              />
            </div>
            <button
              type="submit"
              style={{
                marginTop: 6, padding: '9px 0', fontSize: 13, width: '100%',
                background: 'var(--orange)', color: '#fff', border: 'none',
                borderRadius: 8, fontWeight: 600, cursor: 'pointer'
              }}
              disabled={loading}
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>

            <div style={{ textAlign: 'center', marginTop: 6 }}>
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={resendCooldown > 0}
                style={{
                  background: 'transparent', border: 'none',
                  color: 'var(--orange)', cursor: resendCooldown > 0 ? 'not-allowed' : 'pointer',
                  fontSize: 12, fontWeight: 600, padding: 0,
                  opacity: resendCooldown > 0 ? 0.55 : 1
                }}
              >
                Resend verification email
              </button>
              {resendCooldown > 0 && (
                <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                  Try again in {resendCooldown}s.
                </div>
              )}
              {resendMessage && resendMessage !== 'Please enter your email first.' && (
                <div style={{ marginTop: 6, fontSize: 12, color: resendMessageType === 'error' ? '#ef4444' : '#22c55e' }}>
                  {resendMessage}
                </div>
              )}
            </div>

            <div style={{ textAlign: 'center', marginTop: 6 }}>
              <button
                type="button"
                onClick={openForgotPassword}
                disabled={checkingUsername}
                style={{
                  background: 'transparent', border: 'none',
                  color: 'var(--orange)', cursor: checkingUsername ? 'not-allowed' : 'pointer',
                  fontSize: 12, fontWeight: 600, padding: 0,
                  opacity: checkingUsername ? 0.6 : 1
                }}
              >
                Forgot Password?
              </button>
            </div>

            {resetMessage && (
              <div style={{
                marginTop: 10, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)',
                borderRadius: 6, padding: '8px 12px', fontSize: 12, color: 'var(--text)',
                textAlign: 'center'
              }}>{resetMessage}</div>
            )}
          </form>
        )}

        {/* REGISTER FORM */}
        {tab === 'register' && (
          <form className="login-register-form" onSubmit={handleRegister} style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
            <div>
              <label style={labelStyle}>Registering as</label>
              <select
                value={registerForm.role}
                onChange={setR('role')}
                required
                style={inputStyle}
              >
                <option value="" disabled>Select role</option>
                <option value="player">Player</option>
                <option value="coach">Coach</option>
                <option value="league_manager">League Manager</option>
              </select>
            </div>
            {registerForm.role === 'player' ? (
              <>
                <div>
                  <label style={labelStyle}>Username</label>
                  <input
                    value={registerForm.username}
                    onChange={setR('username')}
                    required
                    autoComplete="off"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Full Name</label>
                  <input
                    value={registerForm.full_name}
                    onChange={setR('full_name')}
                    required
                    autoComplete="off"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Email</label>
                  <input
                    type="email"
                    value={registerForm.email}
                    onChange={setR('email')}
                    required
                    autoComplete="off"
                    style={inputStyle}
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label style={labelStyle}>Username</label>
                  <input
                    value={registerForm.username}
                    onChange={setR('username')}
                    required
                    autoComplete="off"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Email</label>
                  <input
                    type="email"
                    value={registerForm.email}
                    onChange={setR('email')}
                    required
                    autoComplete="off"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Password</label>
                  <PasswordInput
                    id="reg-password"
                    value={registerForm.password}
                    onChange={setR('password')}
                  />
                  {showPasswordWarning && (
                    <div style={{
                      marginTop: 6,
                      fontSize: 11,
                      color: '#ef4444',
                      lineHeight: 1.4
                    }}>
                      {PASSWORD_POLICY_MESSAGE}
                    </div>
                  )}
                </div>
              </>
            )}

            {registerForm.role === 'player' && (
              <>
                <div>
                  <label style={labelStyle}>Date of Birth</label>
                  <input
                    type="date"
                    value={registerForm.date_of_birth}
                    onChange={setR('date_of_birth')}
                    max={new Date().toISOString().slice(0, 10)}
                    required
                    autoComplete="off"
                    style={{
                      ...inputStyle,
                      borderColor: dobError ? '#f59e0b' : undefined
                    }}
                  />
                  {dobError && (
                    <div style={{
                      marginTop: 6,
                      fontSize: 11,
                      color: '#f59e0b',
                      lineHeight: 1.4,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}>
                      <span>⚠</span>
                      <span>{dobError}</span>
                    </div>
                  )}
                </div>
                <div className="register-location-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6 }}>
                  <div>
                    <label style={labelStyle}>Region</label>
                    <select value={selectedRegion} onChange={handleRegionChange} required style={inputStyle}>
                      <option value="" disabled>Select region</option>
                      {regionOptions.map(region => (
                        <option key={region.psgcCode} value={region.psgcCode}>{region.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Province</label>
                    <select value={selectedProvince} onChange={handleProvinceChange} required style={inputStyle} disabled={!selectedRegion}>
                      <option value="" disabled>{selectedRegion ? 'Select province' : 'Select region first'}</option>
                      {provinceOptions.map(province => (
                        <option key={province.psgcCode} value={province.psgcCode}>{province.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>City / Municipality</label>
                    <select value={selectedCity} onChange={handleCityChange} required style={inputStyle} disabled={!selectedProvince}>
                      <option value="" disabled>{selectedProvince ? 'Select city / municipality' : 'Select province first'}</option>
                      {cityOptions.map(city => (
                        <option key={city.psgcCode} value={city.psgcCode}>{city.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Barangay</label>
                    <select value={registerForm.barangay_code} onChange={handleBarangayChange} required style={inputStyle} disabled={!selectedCity}>
                      <option value="" disabled>{selectedCity ? 'Select barangay' : 'Select city first'}</option>
                      {barangayOptions.map(brgy => (
                        <option key={brgy.psgcCode} value={brgy.psgcCode}>{brgy.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Height (cm)</label>
                    <input
                      type="number"
                      value={registerForm.height}
                      onChange={setRNumberOnly('height')}
                      inputMode="numeric"
                      min="100"
                      max="250"
                      step="1"
                      required
                      placeholder="180"
                      autoComplete="off"
                      style={inputStyle}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Weight (kg)</label>
                    <input
                      type="number"
                      value={registerForm.weight}
                      onChange={setRNumberOnly('weight')}
                      inputMode="numeric"
                      min="30"
                      max="200"
                      step="1"
                      required
                      placeholder="75"
                      autoComplete="off"
                      style={inputStyle}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Jersey #</label>
                    <input
                      type="number"
                      value={registerForm.jersey_number}
                      onChange={setRNumberOnly('jersey_number')}
                      inputMode="numeric"
                      min="0"
                      max="99"
                      step="1"
                      required
                      autoComplete="off"
                      placeholder="0"
                      style={inputStyle}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Position</label>
                    <select
                      value={registerForm.position}
                      onChange={setR('position')}
                      style={inputStyle}
                    >
                      <option value="">Select...</option>
                      <option value="Guard">Guard</option>
                      <option value="Forward">Forward</option>
                      <option value="Center">Center</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            {registerForm.role === 'player' && (
              <div>
                <label style={labelStyle}>Password</label>
                <PasswordInput
                  id="reg-password"
                  value={registerForm.password}
                  onChange={setR('password')}
                />
                {showPasswordWarning && (
                  <div style={{
                    marginTop: 6,
                    fontSize: 11,
                    color: '#ef4444',
                    lineHeight: 1.4
                  }}>
                    {PASSWORD_POLICY_MESSAGE}
                  </div>
                )}
              </div>
            )}

            {(registerForm.role === 'player' || registerForm.role === 'coach' || registerForm.role === 'league_manager') && (
              <div>
                <label style={labelStyle}>Registration Code</label>
                <input
                  value={registerForm.reg_code}
                  onChange={setR('reg_code')}
                  required
                  autoComplete="off"
                  style={inputStyle}
                />
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                  {getRegistrationCodeHint(registerForm.role)}
                </div>
              </div>
            )}
            <button
              type="submit"
              style={{
                marginTop: 6, padding: '10px 0', fontSize: 13, width: '100%',
                background: registerPasswordValid ? 'var(--orange)' : 'var(--bg-panel)',
                color: registerPasswordValid ? '#fff' : 'var(--text-muted)',
                border: '1px solid var(--border)', borderRadius: 8, fontWeight: 600,
                cursor: registerPasswordValid && !loading ? 'pointer' : 'not-allowed',
                opacity: loading ? 0.7 : 1
              }}
              disabled={loading || !registerPasswordValid}
            >
              {loading ? 'Registering...' : 'Create Account'}
            </button>
          </form>
        )}
      </div>

      {showForgotPassword && (
        <div
          onClick={resetForgotPasswordForm}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20, zIndex: 20
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 420, maxWidth: '100%', background: 'var(--bg-card)',
              border: '1px solid var(--border)', borderRadius: 12, padding: 24,
              boxShadow: '0 18px 48px rgba(0,0,0,0.35)'
            }}
          >
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', textAlign: 'center' }}>Reset Password</div>
            </div>

            {resetStep === 'email' && (
              <form onSubmit={handleForgotPassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--text-muted)', textAlign: 'center' }}>
                  Enter your email address to receive a verification code.
                </div>
                <div>
                  <label style={labelStyle}>Email</label>
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    required
                    autoComplete="off"
                    placeholder="name@example.com"
                    style={inputStyle}
                  />
                </div>
                <button
                  type="submit"
                  style={{
                    padding: '10px 0', fontSize: 13, width: '100%',
                    background: 'var(--orange)', color: '#fff', border: 'none',
                    borderRadius: 8, fontWeight: 600, cursor: 'pointer',
                    boxShadow: '0 6px 18px rgba(249, 115, 22, 0.18)'
                  }}
                  disabled={loading}
                >
                  {loading ? 'Sending...' : 'Send Verification Code'}
                </button>
              </form>
            )}

            {resetStep === 'reset' && (
              <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Verification Code</label>
                  <input
                    type="text"
                    value={resetOtp}
                    onChange={(e) => setResetOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    required
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="123456"
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>New Password</label>
                  <PasswordInput
                    id="reset-new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Confirm Password</label>
                  <PasswordInput
                    id="reset-confirm-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  style={{
                    padding: '10px 0', fontSize: 13, width: '100%',
                    background: 'var(--orange)', color: '#fff', border: 'none',
                    borderRadius: 8, fontWeight: 600, cursor: 'pointer',
                    boxShadow: '0 6px 18px rgba(249, 115, 22, 0.18)'
                  }}
                  disabled={loading}
                >
                  {loading ? 'Resetting...' : 'Reset Password'}
                </button>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                  <button
                    type="button"
                    onClick={resetForgotPasswordForm}
                    style={{ background: 'transparent', border: 'none', color: 'var(--orange)', cursor: 'pointer', fontWeight: 600, padding: 0, fontSize: 12 }}
                  >
                    Back to Login
                  </button>
                  <button
                    type="button"
                    onClick={handleResendCode}
                    style={{ background: 'transparent', border: 'none', color: 'var(--orange)', cursor: 'pointer', fontWeight: 600, padding: 0, fontSize: 12 }}
                  >
                    Resend code
                  </button>
                </div>
              </form>
            )}

            {resetMessage && (
              <div style={{
                marginTop: 12, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)',
                borderRadius: 6, padding: '8px 12px', fontSize: 12, color: 'var(--text)',
                textAlign: 'center'
              }}>{resetMessage}</div>
            )}
          </div>
        </div>
      )}

      {showResendVerification && (
        <div
          onClick={() => setShowResendVerification(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20, zIndex: 20
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: 420, maxWidth: '100%', background: 'var(--bg-card)',
              border: '1px solid var(--border)', borderRadius: 12, padding: 24,
              boxShadow: '0 18px 48px rgba(0,0,0,0.35)'
            }}
          >
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', textAlign: 'center' }}>Resend Verification Email</div>
            </div>
            <form onSubmit={handleSubmitResendVerification} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Email</label>
                <input
                  type="email"
                  value={resendEmail}
                  onChange={(event) => setResendEmail(event.target.value)}
                  autoFocus
                  autoComplete="email"
                  style={inputStyle}
                />
              </div>
              {resendMessage === 'Please enter your email first.' && (
                <div style={{ fontSize: 12, color: '#ef4444', textAlign: 'center' }}>
                  Please enter your email first.
                </div>
              )}
              <button
                type="submit"
                style={{
                  padding: '10px 0', fontSize: 13, width: '100%',
                  background: 'var(--orange)', color: '#fff', border: 'none',
                  borderRadius: 8, fontWeight: 600, cursor: 'pointer',
                  boxShadow: '0 6px 18px rgba(249, 115, 22, 0.18)'
                }}
              >
                Resend Verification Email
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}