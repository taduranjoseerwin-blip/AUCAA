const db = require('../config/db')
;(async ()=>{
  try{
    const [tables] = await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'brackets'")
    console.log('brackets table exists:', tables.length>0)
    const [cols] = await db.query("SELECT column_name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'games' AND column_name = 'bracket_id'")
    console.log('games.bracket_id exists:', cols.length>0)
    process.exit(0)
  }catch(e){console.error(e); process.exit(2)}
})()
