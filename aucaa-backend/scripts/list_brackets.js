const db = require('../config/db')
;(async ()=>{
  try{
    const [br] = await db.query("SELECT * FROM brackets WHERE league_id = 1 ORDER BY created_at DESC")
    console.log('brackets:', br)
    const [g] = await db.query("SELECT * FROM games WHERE league_id = 1 AND bracket_round IS NOT NULL ORDER BY game_id")
    console.log('games with bracket_round:', g)
    const [g2] = await db.query("SELECT * FROM games WHERE bracket_id IS NOT NULL ORDER BY game_id")
    console.log('games with bracket_id:', g2)
    process.exit(0)
  }catch(e){console.error(e); process.exit(2)}
})()
