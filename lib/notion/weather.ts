import { compact } from '../util/collections'
import { DayWeather, getWeatherIcon } from '../weather'
import { makeTextPart } from './util'

export function makePrecipPart (condition: boolean, info: string) {
  return condition ? makeTextPart(`(${info}) `, 'gray') : undefined
}

export function makeConditionParts (weather: DayWeather) {
  return compact([
    makeTextPart(`${getWeatherIcon(weather.icon)} `),
    makePrecipPart(weather.icon === 'rain' && weather.precipProbability >= 0.01, `${Math.round(weather.precipProbability * 100)}%`),
    makePrecipPart(weather.icon === 'snow' && weather.precipAccumulation >= 0.1, `${(weather.precipAccumulation || 0).toFixed(2)}in`),
  ])
}

export function makeTemperatureParts (weather: DayWeather) {
  return compact([
    makeTextPart(`${Math.round(weather.temperatureLow)}°`, 'blue'),
    makeTextPart(' / ', 'gray'),
    makeTextPart(`${Math.round(weather.temperatureHigh)}°`, 'orange'),
  ])
}
