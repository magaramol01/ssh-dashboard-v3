import { defineEventHandler, getQuery } from 'h3'
import { backendFetch } from '../../utils/http-adapter'

const VESSEL_MAPPING_NAMES: Record<string, string> = {
  '28': 'nova-asia-unity',
  '1': 'nova-china-express',
  '10': 'nova-medan-express',
  '11': 'nova-tarakan-express',
  '2': 'nova-indonesia-express',
  '3': 'nova-brazil-express',
  '4': 'nova-canada-express',
  '5': 'nova-nanjing-express',
  '7': 'nova-shanghai-express',
  '8': 'nova-kalimantan-express',
  '9': 'nova-batavia-express',
  '12': 'nova-sumatera-express',
  '13': 'nova-xinhui-express',
  '14': 'nova-fujian-express',
  '19': 'nova-surabaya-express',
  '20': 'nova-condor-express',
  '23': 'nova-rizhao-express',
  '24': 'nova-falcon-express',
  '25': 'nova-eagle-express',
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const vesselId = String(query.vesselId || '28')
  const vesselName = String(
    query.vesselName || VESSEL_MAPPING_NAMES[vesselId] || `nova-asia-unity`
  )

  // Compute 30-day window ending today
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const endDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const startDate = `${past.getFullYear()}-${pad(past.getMonth() + 1)}-${pad(past.getDate())}`

  const page = query.activePage || '1'
  const endpoint = `/prod/api/v1/getAllTodayHistory?vesselName=${encodeURIComponent(
    vesselName
  )}&startDate=${startDate}&endDate=${endDate}&activePage=${page}`

  const res = await backendFetch(endpoint, {
    method: 'GET',
    event,
  })

  return res.data || {}
})
