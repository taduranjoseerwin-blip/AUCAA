const axios = require('axios')
const db = require('../config/db')
let bracketId = null

const cleanup = async () => {
  if (!bracketId) return
  try {
    console.log('cleanup test data for bracket_id=', bracketId)
    await db.query('DELETE FROM games WHERE bracket_id = ?', [bracketId])
    await db.query('DELETE FROM bracket_audit WHERE bracket_id = ?', [bracketId])
    await db.query('DELETE FROM brackets WHERE bracket_id = ?', [bracketId])
    console.log('cleanup complete')
  } catch (cleanupErr) {
    console.error('cleanup failed:', cleanupErr.message)
  }
}

;(async ()=>{
  try{
    console.log('login')
    const login = await axios.post('http://localhost:5000/api/auth/login', { username: 'admin', password: 'admin123' })
    const token = login.data.token

    console.log('generate')
    const gen = await axios.post('http://localhost:5000/api/bracket/generate', { league_id: 1, size: 4 }, { headers: { Authorization: `Bearer ${token}` } })
    if (!gen.data || !gen.data.games || !gen.data.games.length) throw new Error('Generate returned no games')
    bracketId = gen.data.games[0].bracket_id
    console.log('generated bracket_id=', bracketId)

    console.log('purge')
    const purge = await axios.delete(`http://localhost:5000/api/bracket/1/purge`, { headers: { Authorization: `Bearer ${token}` } })
    if (!purge.data || (!purge.data.message && purge.status !== 200)) throw new Error('Purge failed')
    console.log('purge response:', purge.data)

    console.log('verify bracket is soft-deleted in DB')
    const [[brRow]] = await db.query('SELECT deleted_at FROM brackets WHERE bracket_id = ?', [bracketId])
    if (!brRow || !brRow.deleted_at) throw new Error('Bracket deleted_at not set after purge')

    console.log('check audit row for soft_delete')
    const [[auditCountRow]] = await db.query('SELECT COUNT(*) AS cnt FROM bracket_audit WHERE bracket_id = ? AND action = ?', [bracketId, 'soft_delete'])
    const cntSoft = auditCountRow?.cnt || 0
    if (cntSoft < 1) throw new Error('No soft_delete audit row found')
    console.log('soft_delete audit rows:', cntSoft)

    console.log('restore')
    const restore = await axios.post(`http://localhost:5000/api/bracket/restore/${bracketId}`, {}, { headers: { Authorization: `Bearer ${token}` } })
    if (!restore.data || restore.data.bracket_id != bracketId) throw new Error('Restore failed')
    console.log('restore response:', restore.data)

    console.log('verify bracket present')
    const afterRestore = await axios.get('http://localhost:5000/api/bracket/1')
    if (!Array.isArray(afterRestore.data) || afterRestore.data.length === 0) throw new Error('Bracket not present after restore')

    console.log('check audit row for restore')
    const [[auditRestoreRow]] = await db.query('SELECT COUNT(*) AS cnt FROM bracket_audit WHERE bracket_id = ? AND action = ?', [bracketId, 'restore'])
    const cntRestore = auditRestoreRow?.cnt || 0
    if (cntRestore < 1) throw new Error('No restore audit row found')
    console.log('restore audit rows:', cntRestore)

    console.log('TEST PASSED')
    process.exit(0)
  }catch(e){
    console.error('TEST FAILED:', e && (e.response ? (e.response.data || e.response.status) : e.message))
    process.exit(2)
  } finally {
    await cleanup()
  }
})()
