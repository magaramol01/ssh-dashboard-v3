import type { H3Event } from 'h3'
import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import { backendFetch } from '../../../../http-adapter'
import { getVesselTelemetry } from '../../emissions/skills'
import { calculateWeatherFuelPenalty } from '../skills'

export const weatherFuelPenaltyTool = (tenant?: string, event?: H3Event, injectedRecords?: any[]) =>
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

      interface DailyWeatherImpact {
        dayNumber: number
        dateIso: string
        sog: number
        windBf: number
        waveHeightM: number
        actualMeFuelMt: number
        weatherFuelPenaltyMt: number
        speedLossKts: number
        weatherCo2PenaltyMt: number
      }

      const dailyImpacts: DailyWeatherImpact[] = []

      if (sorted.length > 0) {
        sorted.forEach((r, idx) => {
          const dayNumber = idx + 1
          const sog = parseFloat(r.avgSpeed ?? r.noonreportdata?.Avg_Speed) || 0
          const meFuel = parseFloat(r.meFuel ?? r.noonreportdata?.Total_HFOME_Consumed_In_MT ?? r.noonreportdata?.ME_Fuel_Oil_Cons) || 0
          const windBf = parseFloat(r.noonreportdata?.Wind_Force) || 0
          const waveHeightM = parseFloat(r.noonreportdata?.Wave_Height) || 0

          const penalty = calculateWeatherFuelPenalty(meFuel, sog, windBf, waveHeightM, sog)

          dailyImpacts.push({
            dayNumber,
            dateIso: r.reportDateTime || '',
            sog: Number(sog.toFixed(1)),
            windBf,
            waveHeightM: Number(waveHeightM.toFixed(1)),
            actualMeFuelMt: Number(meFuel.toFixed(1)),
            weatherFuelPenaltyMt: penalty.weatherFuelPenaltyMt,
            speedLossKts: penalty.speedLossKts,
            weatherCo2PenaltyMt: penalty.weatherCo2PenaltyMt,
          })
        })
      } else {
        return JSON.stringify({
          vesselId,
          found: false,
          message: 'No noon-report weather and fuel data available for the requested voyage or date range.',
        })
      }

      const totalVoyageFuelMt = Number(dailyImpacts.reduce((a, b) => a + b.actualMeFuelMt, 0).toFixed(1))
      const weatherFuelPenaltyMt = Number(dailyImpacts.reduce((a, b) => a + b.weatherFuelPenaltyMt, 0).toFixed(1))
      const baselineCalmWaterFuelMt = Number(Math.max(0, totalVoyageFuelMt - weatherFuelPenaltyMt).toFixed(1))
      const weatherCo2PenaltyMt = Number((weatherFuelPenaltyMt * 3.114).toFixed(1))

      const weatherFuelPenaltyPercent =
        totalVoyageFuelMt > 0 ? Number(((weatherFuelPenaltyMt / totalVoyageFuelMt) * 100).toFixed(1)) : 0

      const daysCount = dailyImpacts.length
      const averageSpeedLossKnots =
        daysCount > 0 ? Number((dailyImpacts.reduce((a, b) => a + b.speedLossKts, 0) / daysCount).toFixed(2)) : 0

      const heavyWeatherDays = dailyImpacts.filter((d) => d.windBf >= 6 || d.waveHeightM >= 3.0)

      let worstWeatherDay = dailyImpacts[0] || null
      for (const d of dailyImpacts) {
        if (!worstWeatherDay || d.weatherFuelPenaltyMt > worstWeatherDay.weatherFuelPenaltyMt) {
          worstWeatherDay = d
        }
      }

      const summary =
        weatherFuelPenaltyMt > 0
          ? `Adverse weather conditions added approximately ${weatherFuelPenaltyMt} MT of fuel consumption (+${weatherFuelPenaltyPercent}% above calm-water baseline) and an estimated ${weatherCo2PenaltyMt} MT of CO₂ emissions. Peak weather resistance occurred on Day ${worstWeatherDay?.dayNumber} (Beaufort ${worstWeatherDay?.windBf}, seas ${worstWeatherDay?.waveHeightM}m) with ${worstWeatherDay?.speedLossKts} kts weather-induced speed loss.`
          : `Weather conditions throughout the passage remained favorable (Beaufort ≤ 3, seas ≤ 1.0m) with negligible added weather resistance.`

      return JSON.stringify({
        vesselId,
        vesselName: tel.vesselName,
        voyageNumber: voyageNumber || `VOY-${y}-${vesselId}`,
        totalVoyageFuelMt,
        baselineCalmWaterFuelMt,
        weatherFuelPenaltyMt,
        weatherFuelPenaltyPercent,
        weatherCo2PenaltyMt,
        averageSpeedLossKnots,
        heavyWeatherDaysCount: heavyWeatherDays.length,
        worstWeatherDay: worstWeatherDay
          ? {
              dayNumber: worstWeatherDay.dayNumber,
              windBf: worstWeatherDay.windBf,
              waveHeightM: worstWeatherDay.waveHeightM,
              addedFuelMt: worstWeatherDay.weatherFuelPenaltyMt,
              speedLossKts: worstWeatherDay.speedLossKts,
            }
          : null,
        dailyImpacts,
        summary,
      })
    },
    {
      name: 'evaluate_weather_impact_on_fuel',
      description:
        'Evaluate the added fuel consumption (metric tonnes) and carbon emissions penalty incurred due to adverse weather and sea states experienced along the voyage. Compares actual fuel burn against calm-water baseline consumption using observed Beaufort wind scales, wave states, and speed loss.',
      schema: z.object({
        vesselId: z.number().int().positive().describe('Unique numerical ID of the vessel'),
        voyageNumber: z.string().trim().max(60).optional().describe('Voyage identification number if known'),
        year: z.number().int().optional().describe('Operational calendar year'),
      }),
    }
  )
