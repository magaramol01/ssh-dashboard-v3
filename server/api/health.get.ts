import { createError, defineEventHandler, getQuery } from 'h3'
import { getVesselHealth } from '../utils/marine/health'

export default defineEventHandler(async (event) => {
  const rawVesselId = getQuery(event).vesselId
  const vesselId = Number(Array.isArray(rawVesselId) ? rawVesselId[0] : rawVesselId)
  if (!Number.isInteger(vesselId) || vesselId < 1) {
    throw createError({ statusCode: 400, statusMessage: 'vesselId must be a positive integer' })
  }

  try {
    const health = await getVesselHealth(vesselId, event.context.tenant)
    if (!health) throw createError({ statusCode: 404, statusMessage: 'Vessel not found' })
    return health
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    console.error('Vessel health query failed', error)
    throw createError({ statusCode: 503, statusMessage: 'Vessel health is unavailable' })
  }
})
