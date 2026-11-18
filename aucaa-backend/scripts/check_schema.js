const db = require('./config/db')

async function checkSchema() {
  try {
    const [columns] = await db.query('DESCRIBE users')
    console.log('Users table schema:')
    columns.forEach(col => {
      console.log(`${col.Field}: ${col.Type} ${col.Null} ${col.Key} ${col.Default}`)
    })
  } catch (err) {
    console.error('Error:', err.message)
  } finally {
    process.exit(0)
  }
}

checkSchema()
