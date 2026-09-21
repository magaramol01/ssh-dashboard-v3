import { defineEventHandler, getQuery } from 'h3'
import { backendFetch } from '../../utils/http-adapter'

export interface VesselVoyageItem {
  voyageNumber: string
  startPort: string
  destinationPort: string
  departureTime?: string
  arrivalTime?: string
  etaNextPort?: string
  isOngoing: boolean
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const vesselId = String(query.vesselId || '28')
  const type = String(query.type || 'all')

  try {
    const res = await backendFetch<any[]>(`/prod/api/v1/voyages?vesselId=${vesselId}&type=${type}`, {
      method: 'GET',
      event,
    })

    if (!res.success || !Array.isArray(res.data)) {
      return []
    }

    return res.data
      .filter((v: any) => v && (v.Voyage || v.voyageNumber))
      .map((v: any) => ({
        voyageNumber: String(v.Voyage || v.voyageNumber || '').trim(),
        startPort: String(v.start_port || v.startPort || '').trim(),
        destinationPort: String(v.final_destination_port || v.destinationPort || '').trim(),
        departureTime: v.departure_time || v.departureTime || '',
        arrivalTime: v.arrival_time || v.arrivalTime || '',
        etaNextPort: v.eta_next_port || v.etaNextPort || '',
        isOngoing: Boolean(v.isOngoing),
      }))
  } catch {
    return []
  }
})
