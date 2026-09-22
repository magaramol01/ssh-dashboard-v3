import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import { calculateSpeedReductionScenarios } from '../../../../marine/cii-calculator'
import { getVesselTelemetry } from '../../emissions/skills'

export const simulateSpeedReductionTool = (_tenant?: string) =>
  tool(
    async ({ vesselId, targetRating, year }) => {
      const y = year ?? new Date().getFullYear()
      const tel = getVesselTelemetry(vesselId, y)
      const boundaries = tel.boundaries || {
        superior_boundary: 3.42,
        lower_boundary: 4.65,
        upper_boundary: 5.92,
        inferior_boundary: 7.35,
        requiredCII: 5.25,
      }
      const rawScenarios = calculateSpeedReductionScenarios(tel.totalCo2Mt, tel.totalTransportWork, boundaries)
      const target = targetRating || 'C'
      const targetOrder = ['A', 'B', 'C', 'D', 'E']
      const targetRank = targetOrder.indexOf(target)

      // Design operating baseline speed is 14.0 knots
      const baseSpeed = 14.0
      const scenarios = rawScenarios.map((s) => ({
        ...s,
        speedKnots: Number((baseSpeed * (1 - s.reductionPercent / 100)).toFixed(1)),
      }))

      const recommended =
        scenarios.find((s) => {
          const rRank = targetOrder.indexOf(s.projectedRating)
          return rRank >= 0 && rRank <= targetRank
        }) || scenarios[1]

      return JSON.stringify({
        vesselId,
        vesselName: tel.vesselName,
        currentAttainedCii: tel.attainedCii,
        currentRating: tel.rating,
        targetRating: target,
        baseSpeedKnots: baseSpeed,
        scenarios,
        recommendedScenario: recommended,
        recommendationSummary: `A ${recommended.reductionPercent}% speed reduction (${recommended.speedKnots} kts) projects an Attained CII of ${recommended.projectedCii}, achieving Grade ${recommended.projectedRating} with ${recommended.co2SavingsMt} MT CO₂ saved.`,
      })
    },
    {
      name: 'simulate_vessel_speed_reduction',
      description:
        'Simulate hydrodynamic speed reduction scenarios (-5% to -25%) for a vessel and calculate projected CII rating improvement, fuel savings, and CO2 reduction. Use this whenever the operator asks how to improve a vessel rating, reduce speed, reach Grade C/B, or optimize voyage speed.',
      schema: z.object({
        vesselId: z.number().int().positive(),
        targetRating: z.enum(['A', 'B', 'C', 'D']).optional(),
        year: z.number().int().optional(),
      }),
    }
  )
