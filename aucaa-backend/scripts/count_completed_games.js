const db = require('../config/db')
;(async ()=>{
  try{
    const [rows] = await db.query("SELECT COUNT(*) AS cnt FROM games WHERE league_id = 1 AND status='completed'")
    console.log(rows[0])
    process.exit(0)
  }catch(e){console.error(e); process.exit(2)}
})()
