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

export interface VesselAlarmItem {
  id: string
  code: string
  title: string
  category: 'alarm' | 'alert' | 'advisory'
  level: 'critical' | 'warning' | 'info'
  system: string
  time: string
  reading?: string
  limit?: string
  advisory?: string
  acknowledged?: boolean
}

export const DEFAULT_VESSEL_ALARMS: VesselAlarmItem[] = [
  {
    id: 'ALM-1',
    code: 'A-04',
    title: 'DG3 RPM Sensor Disconnected',
    category: 'alarm',
    level: 'critical',
    system: 'Diesel Generator 3',
    time: '05:38:22',
    reading: 'Signal Loss (0 rpm)',
    limit: 'Active Pickup',
    advisory: 'Inspect DG3 flywheel magnetic pickup cabling and resistance (nominal 1.2 kΩ).',
  },
  {
    id: 'ALM-2',
    code: 'A-12',
    title: 'Turbocharger Exhaust Gas High Temp',
    category: 'alarm',
    level: 'critical',
    system: 'Turbocharger',
    time: '05:15:00',
    reading: '342.5 °C',
    limit: '320.0 °C',
    advisory: 'Check turbine air filter differential pressure and inspect nozzle fouling.',
  },
  {
    id: 'ALM-3',
    code: 'A-08',
    title: 'Main Engine Bearing Oil Pressure Low',
    category: 'alarm',
    level: 'critical',
    system: 'ME Lube Oil',
    time: '04:52:10',
    reading: '1.85 bar',
    limit: '2.20 bar',
    advisory: 'Engage standby electric LO pump and check auto-backwash filter differential.',
  },
  {
    id: 'ALM-4',
    code: 'W-01',
    title: 'Jacket Cooling Water Pressure Low',
    category: 'alarm',
    level: 'warning',
    system: 'ME Cooling',
    time: '05:42:10',
    reading: '2.30 bar',
    limit: '2.80 bar',
    advisory: 'Inspect expansion tank static head level and de-aerator vent valve.',
  },
  {
    id: 'ALM-5',
    code: 'W-09',
    title: 'Scavenge Air Temp Elevated',
    category: 'alarm',
    level: 'warning',
    system: 'Scavenge Air',
    time: '05:30:15',
    reading: '49.2 °C',
    limit: '45.0 °C',
    advisory: 'Check sea water cooling valve bypass and clean air cooler element.',
  },
  {
    id: 'ALM-6',
    code: 'W-03',
    title: 'DG1 High-Temp Water Low Level',
    category: 'alarm',
    level: 'warning',
    system: 'Diesel Generator 1',
    time: '04:42:19',
    reading: '28% Level',
    limit: '35% Min',
    advisory: 'Top up HT cooling expansion tank and inspect circulating pump mechanical seal.',
  },
  {
    id: 'ALM-7',
    code: 'W-05',
    title: 'Scavenge Receiver Temp High',
    category: 'alarm',
    level: 'warning',
    system: 'Scavenge Receiver',
    time: '04:20:11',
    reading: '58.4 °C',
    limit: '55.0 °C',
    advisory: 'Check piston rod stuffing box and inspect cylinder liner drain temps.',
  },
  {
    id: 'ALM-8',
    code: 'W-08',
    title: 'Fuel Oil Service Tank Low Level',
    category: 'alarm',
    level: 'warning',
    system: 'Fuel System',
    time: '04:02:18',
    reading: '32% Level',
    limit: '40% Min',
    advisory: 'Initiate fuel transfer from settling tank via purifier unit #1.',
  },
  {
    id: 'ALM-9',
    code: 'ALT-01',
    title: 'Cross-Track Distance Limit Exceeded',
    category: 'alert',
    level: 'warning',
    system: 'Navigation / AIS',
    time: '03:45:00',
    reading: '0.78 NM XTD',
    limit: '0.50 NM Max',
    advisory: 'Adjust autopilot heading compensation to re-enter central corridor track.',
  },
  {
    id: 'ALM-10',
    code: 'ALT-02',
    title: 'Rough Sea Passage Advisory',
    category: 'alert',
    level: 'warning',
    system: 'Weather Routing',
    time: '03:18:22',
    reading: '4.2m Sig Wave',
    limit: '3.5m Envelope',
    advisory: 'Reduce main engine RPM to mitigate propeller cavitation and slamming.',
  },
  {
    id: 'ALM-11',
    code: 'INF-01',
    title: 'Starting Air Auto-Unloader Active',
    category: 'alert',
    level: 'info',
    system: 'Starting Air',
    time: '04:58:30',
    reading: 'Cycle Active',
    limit: 'Nominal',
    advisory: 'Compressor #2 automatic unloader cycle completed nominally.',
  },
  {
    id: 'ALM-12',
    code: 'INF-02',
    title: 'Auxiliary Blower #1 Running',
    category: 'alert',
    level: 'info',
    system: 'Main Engine',
    time: '03:12:05',
    reading: 'Running (28 Hz)',
    limit: 'Auto Standby',
    advisory: 'Blower engaged automatically under low load scavenge threshold.',
  },
  {
    id: 'ALM-13',
    code: 'ADV-01',
    title: 'Cylinder 4 SFOC Optimization',
    category: 'advisory',
    level: 'info',
    system: 'CBM Advisory',
    time: '02:40:00',
    reading: '172.4 g/kWh',
    limit: '165.0 Target',
    advisory: 'Apply Variable Injection Timing (VIT) +0.8° offset to optimize combustion.',
  },
  {
    id: 'ALM-14',
    code: 'ADV-02',
    title: 'Exhaust Valve 2 Temp Deviation',
    category: 'advisory',
    level: 'warning',
    system: 'Predictive CBM',
    time: '02:15:40',
    reading: '+14 °C Spread',
    limit: '12 °C Spread',
    advisory: 'Hydraulic actuator pressure drop detected. Schedule valve seating check.',
  },
]

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
  const alarmsList = useState<VesselAlarmItem[]>('vessel_dashboard_alarms', () => [...DEFAULT_VESSEL_ALARMS])
  const isAlarmsMuted = useState<boolean>('vessel_dashboard_alarms_muted', () => false)

  const activeAlarmsCount = computed(() => alarmsList.value.filter((a) => !a.acknowledged).length)
  const criticalAlarmsCount = computed(() => alarmsList.value.filter((a) => a.level === 'critical' && !a.acknowledged).length)
  const warningAlarmsCount = computed(() => alarmsList.value.filter((a) => a.level === 'warning' && !a.acknowledged).length)
  const infoAlarmsCount = computed(() => alarmsList.value.filter((a) => a.level === 'info' && !a.acknowledged).length)
  const advisoryAlarmsCount = computed(() => alarmsList.value.filter((a) => a.category === 'advisory' && !a.acknowledged).length)

  function acknowledgeAlarm(id: string) {
    const item = alarmsList.value.find((a) => a.id === id)
    if (item) {
      item.acknowledged = !item.acknowledged
    }
  }

  function acknowledgeAllAlarms() {
    alarmsList.value.forEach((a) => {
      a.acknowledged = true
    })
  }

  function resetAllAlarms() {
    alarmsList.value.forEach((a) => {
      a.acknowledged = false
    })
  }

  function toggleMuteAlarms() {
    isAlarmsMuted.value = !isAlarmsMuted.value
  }

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
    alarmsList,
    isAlarmsMuted,
    activeAlarmsCount,
    criticalAlarmsCount,
    warningAlarmsCount,
    infoAlarmsCount,
    advisoryAlarmsCount,
    acknowledgeAlarm,
    acknowledgeAllAlarms,
    resetAllAlarms,
    toggleMuteAlarms,
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
