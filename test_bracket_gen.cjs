require('dotenv').config()
const axios = require('axios')
const jwt = require('jsonwebtoken')

;(async () => {
  try {
    // Create a valid JWT token with admin privileges
    const token = jwt.sign({ id: 1, role: 'admin' }, process.env.JWT_SECRET || 'test_secret')
    
    console.log('Testing bracket generation for league 1 with size 2...')
    const res = await axios.post('http://localhost:5000/api/bracket/generate', 
      { league_id: 1, size: 2 }, 
      { headers: { Authorization: `Bearer ${token}` } }
    )
    console.log('✅ Success:', res.data)
    process.exit(0)
  } catch(err) {
    console.error('❌ Error:', err?.response?.data || err.message)
    if (err.response?.status) console.error('Status:', err.response.status)
    process.exit(1)
  }
})()
