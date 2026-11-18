const axios = require('axios')
;(async ()=>{
  try{
    const login = await axios.post('http://localhost:5000/api/auth/login', { username: 'admin', password: 'admin123' })
    const token = login.data.token
    // generate
    const gen = await axios.post('http://localhost:5000/api/bracket/generate', { league_id: 1, size: 4 }, { headers: { Authorization: `Bearer ${token}` } })
    console.log('generated bracket id(s):', gen.data.games.map(g=>g.bracket_id).filter(Boolean))
    const bracketId = gen.data.games[0].bracket_id
    // purge (soft)
    const purge = await axios.delete(`http://localhost:5000/api/bracket/1/purge`, { headers: { Authorization: `Bearer ${token}` } })
    console.log('purge response:', purge.data)
    // restore
    const restore = await axios.post(`http://localhost:5000/api/bracket/restore/${bracketId}`, {}, { headers: { Authorization: `Bearer ${token}` } })
    console.log('restore response:', restore.data)
    // fetch bracket
    const g = await axios.get('http://localhost:5000/api/bracket/1')
    console.log('GET bracket after restore ->', g.data.length, 'games')
  }catch(e){
    if (e.response) console.error('ERR', e.response.status, e.response.data)
    else console.error(e.message)
    process.exit(2)
  }
})()
