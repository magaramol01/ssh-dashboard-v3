import { defineEventHandler, getQuery, createError } from 'h3'
import { getMarineWeather, type MarineWeatherForecast } from '../../utils/weather-adapter'

export interface WeatherApiResponse {
  success: boolean
  data: MarineWeatherForecast
}

export default defineEventHandler(async (event): Promise<WeatherApiResponse> => {
  const query = getQuery(event)
  const latStr = query.lat ? String(query.lat) : ''
  const lngStr = query.lng ? String(query.lng) : ''

  const lat = parseFloat(latStr)
  const lng = parseFloat(lngStr)

  if (isNaN(lat) || isNaN(lng)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid query parameters: "lat" and "lng" must be valid numeric coordinates.',
    })
  }

  const weather = await getMarineWeather(lat, lng)

  return {
    success: true,
    data: weather,
  }
})
