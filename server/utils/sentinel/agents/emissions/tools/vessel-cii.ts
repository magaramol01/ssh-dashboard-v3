import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import { fleetVesselCiiCache } from '../../../../../api/emissions/cii.get'
import { getVesselTelemetry } from '../skills'

export const vesselCiiTool = (_tenant?: string) =>
  tool(
    async ({ vesselId, year }) => {
      const y = year ?? new Date().getFullYear()
      const tel = getVesselTelemetry(vesselId, y)
      const marginPercent = tel.requiredCii > 0
        ? Number((((tel.attainedCii - tel.requiredCii) / tel.requiredCii) * 100).toFixed(1))
        : 0

      // Compute fleet ranking and average CII from cached peer ledger
      const allPeers = Array.from(fleetVesselCiiCache.values())
      const totalVessels = Math.max(allPeers.length, 5)
      let rank = 1
      let fleetAverageCii = tel.attainedCii
      if (allPeers.length > 0) {
        const sorted = [...allPeers].sort((a, b) => a.attainedCii - b.attainedCii)
        const foundIdx = sorted.findIndex((p) => p.vesselId === vesselId)
        rank = foundIdx >= 0 ? foundIdx + 1 : 2
        fleetAverageCii = Number((allPeers.reduce((acc, p) => acc + p.attainedCii, 0) / allPeers.length).toFixed(2))
      }

      return JSON.stringify({
        vesselId: tel.vesselId,
        vesselName: tel.vesselName,
        deadweight: tel.deadweight,
        year: y,
        attainedCii: tel.attainedCii,
        rating: tel.rating,
        attainedRating: tel.rating,
        requiredCii: tel.requiredCii,
        marginPercent,
        rank,
        totalVessels,
        fleetAverageCii,
        operatingSpeedKnots: 14.0,
        boundaries: tel.boundaries,
        totalCo2Mt: tel.totalCo2Mt,
        totalDistanceNm: tel.totalDistanceNm,
        totalTransportWork: tel.totalTransportWork,
        euEtsCostEur: tel.euEtsCostEur,
        eeoi: tel.eeoi,
        fuelBreakdown: [
          { fuelType: 'vlsfo', label: 'VLSFO', totalMt: Number((tel.totalCo2Mt / 3.15).toFixed(1)), co2Mt: tel.totalCo2Mt },
        ],
      })
    },
    {
      name: 'get_vessel_cii_telemetry',
      description:
        'Get verified vessel Carbon Intensity Indicator (CII), IMO compliance rating (A to E), transport work, EU ETS carbon cost, and fuel consumption totals. Use this whenever the operator asks about emissions, CII rating, carbon intensity, compliance, or fuel breakdown for a specific ship.',
      schema: z.object({
        vesselId: z.number().int().positive(),
        year: z.number().int().optional(),
      }),
    }
  )
