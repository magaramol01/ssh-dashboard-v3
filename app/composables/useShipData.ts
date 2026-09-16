import { ref } from 'vue'

/**
 * Ship registry record, shaped after the live `getShipData` backend response
 * (proxied via /api/vessels/ship-data). Numeric-looking fields arrive as
 * strings from the backend and are kept as-is; format at the call site.
 */
export interface ShipRecord {
  id: number
  Name: string
  Category: string | null
  MappingName: string | null
  MakingYard: string | null
  MakingDate: string | null
  PurchaseDate: string | null
  RegisteredCountry: string | null
  HomePort: string | null
  Mmsi: string | null
  CallSign: string | null
  Imo: string | null
  SisterGroup: string | null
  Fleet: string | null
  Flag: string | null
  Deadweight: string | null
  GrossTonnage: string | null
  NetTonnage: string | null
  AuxEngineRatedPower: string | null
  MainPropulsionRatedPower: string | null
  RegisteredCompany: string | null
  tenantId: string
}

/** "10-12-2023" (dd-mm-yyyy, as returned by getShipData) -> "Dec 10, 2023". */
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export function formatShipDate(ddmmyyyy?: string | null): string {
  if (!ddmmyyyy) return '—'
  const [d, m, y] = ddmmyyyy.split('-').map(Number)
  if (!d || !m || !y) return ddmmyyyy
  return `${MONTHS_SHORT[m - 1]} ${d}, ${y}`
}

/** "95823" -> "95,823 t". Falls back to "—" for null/non-numeric values. */
export function formatDeadweight(dwt?: string | null): string {
  const n = Number(dwt)
  if (!dwt || Number.isNaN(n)) return '—'
  return `${n.toLocaleString('en-US')} t`
}

export function useShipData() {
  const ships = useState<ShipRecord[]>('ship_data_list', () => [])
  const hasLoaded = useState<boolean>('ship_data_loaded', () => false)
  const isLoading = ref(false)

  async function fetchShips() {
    isLoading.value = true
    try {
      const data = await $fetch<ShipRecord[]>('/api/vessels/ship-data')
      if (Array.isArray(data)) {
        ships.value = data
      }
    } catch {
      // Retain previous state on failure
    } finally {
      isLoading.value = false
      hasLoaded.value = true
    }
  }

  function findShip(id: string | number): ShipRecord | undefined {
    return ships.value.find((s) => String(s.id) === String(id))
  }

  return {
    ships,
    isLoading,
    hasLoaded,
    fetchShips,
    findShip,
  }
}
