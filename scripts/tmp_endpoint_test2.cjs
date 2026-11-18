const http = require('http')

const loginData = JSON.stringify({ username: 'admin', password: 'admin123' })

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }))
    })
    req.on('error', reject)
    if (body) req.write(body)
    req.end()
  })
}

;(async () => {
  const login = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(loginData)
    }
  }, loginData)
  console.log('LOGIN', login.status, login.body)
  const token = JSON.parse(login.body).token
  console.log('Token', Boolean(token))

  const postLink = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/admin/highlight-link',
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(JSON.stringify({ link: null, title: 'test', image: null }))
    }
  }, JSON.stringify({ link: null, title: 'test', image: null }))
  console.log('POST HIGHLIGHT LINK', postLink.status, postLink.body)

  const postImage = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/admin/highlight-image',
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'multipart/form-data; boundary=----WebKitFormBoundary'
    }
  })
  console.log('POST HIGHLIGHT IMAGE', postImage.status, postImage.body)
})().catch(console.error)
