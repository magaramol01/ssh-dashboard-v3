import { defineEventHandler } from 'h3'
import { backendFetch } from '../../utils/http-adapter'

export default defineEventHandler(async (event) => {
  const res = await backendFetch('/prod/api/v1/getShipData', {
    method: 'POST',
    event,
  })
  return Array.isArray(res.data) ? res.data : []
})
