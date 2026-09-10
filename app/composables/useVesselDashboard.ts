import { ref, computed, watch, onMounted, onUnmounted } from 'vue'

export interface VesselItem {
  id: number
  name: string
  mappingname: string
  sistergroup: string
  isSuccess?: boolean
}

export interface MRVLData {
  vessel?: string
  sn?: string
  voyage?: string
  rptdate?: string | null
  scr?: string
  destination?: string
  etanextport?: string
  totaldistrun?: string
  disttogo?: string
  timezone?: string
}

export interface ConnectivityData {
  status: boolean
  message: string
  lastUpdatedTime?: string
  code?: 'green' | 'red' | string
}

export interface RHSPanelFlag {
  id: string
  typename: string
  status: boolean
}

export function deriveSisterGroups(vessels: VesselItem[]): string[] {
  const groups = new Set<string>()
  vessels.forEach((v) => {
    if (v.sistergroup && v.sistergroup.trim()) {
      groups.add(v.sistergroup.trim())
    }
  })
  return ['Select All', ...Array.from(groups).sort()]
}

export function filterVesselsBySisterGroup(vessels: VesselItem[], selectedGroup: string): VesselItem[] {
  if (!selectedGroup || selectedGroup === 'Select All') {
    return vessels
  }
  return vessels.filter((v) => v.sistergroup === selectedGroup)
}

