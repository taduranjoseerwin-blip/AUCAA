import { createContext, useContext, useState, useEffect } from 'react'
import axios from 'axios'

const storage = typeof window !== 'undefined' ? window.sessionStorage : null

const getStoredValue = (key) => {
  try {
    return storage ? storage.getItem(key) : null
  } catch (_) {
    return null
  }
}

const setStoredValue = (key, value) => {
  try {
    if (storage) storage.setItem(key, value)
  } catch (_) {}
  try {
    localStorage.removeItem(key)
  } catch (_) {}
}

const removeStoredValue = (key) => {
  try {
    if (storage) storage.removeItem(key)
  } catch (_) {}
  try {
    localStorage.removeItem(key)
  } catch (_) {}
}

const storedToken = getStoredValue('aucaa_token')
if (storedToken && !axios.defaults.headers.common['Authorization']) {
  axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`
}

let initialUser = null
const storedUser = getStoredValue('aucaa_user')
if (storedUser) {
  try {
    initialUser = JSON.parse(storedUser)
  } catch (_) {
    removeStoredValue('aucaa_user')
  }
}

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(initialUser)
  const [loading, setLoading] = useState(true)

  useEffect(() => setLoading(false), [])

  const login = async (username, password) => {
    const res = await axios.post('/api/auth/login', { username, password })
    const { token, session_id, user: userData } = res.data
    setStoredValue('aucaa_token', token)
    setStoredValue('aucaa_user', JSON.stringify(userData))
    setStoredValue('aucaa_session_id', session_id || '')
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
    setUser(userData)
    return userData
  }

  const register = async (data) => {
    const res = await axios.post('/api/auth/register', data)
    return res.data
  }

  const requestPasswordReset = async (username, email) => {
    const res = await axios.post('/api/auth/forgot-password', { username, email })
    return res.data
  }

  const verifyResetOtp = async (email, otp, username) => {
    const res = await axios.post('/api/auth/verify-otp', { email, otp, username })
    return res.data
  }

  const resetPassword = async ({ email, otp, username, password }) => {
    const res = await axios.post('/api/auth/reset-password', { email, otp, username, password })
    return res.data
  }

  const logout = () => {
    const token = getStoredValue('aucaa_token')
    if (token) {
      axios.post('/api/auth/logout', {}, {
        headers: { Authorization: `Bearer ${token}` }
      }).catch(() => {})
    }
    removeStoredValue('aucaa_token')
    removeStoredValue('aucaa_user')
    removeStoredValue('aucaa_session_id')
    delete axios.defaults.headers.common['Authorization']
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, register, requestPasswordReset, verifyResetOtp, resetPassword, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
