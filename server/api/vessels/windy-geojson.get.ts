import { defineEventHandler, getQuery } from 'h3'
import { backendFetch } from '../../utils/http-adapter'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const vesselId = query.vesselId || '28'
  const res = await backendFetch(`/prod/api/v1/getWindyMapGeoJson?vesselId=${vesselId}`, {
    method: 'GET',
    event,
  })
  return res.data || {}
})
