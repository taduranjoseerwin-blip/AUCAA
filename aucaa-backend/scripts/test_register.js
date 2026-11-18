const axios = require('axios')

async function testRegister() {
  try {
    const res = await axios.post('http://localhost:5000/api/auth/register', {
      username: 'coach',
      email: 'coach@aucaa.com',
      password: '12345',
      role: 'coach'
    })
    console.log('✅ Registration successful:', res.data)
  } catch (err) {
    console.error('❌ Registration error:', err.response?.data || err.message)
  }
}

testRegister()
