import { defineEventHandler } from 'h3'
import { backendFetch } from '../../utils/http-adapter'

export default defineEventHandler(async (event) => {
  const res = await backendFetch('/prod/api/v1/getRHSPanalFlag', {
    method: 'GET',
    event,
  })
  return res.data?.panelFlags || []
})
