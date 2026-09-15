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
    title: 'DG3 RPM SENSOR DISCONNECTED',
    category: 'alarm',
    level: 'critical',
    system: 'Diesel Generator 3',
    time: '05:38:22',
    reading: 'Signal Loss (0 rpm)',
    limit: 'Active Pickup',
    advisory: 'Inspect pickup sensor cabling on DG3 flywheel housing. Test magnetic pickup resistance (nominal 1.2 kΩ).',
  },
  {
    id: 'ALM-2',
    code: 'A-12',
    title: 'TC EXH GAS OUTLET HI TEMP',
    category: 'alarm',
    level: 'critical',
    system: 'Turbocharger',
    time: '05:15:00',
    reading: '342.5 °C',
    limit: '320.0 °C',
    advisory: 'High exhaust gas outlet temperature detected. Inspect air filter differential pressure and check for turbine nozzle fouling.',
  },
  {
    id: 'ALM-3',
    code: 'A-08',
    title: 'ME MAIN BEARING OIL PRESS LOW',
    category: 'alarm',
    level: 'critical',
    system: 'Main Engine Lube Oil',
    time: '04:52:10',
    reading: '1.85 bar',
    limit: '2.20 bar',
    advisory: 'Bearing oil manifold pressure below safety limit. Start standby electric lube oil pump immediately and inspect auto-backwash filter.',
  },
  {
    id: 'ALM-4',
    code: 'W-01',
    title: 'ME JCW INLET PRESS LOW',
    category: 'alarm',
    level: 'warning',
    system: 'ME Cooling',
    time: '05:42:10',
    reading: '2.30 bar',
    limit: '2.80 bar',
    advisory: 'Jacket cooling water inlet pressure depressed. Check expansion tank static head level and de-aerator vent valve.',
  },
  {
    id: 'ALM-5',
    code: 'W-09',
    title: 'ME SCAV AIR TEMP ELEVATED',
    category: 'alarm',
    level: 'warning',
    system: 'Scavenge Air',
    time: '05:30:15',
    reading: '49.2 °C',
    limit: '45.0 °C',
    advisory: 'Scavenge air temperature after cooler is higher than design. Verify sea water cooling flow rate and clean cooler element if required.',
  },
  {
    id: 'ALM-6',
    code: 'W-03',
    title: 'DG1 HT FW LOW LEVEL',
    category: 'alarm',
    level: 'warning',
    system: 'Diesel Generator 1',
    time: '04:42:19',
    reading: '28% Tank Level',
    limit: '35% Min',
    advisory: 'DG1 High Temperature fresh water expansion tank level low. Top up cooling system with treated water and check mechanical seals.',
  },
  {
    id: 'ALM-7',
    code: 'W-05',
    title: 'ME SCAV AIR RECEIVER TEMP HIGH',
    category: 'alarm',
    level: 'warning',
    system: 'Scavenge Receiver',
    time: '04:20:11',
    reading: '58.4 °C',
    limit: '55.0 °C',
    advisory: 'Receiver air temperature threshold exceeded. Check cylinder liner drain temperatures for signs of piston blow-by.',
  },
  {
    id: 'ALM-8',
    code: 'W-08',
    title: 'FO SERVICE TANK LOW LEVEL',
    category: 'alarm',
    level: 'warning',
    system: 'Fuel System',
    time: '04:02:18',
    reading: '32% Level',
    limit: '40% Min',
    advisory: 'Fuel oil daily service tank reaching low operational limit. Initiate transfer from settling tank through separator #1.',
  },
  {
    id: 'ALM-9',
    code: 'ALT-01',
    title: 'WAYPOINT XTD LIMIT EXCEEDED',
    category: 'alert',
    level: 'warning',
    system: 'Navigation / AIS',
    time: '03:45:00',
    reading: '0.78 NM XTD',
    limit: '0.50 NM Max',
    advisory: 'Cross-track distance exceeds voyage corridor boundary. Check bridge autopilot settings and current ocean drift.',
  },
  {
    id: 'ALM-10',
    code: 'ALT-02',
    title: 'WEATHER ROUGH SEA ADVISORY',
    category: 'alert',
    level: 'warning',
    system: 'Weather Routing',
    time: '03:18:22',
    reading: '4.2m Significant Wave',
    limit: '3.5m Envelope',
    advisory: 'Approaching moderate swell sector. Consider engine RPM reduction to prevent propeller racing and hull slamming.',
  },
  {
    id: 'ALM-11',
    code: 'INF-01',
    title: 'AUTO UNLOADER IN OPERATION',
    category: 'alert',
    level: 'info',
    system: 'Starting Air',
    time: '04:58:30',
    reading: 'Cycle Active',
    limit: 'Nominal',
    advisory: 'Compressor #2 automatic unloader cycle running nominally.',
  },
  {
    id: 'ALM-12',
    code: 'INF-02',
    title: 'AUX BLOWER #1 STARTED',
    category: 'alert',
    level: 'info',
    system: 'Main Engine',
    time: '03:12:05',
    reading: 'Running (28 Hz)',
    limit: 'Auto Standby',
    advisory: 'Auxiliary blower started automatically due to scavenge air pressure below 0.35 bar during maneuver.',
  },
  {
    id: 'ALM-13',
    code: 'ADV-01',
    title: 'CYLINDER 4 SFOC OPTIMIZATION',
    category: 'advisory',
    level: 'info',
    system: 'CBM Advisory',
    time: '02:40:00',
    reading: '172.4 g/kWh',
    limit: '165.0 Target',
    advisory: 'Variable Injection Timing (VIT) trim offset recommended +0.8° to optimize thermal efficiency and reduce specific fuel consumption.',
  },
  {
    id: 'ALM-14',
    code: 'ADV-02',
    title: 'EXHAUST VALVE 2 TEMPORARY DEVIATION',
    category: 'advisory',
    level: 'warning',
    system: 'Predictive Diagnostics',
    time: '02:15:40',
    reading: '+14 °C Spread',
    limit: '12 °C Max Spread',
    advisory: 'Exhaust valve hydraulic actuator pressure drop detected during closing phase. Schedule inspection at next bunkering port.',
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
