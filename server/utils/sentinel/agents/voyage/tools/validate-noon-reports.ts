import type { H3Event } from 'h3'
import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import { backendFetch } from '../../../../http-adapter'
import { getVesselTelemetry } from '../../emissions/skills'
import {
  validateNoonReportData,
  resolveCoordinate,
  type NoonReportValidationInput,
  type NoonValidationResult,
} from '../skills'

export const validateNoonReportsTool = (tenant?: string, event?: H3Event, injectedRecords?: any[]) =>
  tool(
    async ({ vesselId, voyageNumber, dayNumber, year }) => {
      const y = year ?? new Date().getFullYear()
      const tel = getVesselTelemetry(vesselId, y)

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

      const validationInputs: NoonReportValidationInput[] = []

      if (sorted.length > 0) {
        let prevLat: number | undefined
        let prevLng: number | undefined

        sorted.forEach((r, idx) => {
          const lat = resolveCoordinate(r.noonreportdata?.Latitude)
          const lng = resolveCoordinate(r.noonreportdata?.Longitude)
          const distance = parseFloat(r.distance ?? r.noonreportdata?.Distance) || 0
          const sog = parseFloat(r.avgSpeed ?? r.noonreportdata?.Avg_Speed) || 0
          const rpm = parseFloat(r.rpm ?? r.noonreportdata?.ME_RPM ?? r.noonreportdata?.RPM) || 0
          const meFuel = parseFloat(r.meFuel ?? r.noonreportdata?.Total_HFOME_Consumed_In_MT ?? r.noonreportdata?.ME_Fuel_Oil_Cons) || 0
          const aeFuel = parseFloat(r.aeFuel ?? r.noonreportdata?.Total_HFOAE_Consumed_In_MT ?? r.noonreportdata?.DG_Fuel_Oil_Cons) || 0
          const blrFuel = parseFloat(r.boilerFuel ?? r.noonreportdata?.Total_HFOBLR_Consumed_In_MT ?? r.noonreportdata?.Boiler_Fuel_Oil_Cons) || 0
          const totalFuel = parseFloat(r.totalConsumption ?? r.noonreportdata?.Total_HFO_Consumed_In_MT) || (meFuel + aeFuel + blrFuel)
          const windBf = parseFloat(r.noonreportdata?.Wind_Force) || 0
          const windSpeed = parseFloat(r.noonreportdata?.Wind_Speed) || 0
          const waveHeight = parseFloat(r.noonreportdata?.Wave_Height) || 0

          validationInputs.push({
            vesselId,
            reportDate: r.reportDateTime || `Day ${idx + 1}`,
            steamingHours: parseFloat(r.steamingHours) || 24.0,
            distance,
            sog,
            rpm,
            meFuelMt: meFuel,
            aeFuelMt: aeFuel,
            boilerFuelMt: blrFuel,
            totalFuelMt: totalFuel,
            lat: Number.isNaN(lat) ? undefined : lat,
            lng: Number.isNaN(lng) ? undefined : lng,
            prevLat,
            prevLng,
            windBf,
            windSpeedKts: windSpeed,
            waveHeightM: waveHeight,
          })

          if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
            prevLat = lat
            prevLng = lng
          }
        })
      } else {
        return JSON.stringify({
          vesselId,
          found: false,
          message: 'No noon-report data available for the requested voyage or date range.',
        })
      }

      // Filter by day if requested
      const targets =
        dayNumber && dayNumber >= 1 && dayNumber <= validationInputs.length
          ? [validationInputs[dayNumber - 1]!]
          : validationInputs

      const validations: NoonValidationResult[] = targets.map((input) => validateNoonReportData(input))

      // Overall Chief Engineer audit summary
      const totalCritical = validations.reduce((acc, v) => acc + v.counts.critical, 0)
      const totalErrors = validations.reduce((acc, v) => acc + v.counts.error, 0)
      const totalWarnings = validations.reduce((acc, v) => acc + v.counts.warning, 0)

      let voyageAuditStatus: 'APPROVE' | 'APPROVE WITH REMARKS' | 'RETURN FOR CORRECTION' = 'APPROVE'
      if (totalCritical > 0 || totalErrors > 0) {
        voyageAuditStatus = 'RETURN FOR CORRECTION'
      } else if (totalWarnings > 0) {
        voyageAuditStatus = 'APPROVE WITH REMARKS'
      }

      const allFindings = validations.flatMap((v) => v.findings)
      const allActions = Array.from(new Set(validations.flatMap((v) => v.recommendedActions)))

      return JSON.stringify({
        vesselId,
        vesselName: tel.vesselName,
        voyageNumber: voyageNumber || `VOY-${y}-${vesselId}`,
        evaluatedReportsCount: validations.length,
        voyageAuditStatus,
        summaryCounts: {
          critical: totalCritical,
          error: totalErrors,
          warning: totalWarnings,
        },
        dailyValidations: validations.map((v, idx) => ({
          dayNumber: dayNumber || idx + 1,
          date: v.reportDate,
          status: v.overallStatus,
          findings: v.findings,
          calculations: v.calculations,
        })),
        allFindings,
        chiefEngineerRecommendations: allActions,
      })
    },
    {
      name: 'validate_vessel_noon_reports',
      description:
        'Validate vessel noon reports like an experienced Chief Engineer, auditing internal consistency, Great-Circle geodesic distance, apparent propeller slip, steaming hours, fuel balances (ME + AE + Boiler vs total), wind-Beaufort correlation, and emissions. Returns APPROVE, APPROVE WITH REMARKS, or RETURN FOR CORRECTION with granular rule findings and actionable recommendations.',
      schema: z.object({
        vesselId: z.number().int().positive().describe('Unique numerical ID of the vessel'),
        voyageNumber: z.string().trim().max(60).optional().describe('Voyage identification number if known'),
        dayNumber: z.number().int().positive().optional().describe('Specific voyage day number (e.g. 1) to audit'),
        year: z.number().int().optional().describe('Operational calendar year'),
      }),
    }
  )
