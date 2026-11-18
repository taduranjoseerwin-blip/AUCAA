const axios = require('axios')
;(async ()=>{
  try{
    const login = await axios.post('http://localhost:5000/api/auth/login', { username: 'admin', password: 'admin123' })
    const token = login.data.token
    console.log('got token')
    const gen = await axios.post('http://localhost:5000/api/bracket/generate', { league_id: 1, size: 4 }, { headers: { Authorization: `Bearer ${token}` } })
    console.log('generate result', gen.data)
  }catch(e){
    if (e.response) console.error('ERR', e.response.status, e.response.data)
    else console.error(e.message)
    process.exit(2)
  }
})()
