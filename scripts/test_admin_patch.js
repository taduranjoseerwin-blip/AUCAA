(async () => {
  try {
    const loginRes = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    })
    const loginData = await loginRes.json()
    console.log('login status', loginRes.status)
    console.log(loginData)
    const token = loginData.token
    if (!token) process.exit(1)

    const patchRes = await fetch('http://localhost:5000/api/admin/players/12', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ date_of_birth: '2019-02-20' })
    })
    console.log('patch status', patchRes.status)
    const txt = await patchRes.text()
    try { console.log(JSON.parse(txt)) } catch { console.log(txt) }
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
})()
