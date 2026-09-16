import { defineEventHandler, getQuery } from 'h3'
import { backendFetch } from '../../utils/http-adapter'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const vesselId = query.vesselId || '1'
  const startDate = query.startDate
  const endDate = query.endDate
  const year = query.year || new Date().getUTCFullYear()
  const voyageType = query.voyageType || 'all'

  const endpoint = `/prod/api/v1/cii/date-range?vesselId=${vesselId}&startDate=${startDate}&endDate=${endDate}&year=${year}&voyageType=${voyageType}&type=byDate`
  const res = await backendFetch<unknown[]>(endpoint, { event })

  return {
    success: res.success,
    records: res.success && Array.isArray(res.data) ? res.data : [],
  }
})
