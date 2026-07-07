
import http from 'http'

const data = JSON.stringify({
  email: 'info@esoftwarestore.com',
  password: 'Code11login..'
})

const options = {
  hostname: 'localhost',
  port: 4000,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
}

const req = http.request(options, (res) => {
  let body = ''
  res.on('data', chunk => { body += chunk })
  res.on('end', () => {
    console.log('Status code:', res.statusCode)
    console.log('Response body:', body)
  })
})

req.on('error', (err) => {
  console.error('Error:', err.message)
})

req.write(data)
req.end()
