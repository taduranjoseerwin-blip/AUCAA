const db = require('../config/db');

const addColumnIfMissing = async (columnName, columnDefinition) => {
  const [rows] = await db.query(
    `SELECT COUNT(*) AS cnt FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'players' AND column_name = ?`,
    [columnName]
  )
  if (rows[0].cnt === 0) {
    await db.query(`ALTER TABLE players ADD COLUMN ${columnDefinition}`)
    console.log(`added ${columnName}`)
  } else {
    console.log(`${columnName} already exists`)
  }
}

;(async () => {
  try {
    await addColumnIfMissing('barangay_lat', 'barangay_lat DECIMAL(10,8) NULL')
    await addColumnIfMissing('barangay_lng', 'barangay_lng DECIMAL(11,8) NULL')
    await addColumnIfMissing('barangay_place_id', 'barangay_place_id VARCHAR(255) NULL')
  } catch (e) {
    console.error(e)
    process.exit(1)
  }
  process.exit(0)
})()