export function useVesselDashboard() {
  const selectedVesselId = useState<string>('vessel_dashboard_selected_id', () => '28')
  const selectedSisterGroup = useState<string>('vessel_dashboard_sister_group', () => 'Select All')
  const viewBy = useState<'sister' | 'fleet'>('vessel_dashboard_view_by', () => 'sister')
  const activeEngineTab = useState<number>('vessel_dashboard_engine_tab', () => 0)
  const selectedTelemetryParam = useState<string>('vessel_dashboard_param', () => 'AM21')

  const vesselsList = useState<VesselItem[]>('vessel_dashboard_vessels', () => [])
  const dashboardState = useState<any>('vessel_dashboard_state', () => null)
  const mrvData = useState<MRVLData>('vessel_dashboard_mrv', () => ({}))
  const windyMapData = useState<any>('vessel_dashboard_windy', () => null)
  const connectivity = useState<ConnectivityData>('vessel_dashboard_conn', () => ({
    status: true,
    message: 'Online',
    code: 'green',
    lastUpdatedTime: '',
  }))
  const rhsFlags = useState<RHSPanelFlag[]>('vessel_dashboard_rhs_flags', () => [
    { id: '1', typename: 'widget_5', status: false },
    { id: '2', typename: 'widget_4', status: true },
    { id: '3', typename: 'widget_6', status: false },
    { id: '4', typename: 'widget_8', status: false },
    { id: '5', typename: 'widget_7', status: false },
  ])
  const graphAvgValues = useState<any[]>('vessel_dashboard_graph_avg', () => [])
  const rechartData = useState<any[]>('vessel_dashboard_rechart', () => [])

  const isLoading = ref<boolean>(false)
  const isMapLoading = ref<boolean>(false)

  const sisterGroups = computed(() => deriveSisterGroups(vesselsList.value))

  const filteredVessels = computed(() =>
    filterVesselsBySisterGroup(vesselsList.value, selectedSisterGroup.value)
  )

  const selectedVessel = computed(() =>
    vesselsList.value.find((v) => String(v.id) === String(selectedVesselId.value)) || null
  )

  async function fetchVesselsList() {
    try {
      const data = await $fetch<VesselItem[]>('/api/vessels/sister-group', {
        method: 'POST',
        body: { id: 'Select All' },
      })
      if (Array.isArray(data) && data.length > 0) {
        vesselsList.value = data
        if (!selectedVesselId.value || !data.some((v) => String(v.id) === String(selectedVesselId.value))) {
          selectedVesselId.value = String(data[0]?.id || '28')
        }
      }
    } catch {
      // Fallback defaults
      if (!vesselsList.value.length) {
        vesselsList.value = [
          { id: 28, name: 'ASIA UNITY', mappingname: 'nova-asia-unity', sistergroup: 'CX 5.0' },
          { id: 1, name: 'CHINA EXPRESS', mappingname: 'nova-china-express', sistergroup: 'CX 5.0' },
          { id: 10, name: 'MEDAN EXPRESS', mappingname: 'nova-medan-express', sistergroup: 'YZJ 4.7m' },
        ]
      }
    }
  }

  async function fetchDashboardState(vId = selectedVesselId.value) {
    if (!vId) return
    try {
      const data = await $fetch<any>('/api/vessels/dashboard-state', {
        query: { vesselId: vId },
      })
      if (data?.dashboardStateJson) {
        dashboardState.value = data.dashboardStateJson
      }
    } catch {
      // Retain previous or default
    }
  }

  async function fetchVoyageData(vId = selectedVesselId.value) {
    if (!vId) return
    try {
      const data = await $fetch<MRVLData>('/api/vessels/mrv-latest', {
        query: { vesselId: vId },
      })
      if (data) {
        mrvData.value = data
      }
    } catch {
      // Fallback
    }
  }

  async function fetchWindyMap(vId = selectedVesselId.value) {
    if (!vId) return
    isMapLoading.value = true
    try {
      const data = await $fetch<any>('/api/vessels/windy-geojson', {
        query: { vesselId: vId },
      })
      if (data) {
        windyMapData.value = data
      }
    } catch {
      // Fallback
    } finally {
      isMapLoading.value = false
    }
  }

  async function fetchConnectivity(vId = selectedVesselId.value) {
    if (!vId) return
    try {
      const data = await $fetch<ConnectivityData>('/api/vessels/connectivity-status', {
        query: { vesselId: vId },
      })
      if (data) {
        connectivity.value = data
      }
    } catch {
      // Fallback
    }
  }

  async function fetchRHSFlags() {
    try {
      const data = await $fetch<RHSPanelFlag[]>('/api/vessels/rhs-panel-flags')
      if (Array.isArray(data) && data.length > 0) {
        rhsFlags.value = data
      }
    } catch {
      // Keep defaults
    }
  }

  async function updateRHSFlags(flags: RHSPanelFlag[]) {
    rhsFlags.value = flags
    try {
      await $fetch('/api/vessels/rhs-panel-flags', {
        method: 'POST',
        body: { panelFlag: flags },
      })
    } catch {
      // Best-effort
    }
  }

  async function fetchGraphAvgValues(vId = selectedVesselId.value) {
    if (!vId) return
    try {
      const data = await $fetch<any[]>('/api/vessels/graph-avg-values', {
        query: { vesselId: vId },
      })
      if (Array.isArray(data)) {
        graphAvgValues.value = data
      }
    } catch {
      // Fallback
    }
  }

  async function fetchRechartData(vId = selectedVesselId.value, paramId = selectedTelemetryParam.value) {
    if (!vId || !paramId) return
    try {
      const data = await $fetch<any[]>('/api/vessels/rechart-data', {
        method: 'POST',
        body: { vesselId: Number(vId), parameterId: paramId },
      })
      if (Array.isArray(data)) {
        rechartData.value = data
      }
    } catch {
      // Fallback
    }
  }

  async function refreshAll() {
    isLoading.value = true
    try {
      await Promise.allSettled([
        fetchDashboardState(),
        fetchVoyageData(),
        fetchWindyMap(),
        fetchConnectivity(),
        fetchGraphAvgValues(),
        fetchRechartData(),
      ])
    } finally {
      isLoading.value = false
    }
  }

  // Reactive watcher on vesselId change
  watch(selectedVesselId, (newId) => {
    if (newId) {
      refreshAll()
    }
  })

  // Reactive watcher on parameter selection
  watch(selectedTelemetryParam, (newParam) => {
    if (newParam) {
      fetchRechartData(selectedVesselId.value, newParam)
    }
  })

  // Polling setup for real-time telemetry (30s intervals)
  let timer: any = null
  onMounted(() => {
    fetchVesselsList().then(() => {
      refreshAll()
    })
    fetchRHSFlags()

    timer = setInterval(() => {
      fetchConnectivity()
      fetchDashboardState()
    }, 30000)
  })

  onUnmounted(() => {
    if (timer) clearInterval(timer)
  })

  return {
    selectedVesselId,
    selectedSisterGroup,
    viewBy,
    activeEngineTab,
    selectedTelemetryParam,
    vesselsList,
    sisterGroups,
    filteredVessels,
    selectedVessel,
    dashboardState,
    mrvData,
    windyMapData,
    connectivity,
    rhsFlags,
    graphAvgValues,
    rechartData,
    isLoading,
    isMapLoading,
    fetchVesselsList,
    fetchDashboardState,
    fetchVoyageData,
    fetchWindyMap,
    fetchConnectivity,
    fetchRHSFlags,
    updateRHSFlags,
    fetchGraphAvgValues,
    fetchRechartData,
    refreshAll,
  }
}
