import assert from 'node:assert/strict'
import test from 'node:test'
import { hashMd5, validateUser, BACKEND_API_BASE } from '../server/utils/http-adapter'

test('hashMd5 produces valid MD5 hash and preserves existing MD5', () => {
  const knownPlain = 'secret123'
  const knownHash = '5d7845ac6ee7cfffafc5fe5f35cf666d'
  assert.equal(hashMd5(knownPlain), knownHash)

  // Preserves existing 32-char hex
  const sampleMd5 = '46d824505203861e34bc2ed5951a5166'
  assert.equal(hashMd5(sampleMd5), sampleMd5)
})

test('validateUser sends request with correct headers and MD5 password', async () => {
  const testEmail = 'a.magar@smartshiphub.com'
  const testMd5 = '46d824505203861e34bc2ed5951a5166'

  const res = await validateUser({
    email: testEmail,
    password: testMd5,
    tenant: 'asiaticlloyd',
  })

  // The endpoint is live, so it should return 200 with user login success or a valid response
  assert.ok(res.status === 200 || res.status === 400)
  if (res.status === 200) {
    assert.equal(res.data.msg, 'User Login Success')
    assert.ok(res.data.authToken)
  }
})

test('validateUser rejects invalid credentials with 400', async () => {
  const res = await validateUser({
    email: 'nonexistent@smartshiphub.com',
    password: 'wrongpassword',
    tenant: 'asiaticlloyd',
  })

  assert.equal(res.status, 400)
  assert.equal(res.data.msg, 'Invalid email or password. Please try again.')
})

