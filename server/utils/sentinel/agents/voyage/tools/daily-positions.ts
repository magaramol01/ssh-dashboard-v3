import type { H3Event } from 'h3'
import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import { backendFetch } from '../../../../http-adapter'
import { resolveCoordinate, greatCircleNm } from '../skills'

export const vesselDailyPositionsTool = (tenant?: string, event?: H3Event) =>
  tool(
    async ({ vesselId, voyageNumber, startDate, endDate, year }) => {
      const y = year ?? new Date().getFullYear()
      let records: any[] = []

      if (voyageNumber) {
        const voyRes = await backendFetch<any[]>(
          `/prod/api/v1/cii/voyage?voyageNumber=${encodeURIComponent(voyageNumber)}&vesselId=${vesselId}&year=${y}`,
          { tenant, event }
        )
        if (voyRes.success && Array.isArray(voyRes.data)) records = voyRes.data
      }
      if (!records.length) {
        const res = await backendFetch<any[]>(
          `/prod/api/v1/cii/date-range?vesselId=${vesselId}&startDate=${startDate || ''}&endDate=${endDate || ''}&year=${y}&voyageType=all&type=byDate`,
          { tenant, event }
        )
        if (res.success && Array.isArray(res.data)) records = res.data
      }

      if (!records.length) {
        return JSON.stringify({
          vesselId,
          found: false,
          message: 'No noon-report position data available for the requested voyage or date range.',
        })
      }

      // One genuine at-sea noon report per UTC day, chronological, numbered D1..Dn —
      // same collapsing rule the Voyage Optimization map uses (mapCiiRecordsToDailyNoons).
      const byDate = new Map<string, any>()
      for (const r of records) {
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

      let cumulativeNm = 0
      let prevCoord: { lat: number; lng: number } | null = null
      const days = sorted.map((r, index) => {
        const lat = resolveCoordinate(r.noonreportdata?.Latitude)
        const lng = resolveCoordinate(r.noonreportdata?.Longitude)
        const distanceRunNm = Number((parseFloat(r.distance) || 0).toFixed(1))
        cumulativeNm += distanceRunNm

        let greatCircleFromPrevDayNm: number | null = null
        let unaccountedDistanceFromPrevDayNm: number | null = null
        if (prevCoord && !Number.isNaN(lat) && !Number.isNaN(lng)) {
          greatCircleFromPrevDayNm = Number(greatCircleNm(prevCoord.lat, prevCoord.lng, lat, lng).toFixed(1))
          unaccountedDistanceFromPrevDayNm = Number((greatCircleFromPrevDayNm - distanceRunNm).toFixed(1))
        }
        if (!Number.isNaN(lat) && !Number.isNaN(lng)) prevCoord = { lat, lng }

        return {
          dayNumber: index + 1,
          dateIso: r.reportDateTime,
          lat: Number.isNaN(lat) ? null : Number(lat.toFixed(4)),
          lng: Number.isNaN(lng) ? null : Number(lng.toFixed(4)),
          distanceRunNm,
          cumulativeDistanceNm: Number(cumulativeNm.toFixed(1)),
          greatCircleFromPrevDayNm,
          unaccountedDistanceFromPrevDayNm,
        }
      })

      return JSON.stringify({
        vesselId,
        voyageNumber: voyageNumber || sorted[0]?.Voyage || sorted[0]?.voyage || null,
        found: true,
        dayCount: days.length,
        days,
      })
    },
    {
      name: 'get_vessel_daily_positions',
      description:
        "Get the exact per-day noon-report GPS position (lat/long), daily distance run, cumulative voyage distance, and the great-circle-vs-logged distance gap between consecutive days. Use this whenever the operator asks for a specific day's coordinates or position, wants to compare distance between two days, or asks how much distance is missing/unaccounted-for/not reported between noon reports.",
      schema: z.object({
        vesselId: z.number().int().positive(),
        voyageNumber: z.string().trim().max(60).optional(),
        startDate: z.string().trim().max(20).optional(),
        endDate: z.string().trim().max(20).optional(),
        year: z.number().int().optional(),
      }),
    }
  )
