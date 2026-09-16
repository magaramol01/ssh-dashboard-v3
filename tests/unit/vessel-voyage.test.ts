import test from 'node:test'
import assert from 'node:assert/strict'
import {
  parseVesselCurrentPosition,
  parsePlannedCorridor,
  parseTravelledTrack,
  deriveWaypoints,
  resolvePortCoordinates,
  parseDmsCoordinate,
  KNOWN_PORT_COORDS,
} from '../../app/lib/vessel-voyage'

test('parseVesselCurrentPosition extracts coordinates, heading, and speed accurately from windyMapGEoJson', () => {
  const sampleWindyData = {
    windyMapGEoJson: {
      data: [
        {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [-17.42, 14.68],
          },
          properties: {
            calculatedLat: '14.68',
            calculatedLong: '-17.42',
            lat: '14.68',
            long: '17.42',
            latDirection: 'N',
            longDirection: 'W',
            sog: 0.2,
            vesselHeading: 7,
            packetTs: '2026-09-16 07:49:53',
            vesselId: 28,
          },
        },
      ],
    },
  }

  const pos = parseVesselCurrentPosition(sampleWindyData)
  assert.equal(pos.isValid, true)
  assert.equal(pos.lat, 14.68)
  assert.equal(pos.lng, -17.42)
  assert.equal(pos.sog, 0.2)
  assert.equal(pos.heading, 7)
  assert.equal(pos.packetTs, '2026-09-16 07:49:53')
})

test('parseVesselCurrentPosition handles southern and eastern hemisphere coordinates', () => {
  const sampleSouthernData = {
    windyMapGEoJson: {
      data: [
        {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [60.23, -19.35],
          },
          properties: {
            lat: '19.35',
            long: '60.23',
            latDirection: 'S',
            longDirection: 'E',
            sog: 10.1,
            vesselHeading: 59,
            packetTs: '2026-09-16 07:38:35',
            vesselId: 1,
          },
        },
      ],
    },
  }

  const pos = parseVesselCurrentPosition(sampleSouthernData)
  assert.equal(pos.isValid, true)
  assert.equal(pos.lat, -19.35)
  assert.equal(pos.lng, 60.23)
  assert.equal(pos.sog, 10.1)
  assert.equal(pos.heading, 59)
})

test('parseVesselCurrentPosition falls back gracefully when data is empty', () => {
  const emptyData = {}
  const pos = parseVesselCurrentPosition(emptyData, 14.68, -17.42)
  assert.equal(pos.isValid, false)
  assert.equal(pos.lat, 14.68)
  assert.equal(pos.lng, -17.42)
  assert.equal(pos.sog, 0)
  assert.equal(pos.heading, 0)
})

test('parsePlannedCorridor converts GeoJSON coordinates [lng, lat] to Leaflet [lat, lng]', () => {
  const sampleWindyData = {
    portToPortGeo: [
      {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            ['21.54742', '57.40123'],
            ['10.87333', '54.75'],
            ['-17.37778', '14.67723'],
          ],
        },
        routeData: {
          START_PORT_CODE: 'LVVNT',
          END_PORT_CODE: 'SNDKR',
          ROUTE_NAME: 'Ventspils To Dakar',
        },
      },
    ],
  }

  const corridor = parsePlannedCorridor(sampleWindyData)
  assert.equal(corridor.coords.length, 3)
  assert.deepEqual(corridor.coords[0], [57.40123, 21.54742])
  assert.deepEqual(corridor.coords[2], [14.67723, -17.37778])
  assert.equal(corridor.startPort, 'LVVNT')
  assert.equal(corridor.endPort, 'SNDKR')
  assert.equal(corridor.routeName, 'Ventspils To Dakar')
})

test('parseTravelledTrack extracts ordered track points from history', () => {
  const sampleWindyData = {
    windyMapGEoJson: {
      data: [
        { geometry: { coordinates: [-17.42, 14.68] }, properties: {} },
        { geometry: { coordinates: [-17.38, 14.68] }, properties: {} },
        { geometry: { coordinates: [-17.35, 14.65] }, properties: {} },
      ],
    },
  }

  const track = parseTravelledTrack(sampleWindyData)
  assert.equal(track.length, 3)
  // Track should be ordered oldest to newest (reversed from API)
  assert.deepEqual(track[0], [14.65, -17.35])
  assert.deepEqual(track[2], [14.68, -17.42])
})

test('deriveWaypoints extracts intermediate passage waypoints', () => {
  const coords: [number, number][] = [
    [10, 20],
    [12, 22],
    [15, 25],
    [18, 28],
    [20, 30],
    [22, 32],
    [25, 35],
    [28, 38],
  ]

  const waypoints = deriveWaypoints(coords)
  assert.equal(waypoints.length, 3)
  assert.equal(waypoints[0].name, 'WP 01')
  assert.equal(waypoints[1].name, 'WP 02')
  assert.equal(waypoints[2].name, 'WP 03')
})

test('resolvePortCoordinates returns known coordinates for standard UN/LOCODEs', () => {
  assert.deepEqual(resolvePortCoordinates('PECLL'), KNOWN_PORT_COORDS.PECLL)
  assert.deepEqual(resolvePortCoordinates('CNNDE'), KNOWN_PORT_COORDS.CNNDE)
  assert.deepEqual(resolvePortCoordinates('SNDKR'), KNOWN_PORT_COORDS.SNDKR)
  assert.deepEqual(resolvePortCoordinates('DKSKA'), KNOWN_PORT_COORDS.DKSKA)
  assert.deepEqual(resolvePortCoordinates('UNKNOWN_PORT', [10, 20]), [10, 20])
})

test('parseDmsCoordinate converts a southern-hemisphere DMS latitude to negative decimal degrees', () => {
  const result = parseDmsCoordinate("24°13'5''S")
  assert.ok(Math.abs(result - -24.218056) < 0.001)
})

test('parseDmsCoordinate converts an eastern DMS longitude to positive decimal degrees', () => {
  const result = parseDmsCoordinate("050°31'0''E")
  assert.ok(Math.abs(result - 50.516667) < 0.001)
})

test('parseDmsCoordinate handles northern and western hemispheres', () => {
  assert.ok(Math.abs(parseDmsCoordinate("10°0'0''N") - 10) < 0.001)
  assert.ok(Math.abs(parseDmsCoordinate("10°0'0''W") - -10) < 0.001)
})

test('parseDmsCoordinate returns NaN for unparseable input', () => {
  assert.ok(Number.isNaN(parseDmsCoordinate('')))
  assert.ok(Number.isNaN(parseDmsCoordinate('not a coordinate')))
})
