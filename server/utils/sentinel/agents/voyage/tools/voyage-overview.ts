import type { H3Event } from 'h3'
import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import { backendFetch } from '../../../../http-adapter'
import { getVesselTelemetry } from '../../emissions/skills'

export const voyageOverviewTool = (tenant?: string, event?: H3Event, injectedRecords?: any[]) =>
  tool(
    async ({ vesselId, voyageNumber, year }) => {
      const y = year ?? new Date().getFullYear()
      const tel = getVesselTelemetry(vesselId, y)

      let records: any[] = injectedRecords || []
      if (!records.length) {
        try {
          if (voyageNumber) {
            const voyRes = await backendFetch<any[]>(
              `/prod/api/v1/cii/voyage?voyageNumber=${encodeURIComponent(voyageNumber)}&vesselId=${vesselId}&year=${y}`,
              { tenant, event }
            )
            if (voyRes.success && Array.isArray(voyRes.data) && voyRes.data.length > 0) {
              records = voyRes.data
            }
          }
          if (!records.length) {
            const res = await backendFetch<any[]>(
              `/prod/api/v1/cii/date-range?vesselId=${vesselId}&startDate=&endDate=&year=${y}&voyageType=all&type=byDate`,
              { tenant, event }
            )
            if (res.success && Array.isArray(res.data) && res.data.length > 0) {
              records = res.data
            }
          }
        } catch {
          // External API unreachable
        }
      }

      if (!records.length) {
        return JSON.stringify({
          vesselId,
          found: false,
          message: 'No noon-report voyage data available for the requested voyage or date range.',
        })
      }

      const vesselName =
        records[0]?.vesselName ||
        records[0]?.vessel_name ||
        records[0]?.noonreportdata?.Vessel_Name ||
        tel.vesselName

      const activeVoyage =
        voyageNumber ||
        records[0]?.Voyage ||
        records[0]?.voyage ||
        records[0]?.noonreportdata?.Voyage_Number ||
        null

      const departurePort =
        records[0]?.departurePort ||
        records[0]?.departure_port ||
        records[0]?.noonreportdata?.Start_Port ||
        null

      const latestRecord = records[records.length - 1]
      const arrivalPort =
        latestRecord?.nextPort ||
        latestRecord?.next_port ||
        latestRecord?.noonreportdata?.Next_Port ||
        null

      // Calculate distance metrics from actual records
      const distanceSailedNm = Number(
        records
          .reduce((acc, r) => acc + (parseFloat(r.distance) || 0), 0)
          .toFixed(1)
      )

      const remainingRaw = latestRecord?.noonreportdata?.Distance_Remaining_To_EOV || latestRecord?.distancetogo
      const distanceToGoNm = remainingRaw ? Number((parseFloat(remainingRaw) || 0).toFixed(1)) : 0
      const totalDistanceNm = distanceToGoNm > 0 ? Number((distanceSailedNm + distanceToGoNm).toFixed(1)) : distanceSailedNm
      const progressPercent = totalDistanceNm > 0 ? Number(((distanceSailedNm / totalDistanceNm) * 100).toFixed(1)) : 0

      // Calculate fuel breakdown (ME, AE, Boiler in MT) from actual records
      let meFuelMt = 0
      let aeFuelMt = 0
      let boilerFuelMt = 0

      for (const r of records) {
        const me = parseFloat(r.meFuel || r.me_fuel || r.noonreportdata?.ME_Fuel_Oil_Cons || r.consumptionData?.me?.value) || 0
        const ae = parseFloat(r.aeFuel || r.ae_fuel || r.noonreportdata?.DG_Fuel_Oil_Cons || r.consumptionData?.ae?.value) || 0
        const blr = parseFloat(r.boilerFuel || r.boiler_fuel || r.noonreportdata?.Boiler_Fuel_Oil_Cons || r.consumptionData?.boiler?.value) || 0
        meFuelMt += me
        aeFuelMt += ae
        boilerFuelMt += blr
      }

      const totalFuelMt = Number((meFuelMt + aeFuelMt + boilerFuelMt).toFixed(1))
      meFuelMt = Number(meFuelMt.toFixed(1))
      aeFuelMt = Number(aeFuelMt.toFixed(1))
      boilerFuelMt = Number(boilerFuelMt.toFixed(1))

      const marginPercent =
        tel.requiredCii > 0
          ? Number((((tel.attainedCii - tel.requiredCii) / tel.requiredCII || tel.requiredCii) * 100).toFixed(1))
          : 0

      return JSON.stringify({
        vesselId,
        vesselName,
        voyageNumber: activeVoyage,
        departurePort,
        arrivalPort,
        totalDistanceNm,
        distanceSailedNm,
        distanceToGoNm,
        progressPercent,
        fuelSummary: {
          totalFuelMt,
          meFuelMt,
          aeFuelMt,
          boilerFuelMt,
          breakdown: [
            { consumer: 'Main Engine', fuelMt: meFuelMt, percentage: totalFuelMt > 0 ? Number(((meFuelMt / totalFuelMt) * 100).toFixed(1)) : 0 },
            { consumer: 'Auxiliary Engines', fuelMt: aeFuelMt, percentage: totalFuelMt > 0 ? Number(((aeFuelMt / totalFuelMt) * 100).toFixed(1)) : 0 },
            { consumer: 'Boiler', fuelMt: boilerFuelMt, percentage: totalFuelMt > 0 ? Number(((boilerFuelMt / totalFuelMt) * 100).toFixed(1)) : 0 },
          ],
        },
        ciiSummary: {
          rating: tel.rating,
          attainedCii: tel.attainedCii,
          requiredCii: tel.requiredCii,
          marginPercent,
        },
      })
    },
    {
      name: 'get_voyage_overview_and_progress',
      description:
        'Get an operational summary of the active voyage and passage progress for a vessel, including departure and arrival ports, total distance, distance sailed, distance to go, progress percentage, fuel breakdown (ME, AE, Boiler in MT), and current CII rating.',
      schema: z.object({
        vesselId: z.number().int().positive().describe('Unique numerical ID of the vessel'),
        voyageNumber: z.string().trim().max(60).optional().describe('Voyage identification number if known'),
        year: z.number().int().optional().describe('Operational calendar year'),
      }),
    }
  )
