import type { H3Event } from 'h3'
import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import { backendFetch } from '../../../../http-adapter'
import { getVesselTelemetry } from '../../emissions/skills'
import { solveVoyageRecovery } from '../skills'

export const voyageRecoveryTool = (tenant?: string, event?: H3Event, injectedRecords?: any[]) =>
  tool(
    async ({ vesselId, targetRating, voyageNumber, year }) => {
      const y = year ?? new Date().getFullYear()
      const tel = getVesselTelemetry(vesselId, y)
      const target = targetRating || 'B'

      let rawRecords: any[] = injectedRecords || []
      if (!rawRecords.length) {
        try {
          if (voyageNumber) {
            const voyRes = await backendFetch<any[]>(
              `/prod/api/v1/cii/voyage?voyageNumber=${encodeURIComponent(voyageNumber)}&vesselId=${vesselId}&year=${y}`,
              { tenant, event }
            )
            if (voyRes.success && Array.isArray(voyRes.data) && voyRes.data.length > 0) {
              rawRecords = voyRes.data
            }
          }
          if (!rawRecords.length) {
            const res = await backendFetch<any[]>(
              `/prod/api/v1/cii/date-range?vesselId=${vesselId}&startDate=&endDate=&year=${y}&voyageType=all&type=byDate`,
              { tenant, event }
            )
            if (res.success && Array.isArray(res.data) && res.data.length > 0) {
              rawRecords = res.data
            }
          }
        } catch {
          // External API unreachable
        }
      }

      // Filter genuine noon reports
      const byDate = new Map<string, any>()
      for (const r of rawRecords) {
        const distance = parseFloat(r.distance) || 0
        if (distance <= 0) continue
        const portTypes = r.utilizationType?.portReportTypes
        if (Array.isArray(portTypes) && portTypes.includes(r.reportType)) continue
        const dateKey = String(r.reportDateTime || '').slice(0, 10)
        if (!dateKey) continue
        const existing = byDate.get(dateKey)
        if (!existing || distance > (parseFloat(existing.distance) || 0)) byDate.set(dateKey, r)
      }

      const sorted = [...byDate.values()].sort(
        (a, b) => new Date(a.reportDateTime).getTime() - new Date(b.reportDateTime).getTime()
      )

      if (!sorted.length) {
        return JSON.stringify({
          vesselId,
          found: false,
          message: 'No noon-report data available for the requested voyage or date range.',
        })
      }

      const pastDistanceNm = sorted.reduce((acc, r) => acc + (parseFloat(r.distance) || 0), 0)
      const pastCo2Mt = sorted.reduce(
        (acc, r) => acc + (parseFloat(r.massOfCo2) || (parseFloat(r.totalConsumption) || 0) * 3.114),
        0
      )

      const latest = sorted[sorted.length - 1]
      const remainingRaw = latest?.noonreportdata?.Distance_Remaining_To_EOV || latest?.distancetogo
      const distanceToGoNm = remainingRaw ? parseFloat(remainingRaw) || 0 : 0

      if (distanceToGoNm <= 0) {
        return JSON.stringify({
          vesselId,
          found: false,
          message: 'No remaining distance to end of voyage reported in noon data.',
        })
      }

      if (!tel.deadweight || tel.deadweight <= 0) {
        return JSON.stringify({
          vesselId,
          found: false,
          message: 'Vessel deadweight metric is missing, cannot calculate CII transport work.',
        })
      }

      const boundaries = tel.boundaries
      if (!boundaries) {
        return JSON.stringify({
          vesselId,
          found: false,
          message: 'Vessel CII rating boundaries not configured for calculation.',
        })
      }

      const totalPastSteamingHours = sorted.reduce(
        (acc, r) => acc + (parseFloat(r.steamingHours ?? r.noonreportdata?.ME_Running_Hrs) || 24),
        0
      )
      const baselineSpeed =
        totalPastSteamingHours > 0 && pastDistanceNm > 0
          ? Number((pastDistanceNm / totalPastSteamingHours).toFixed(1))
          : Number(
              (
                sorted.reduce((acc, r) => acc + (parseFloat(r.avgSpeed ?? r.noonreportdata?.Avg_Speed) || 0), 0) /
                sorted.length
              ).toFixed(1)
            )

      if (baselineSpeed <= 0) {
        return JSON.stringify({
          vesselId,
          found: false,
          message: 'Cannot determine baseline steaming speed from active voyage records.',
        })
      }

      const totalRpm = sorted.reduce(
        (acc, r) => acc + (parseFloat(r.rpm ?? r.noonreportdata?.ME_RPM ?? r.noonreportdata?.RPM) || 0),
        0
      )
      const validRpmCount = sorted.filter((r) => parseFloat(r.rpm ?? r.noonreportdata?.ME_RPM ?? r.noonreportdata?.RPM) > 0).length
      const baselineRpm = validRpmCount > 0 ? Math.round(totalRpm / validRpmCount) : 80

      const pastFuelMt = pastCo2Mt > 0 ? pastCo2Mt / 3.114 : sorted.reduce((acc, r) => acc + (parseFloat(r.totalConsumption ?? r.noonreportdata?.Total_HFO_Consumed_In_MT) || 0), 0)
      const dailyFuelBase =
        totalPastSteamingHours > 0
          ? Number(((pastFuelMt / totalPastSteamingHours) * 24).toFixed(1))
          : Number((pastFuelMt / sorted.length).toFixed(1))

      const recovery = solveVoyageRecovery({
        remainingDistanceNm: distanceToGoNm,
        pastCo2Mt,
        pastDistanceNm,
        dwt: tel.deadweight,
        targetRating: target,
        boundaries,
        baselineSpeedKts: baselineSpeed,
        baselineRpm,
        dailyFuelBaseMt: dailyFuelBase,
      })

      // Generate alternative speed reduction options (-5%, -10%, -15%, -20%)
      const alternativeOptions = [5, 10, 15, 20].map((cutPct) => {
        const speed = Number((baselineSpeed * (1 - cutPct / 100)).toFixed(1))
        const rpm = Math.round(baselineRpm * (1 - cutPct / 100))
        const dailyFuel = Number((dailyFuelBase * Math.pow(speed / baselineSpeed, 3)).toFixed(1))
        const hours = Number((distanceToGoNm / speed).toFixed(1))
        const baseHours = distanceToGoNm / baselineSpeed
        const etaDelay = Number(Math.max(0, hours - baseHours).toFixed(1))
        const remFuel = Number((dailyFuel * (hours / 24)).toFixed(1))
        const remCo2 = remFuel * 3.114
        const totalWork = (pastDistanceNm + distanceToGoNm) * tel.deadweight
        const projCii = Number((((pastCo2Mt + remCo2) * 1e6) / totalWork).toFixed(2))

        let projRating = 'E'
        if (projCii <= boundaries.superior_boundary) projRating = 'A'
        else if (projCii <= boundaries.lower_boundary) projRating = 'B'
        else if (projCii <= boundaries.upper_boundary) projRating = 'C'
        else if (projCii <= boundaries.inferior_boundary) projRating = 'D'

        const baseRemFuel = dailyFuelBase * (baseHours / 24)
        const fuelSaved = Number(Math.max(0, baseRemFuel - remFuel).toFixed(1))

        return {
          reductionPercent: cutPct,
          speedKnots: speed,
          engineRpm: rpm,
          dailyFuelMt: dailyFuel,
          etaDelayHours: etaDelay,
          fuelSavedMt: fuelSaved,
          projectedFinalCii: projCii,
          projectedFinalRating: projRating,
        }
      })

      const recommendedActionSummary = recovery.isFeasible
        ? `To recover IMO Grade ${target}, reduce speed to ${recovery.recommendedSpeedKts} kts (${recovery.speedReductionPercent}% cut) and adjust main engine to ~${recovery.recommendedRpm} RPM. This projects an Attained CII of ${recovery.projectedFinalCii} (Grade ${recovery.projectedFinalRating}), saving ${recovery.fuelSavedMt} MT fuel (${recovery.co2SavedMt} MT CO₂) with an ETA delay of ${recovery.etaDelayHours} hours.`
        : `Achieving Grade ${target} across the remaining ${distanceToGoNm} NM is constrained by safe steerage limits. Recommended safest operational adjustment is ${recovery.recommendedSpeedKts} kts (~${recovery.recommendedRpm} RPM), yielding projected Grade ${recovery.projectedFinalRating} (CII ${recovery.projectedFinalCii}).`

      return JSON.stringify({
        vesselId,
        vesselName: tel.vesselName,
        voyageNumber: voyageNumber || `VOY-${y}-${vesselId}`,
        targetRating: target,
        currentStatus: {
          pastDistanceNm,
          distanceToGoNm,
          currentAttainedCii: tel.attainedCii,
          currentRating: tel.rating,
          baselineSpeedKts: baselineSpeed,
          baselineRpm,
        },
        isRecoveryFeasible: recovery.isFeasible,
        recommendedPlan: {
          ...recovery,
          recommendedActionSummary,
        },
        alternativeOptions,
      })
    },
    {
      name: 'calculate_voyage_recovery_plan',
      description:
        'Calculate actionable operational recovery options for the remaining passage to recover or maintain IMO Band B or C. Computes required speed over ground, recommended engine RPM, daily fuel consumption limits, projected final voyage CII score, and ETA impact across the remaining distance to go.',
      schema: z.object({
        vesselId: z.number().int().positive().describe('Unique numerical ID of the vessel'),
        targetRating: z.enum(['A', 'B', 'C', 'D']).default('B').describe('Target IMO CII rating band to achieve'),
        voyageNumber: z.string().trim().max(60).optional().describe('Voyage identification number if known'),
        year: z.number().int().optional().describe('Operational calendar year'),
      }),
    }
  )
