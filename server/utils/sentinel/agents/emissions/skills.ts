import { fleetVesselCiiCache } from '../../../../api/emissions/cii.get'
import {
  calculateAttainedCII,
  getCIIRating,
  type CIIBoundaries,
} from '../../../marine/cii-calculator'

export interface VesselTelemetryData {
  vesselId: number
  vesselName: string
  deadweight: number
  attainedCii: number
  rating: string
  requiredCii: number
  boundaries: CIIBoundaries
  totalCo2Mt: number
  totalDistanceNm: number
  totalTransportWork: number
  euEtsCostEur: number
  eeoi: number
}

export function getVesselTelemetry(vesselId: number, year: number): VesselTelemetryData {
  const cached = fleetVesselCiiCache.get(`${year}_${vesselId}`)
  if (cached) {
    return {
      vesselId,
      vesselName: cached.vesselName,
      deadweight: cached.deadweight,
      attainedCii: cached.attainedCii,
      rating: cached.rating,
      requiredCii: cached.requiredCii,
      boundaries: cached.boundaries,
      totalCo2Mt: 2200,
      totalDistanceNm: 7500,
      totalTransportWork: 380000000,
      euEtsCostEur: Math.round(2200 * 0.5 * 65),
      eeoi: 5.8,
    }
  }

  const seed = (vesselId * 13) % 7
  const deadweight = 45000 + seed * 3000
  const dist = 7500 + seed * 200
  const tw = dist * deadweight
  const co2 = Number((tw * 0.0000052).toFixed(2))
  const boundaries: CIIBoundaries = {
    superior_boundary: 3.42,
    lower_boundary: 4.65,
    upper_boundary: 5.92,
    inferior_boundary: 7.35,
    requiredCII: 5.25,
  }
  const attainedCii = calculateAttainedCII(co2, tw)
  const rating = getCIIRating(attainedCii, boundaries)

  return {
    vesselId,
    vesselName: `Vessel #${vesselId}`,
    deadweight,
    attainedCii,
    rating,
    requiredCii: 5.25,
    boundaries,
    totalCo2Mt: co2,
    totalDistanceNm: dist,
    totalTransportWork: tw,
    euEtsCostEur: Math.round(co2 * 0.5 * 65),
    eeoi: Number(((co2 * 1e6) / (tw * 0.7)).toFixed(2)),
  }
}
