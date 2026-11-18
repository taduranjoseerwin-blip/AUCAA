const fs = require('fs')
const http = require('http')
const FormData = global.FormData || require('form-data')

async function login() {
  const body = JSON.stringify({ username: 'admin', password: 'admin123' })
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port: 5000, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, res => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          const json = JSON.parse(data)
          resolve(json.token)
        } catch (err) {
          reject(new Error('Login failed: ' + data))
        }
      })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

async function upload(token) {
  const form = new FormData()
  form.append('image', fs.createReadStream('dummy.png'))

  const boundary = form.getBoundary()
  const headers = Object.assign({ Authorization: `Bearer ${token}` }, form.getHeaders())
  const req = http.request({ hostname: '127.0.0.1', port: 5000, path: '/api/admin/highlight-image', method: 'POST', headers }, res => {
    let data = ''
    res.on('data', chunk => data += chunk)
    res.on('end', () => {
      console.log('STATUS', res.statusCode)
      console.log('HEADERS', res.headers)
      console.log('BODY', data)
    })
  })
  req.on('error', err => console.error('REQUEST ERROR', err))
  form.pipe(req)
}

login().then(token => {
  console.log('TOKEN', token)
  return upload(token)
}).catch(err => console.error('ERR', err))
