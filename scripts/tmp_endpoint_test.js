const http = require('http');
const loginData = JSON.stringify({ username: 'admin', password: 'admin123' });

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

(async () => {
  try {
    console.log('Logging in...');
    const login = await request({ hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(loginData) } }, loginData);
    console.log('LOGIN', login.status, login.body);
    let token = null;
    try { token = JSON.parse(login.body).token; } catch (e) { console.error('Login response parse error', e.message); }
    console.log('Token:', token);

    console.log('Getting highlight-link...');
    const highlightLink = await request({ hostname: 'localhost', port: 5000, path: '/api/admin/highlight-link', method: 'GET', headers: token ? { Authorization: `Bearer ${token}` } : {} });
    console.log('HIGHLIGHT-LINK', highlightLink.status, highlightLink.body);

    console.log('Sending image upload without body...');
    const upload = await request({ hostname: 'localhost', port: 5000, path: '/api/admin/highlight-image', method: 'POST', headers: { Authorization: token ? `Bearer ${token}` : '', 'Content-Type': 'multipart/form-data; boundary=----WebKitFormBoundary' } });
    console.log('UPLOAD', upload.status, upload.body);
  } catch (err) {
    console.error('ERROR', err);
  }
})();
