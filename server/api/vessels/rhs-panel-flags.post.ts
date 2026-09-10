import { defineEventHandler, readBody } from 'h3'
import { backendFetch } from '../../utils/http-adapter'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const res = await backendFetch('/prod/api/v1/updateRSHPanelFlag', {
    method: 'POST',
    body,
    event,
  })
  return res.data || { success: true }
})
