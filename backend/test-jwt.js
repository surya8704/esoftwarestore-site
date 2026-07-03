
import Fastify from 'fastify'
import jwt from '@fastify/jwt'

async function test() {
  const app = Fastify({ logger: false })
  await app.register(jwt, { secret: 'test-secret' })
  
  console.log('App has jwt property:', !!app.jwt)
  if (app.jwt) {
    console.log('app.jwt.sign is function:', typeof app.jwt.sign === 'function')
    console.log('app.jwt.verify is function:', typeof app.jwt.verify === 'function')
  }

  app.get('/test', async (request, reply) => {
    console.log('request.jwtVerify exists:', typeof request.jwtVerify === 'function')
    console.log('request.jwt exists:', !!request.jwt)
    return { ok: true }
  })

  // Test sign
  const token = app.jwt.sign({ sub: '123', email: 'test@test.com', role: 'admin' })
  console.log('Generated token:', token)

  // Test verify
  const decoded = app.jwt.verify(token)
  console.log('Decoded token:', decoded)
}

test().catch(console.error)
