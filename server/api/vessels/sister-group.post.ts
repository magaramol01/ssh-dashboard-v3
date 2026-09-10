import { defineEventHandler, readBody } from 'h3'
import { backendFetch } from '../../utils/http-adapter'

export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => ({}))
  const payload = { id: body?.id || 'Select All' }
  const res = await backendFetch('/prod/api/v1/getShipBySisterGroup', {
    method: 'POST',
    body: payload,
    event,
  })
  return res.data || []
})
