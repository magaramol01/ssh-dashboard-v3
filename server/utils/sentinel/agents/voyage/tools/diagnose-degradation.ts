import type { H3Event } from 'h3'
import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import { backendFetch } from '../../../../http-adapter'
import { getVesselTelemetry } from '../../emissions/skills'
import { classifyDegradedDay, calculateApparentSlip } from '../skills'

export const diagnoseDegradationTool = (tenant?: string, event?: H3Event, injectedRecords?: any[]) =>
  tool(
    async ({ vesselId, voyageNumber, targetDayNumber, year }) => {
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

      interface ProcessedDay {
        dayNumber: number
        dateIso: string
        rating: string
        dailyCii: number
        sog: number
        stw: number
        rpm: number
        windBf: number
        waveHeightM: number
        seaState: string
        slipPct: number
        fuelConsumptionMt: number
        primaryRootCause: string
        causeAnalysis: string
      }

      const days: ProcessedDay[] = []

      if (sorted.length > 0) {
        sorted.forEach((r, idx) => {
          const dayNumber = idx + 1
          const rating = r.CIIRating?.rating || r.rating || 'Unknown'
          const dailyCii = parseFloat(r.attainedCII || r.dailyCII) || 0
          const sog = parseFloat(r.avgSpeed ?? r.noonreportdata?.Avg_Speed) || 0
          const stw = parseFloat(r.engineSpeed ?? r.noonreportdata?.LOG_SPEED) || sog
          const rpm = parseFloat(r.rpm ?? r.noonreportdata?.ME_RPM ?? r.noonreportdata?.RPM) || 0
          const windBf = parseFloat(r.noonreportdata?.Wind_Force) || 0
          const waveHeightM = parseFloat(r.noonreportdata?.Wave_Height) || 0
          const slipPct = calculateApparentSlip(sog, stw)
          const fuel = parseFloat(r.totalConsumption ?? r.noonreportdata?.Total_HFO_Consumed_In_MT) || 0

          const classification = classifyDegradedDay({
            rating,
            windBf,
            waveHeightM,
            slipPct,
            sog,
            rpm,
          })

          days.push({
            dayNumber,
            dateIso: r.reportDateTime || '',
            rating,
            dailyCii: Number(dailyCii.toFixed(2)),
            sog: Number(sog.toFixed(1)),
            stw: Number(stw.toFixed(1)),
            rpm: Number(rpm.toFixed(1)),
            windBf,
            waveHeightM: Number(waveHeightM.toFixed(1)),
            seaState: waveHeightM >= 4 ? 'Rough / High Seas' : waveHeightM >= 2.5 ? 'Moderate to Rough' : 'Slight',
            slipPct,
            fuelConsumptionMt: Number(fuel.toFixed(1)),
            primaryRootCause: classification.primaryRootCause,
            causeAnalysis: classification.causeAnalysis,
          })
        })
      } else {
        return JSON.stringify({
          vesselId,
          found: false,
          message: 'No noon-report data available for the requested voyage or date range.',
        })
      }

      // Filter by target day if specified, or pick all degraded days (D and E ratings)
      let degradedDays = days.filter((d) => d.rating === 'D' || d.rating === 'E')
      if (targetDayNumber) {
        degradedDays = days.filter((d) => d.dayNumber === targetDayNumber)
      }

      // Generate overall synthesis
      let overallDiagnosis = ''
      if (degradedDays.length === 0) {
        overallDiagnosis = `No significant performance degradation observed. All ${days.length} voyage days maintained compliant IMO ratings (A, B, or C) within baseline hydrodynamic tolerances.`
      } else {
        const weatherCauses = degradedDays.filter((d) => d.primaryRootCause === 'heavy_weather').length
        const slipCauses = degradedDays.filter((d) => d.primaryRootCause === 'high_slip_resistance').length

        overallDiagnosis = `Identified ${degradedDays.length} degraded day(s) out of ${days.length} total passage days. `
        if (weatherCauses > 0) {
          overallDiagnosis += `Adverse weather conditions (Beaufort 6+ and high seas) were the primary driver on ${weatherCauses} day(s), causing wave-induced speed loss and elevated fuel burn. `
        }
        if (slipCauses > 0) {
          overallDiagnosis += `Elevated propeller slip (>15%) contributed on ${slipCauses} day(s), indicating high hull resistance. `
        }
      }

      return JSON.stringify({
        vesselId,
        vesselName: tel.vesselName,
        voyageNumber: voyageNumber || `VOY-${y}-${vesselId}`,
        totalVoyageDays: days.length,
        degradedDayCount: degradedDays.length,
        degradedDays,
        overallDiagnosis: overallDiagnosis.trim(),
      })
    },
    {
      name: 'diagnose_voyage_degradation',
      description:
        'Diagnose days on the voyage where performance or CII rating degraded to Band D or E, or where severe speed loss / excessive fuel consumption occurred. Isolates root causes (heavy weather, elevated propeller slip, RPM mismatch) and generates detailed diagnostic analysis.',
      schema: z.object({
        vesselId: z.number().int().positive().describe('Unique numerical ID of the vessel'),
        voyageNumber: z.string().trim().max(60).optional().describe('Voyage identification number if known'),
        targetDayNumber: z.number().int().positive().optional().describe('Specific voyage day (e.g. 3) to diagnose'),
        year: z.number().int().optional().describe('Operational calendar year'),
      }),
    }
  )
