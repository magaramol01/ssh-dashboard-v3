import type { H3Event } from 'h3'
import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import { backendFetch } from '../../../../http-adapter'
import { getVesselTelemetry } from '../../emissions/skills'
import { calculateApparentSlip } from '../skills'

export const propulsionSlipTool = (tenant?: string, event?: H3Event, injectedRecords?: any[]) =>
  tool(
    async ({ vesselId, voyageNumber, year }) => {
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

      interface PropulsionDay {
        dayNumber: number
        dateIso: string
        rpm: number
        sog: number
        stw: number
        slipPercent: number
        meConsumptionMt: number
        windBf: number
      }

      const propulsionTrend: PropulsionDay[] = []

      if (sorted.length > 0) {
        sorted.forEach((r, idx) => {
          const dayNumber = idx + 1
          const sog = parseFloat(r.avgSpeed ?? r.noonreportdata?.Avg_Speed) || 0
          const stw = parseFloat(r.engineSpeed ?? r.noonreportdata?.LOG_SPEED) || sog
          const rpm = parseFloat(r.rpm ?? r.noonreportdata?.ME_RPM ?? r.noonreportdata?.RPM) || 0
          const slipPercent = calculateApparentSlip(sog, stw)
          const meConsumptionMt = parseFloat(r.meFuel ?? r.noonreportdata?.Total_HFOME_Consumed_In_MT ?? r.noonreportdata?.ME_Fuel_Oil_Cons) || 0
          const windBf = parseFloat(r.noonreportdata?.Wind_Force) || 0

          propulsionTrend.push({
            dayNumber,
            dateIso: r.reportDateTime || '',
            rpm: Number(rpm.toFixed(1)),
            sog: Number(sog.toFixed(1)),
            stw: Number(stw.toFixed(1)),
            slipPercent,
            meConsumptionMt: Number(meConsumptionMt.toFixed(1)),
            windBf,
          })
        })
      } else {
        return JSON.stringify({
          vesselId,
          found: false,
          message: 'No noon-report propulsion data available for the requested voyage or date range.',
        })
      }

      const totalDays = propulsionTrend.length
      const avgRpm = totalDays > 0 ? Number((propulsionTrend.reduce((a, b) => a + b.rpm, 0) / totalDays).toFixed(1)) : 85.0
      const avgSog = totalDays > 0 ? Number((propulsionTrend.reduce((a, b) => a + b.sog, 0) / totalDays).toFixed(1)) : 13.0
      const avgStw = totalDays > 0 ? Number((propulsionTrend.reduce((a, b) => a + b.stw, 0) / totalDays).toFixed(1)) : 14.0
      const avgSlip = totalDays > 0 ? Number((propulsionTrend.reduce((a, b) => a + b.slipPercent, 0) / totalDays).toFixed(1)) : 7.5

      // Find max slip day
      let maxSlipDay = propulsionTrend[0] || null
      for (const d of propulsionTrend) {
        if (!maxSlipDay || d.slipPercent > maxSlipDay.slipPercent) {
          maxSlipDay = d
        }
      }

      let slipThresholdStatus: 'normal' | 'elevated' | 'critical' = 'normal'
      if (avgSlip > 15.0 || (maxSlipDay && maxSlipDay.slipPercent > 20.0)) {
        slipThresholdStatus = 'critical'
      } else if (avgSlip > 10.0 || (maxSlipDay && maxSlipDay.slipPercent > 14.0)) {
        slipThresholdStatus = 'elevated'
      }

      let findings = ''
      if (slipThresholdStatus === 'critical') {
        findings = `Critical propulsion resistance observed: peak apparent propeller slip reached ${maxSlipDay?.slipPercent}% on Day ${maxSlipDay?.dayNumber} (Beaufort ${maxSlipDay?.windBf}). High slip indicates heavy sea-margin resistance, adverse currents, or propeller loading strain.`
      } else if (slipThresholdStatus === 'elevated') {
        findings = `Elevated propeller slip averaging ${avgSlip}% (peak ${maxSlipDay?.slipPercent}% on Day ${maxSlipDay?.dayNumber}). Propulsion efficiency is moderately impacted by environmental resistance.`
      } else {
        findings = `Propulsion performance is within nominal limits. Average propeller slip of ${avgSlip}% reflects clean hydrodynamic waterflow and balanced engine RPM (${avgRpm} RPM) vs speed over ground (${avgSog} kts).`
      }

      return JSON.stringify({
        vesselId,
        vesselName: tel.vesselName,
        voyageNumber: voyageNumber || `VOY-${y}-${vesselId}`,
        averageRpm: avgRpm,
        averageSog: avgSog,
        averageStw: avgStw,
        averageSlipPercent: avgSlip,
        slipThresholdStatus,
        maxSlipDay: maxSlipDay
          ? {
              dayNumber: maxSlipDay.dayNumber,
              slipPercent: maxSlipDay.slipPercent,
              windBf: maxSlipDay.windBf,
              sog: maxSlipDay.sog,
              rpm: maxSlipDay.rpm,
            }
          : null,
        propulsionTrend,
        findings,
      })
    },
    {
      name: 'analyze_propulsion_and_slip',
      description:
        "Analyze the vessel's propulsion efficiency, engine RPM, speed over ground (SOG) vs engine speed through water (STW), and apparent propeller slip percentage across the voyage days. Identifies hydrodynamic resistance anomalies, engine strain, or potential hull fouling indicators.",
      schema: z.object({
        vesselId: z.number().int().positive().describe('Unique numerical ID of the vessel'),
        voyageNumber: z.string().trim().max(60).optional().describe('Voyage identification number if known'),
        year: z.number().int().optional().describe('Operational calendar year'),
      }),
    }
  )
