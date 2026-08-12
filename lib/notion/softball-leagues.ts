import { load, type CheerioAPI } from 'cheerio'
import dayjs from 'dayjs'

import { debug, debugVerbose } from '../util/debug'
import { getEnv } from '../util/env'
import { request } from '../util/network'
import { richTextToPlainText } from './util/conversions'
import { makeRichText } from './util/general'
import { getDataSources } from './util/queries'
import { addDataSourcePage, updatePage } from './util/updates'

const LEAGUE_LISTING_URL = 'https://widget.leaguelab.com/v1/heydayathletic/league-listing?sport=Softball'

const NEIGHBORHOODS_BY_LOCATION: Record<string, string> = {
  'PHL BURBS | Sutcliffe Park': 'BURBS | Conshohocken',
  'PHL BURBS | Stanbridge Street Field': 'BURBS | East Norriton',
  'PHL BURBS | Mondauk Common Park': 'BURBS | Upper Dublin',
  'PHL BURBS | Miles Park': 'BURBS | Whitemarsh Township',
  'PHL | Kendrick Recreation Center': 'PHL | Manayunk & Bala Cynwyd',
}

const ALLOWED_LOCATIONS = Object.keys(NEIGHBORHOODS_BY_LOCATION)
const ALLOWED_DAYS = ['Sunday', 'Monday', 'Thursday', 'Saturday']

interface League {
  id: string
  location: string
  neighborhood: string
  gender: string
  leagueType: string
  seasonLength: string
  startDate: string
  signupDeadline: string
  signUpLink: string
  status: string
  skillLevel: string
  days: string[]
}

interface LeagueProperties {
  Name: { title: [{ type: 'text', text: { content: string } }] }
  Location: { select: { name: string } }
  Neighborhood: { select: { name: string } }
  Gender: { select: { name: string } }
  'League Type': { select: { name: string } }
  'Season Length': { select: { name: string } }
  'Start Date': { date: { start: string } }
  'Signup Deadline': { date: { start: string } }
  'Sign Up': { rich_text: ReturnType<typeof makeRichText>[] }
  'Skill Level': { select: { name: string } }
  Day: { multi_select: { name: string }[] }
}

function getIdFromSignUpLink (signUpLink: string) {
  const [, id] = signUpLink.match(/\/league\/(\d+)\//) || []

  return id || ''
}

function getField ($: CheerioAPI, row: any, label: string) {
  const span = $(row).find('span.inline-head').filter((_, el) => {
    return $(el).text().trim().startsWith(label)
  })
  const field = span.parent().clone()

  field.find('span.inline-head').remove()

  return field.text().trim()
}

function getSeasonLength (shortDescription: string) {
  const [, games] = shortDescription.match(/(\d+)\s*(?:Gm|Game)\s*Season/i) || []
  const isExpress = /Express/i.test(shortDescription)

  return `${isExpress ? 'Express' : 'Full'} (${games} games)`
}

function getGender (rawGender: string, format: string) {
  if (rawGender !== 'Mixed') return rawGender

  const [, menRatio, womenRatio] = format.match(/\((\d)\/(\d) Ratio\)/) || []

  return `Mixed (${menRatio}/${womenRatio})`
}

function getLeagueType (format: string) {
  return /Wood Bat/i.test(format) ? 'Wood Bat' : 'Regular'
}

function toIsoDate (date: string) {
  return dayjs(date, 'M/D/YY').format('YYYY-MM-DD')
}

function parseLeagues (html: string): League[] {
  const $ = load(html)
  const leagues: League[] = []

  $('tr.widget-league-listing[data-sports="Softball"]').each((_, row) => {
    const location = getField($, row, 'Location:')
    const status = getField($, row, 'Status:')
    const days = getField($, row, 'Days:')
    const dayList = days.split(',').map((day) => day.trim())

    if (!ALLOWED_LOCATIONS.includes(location)) return
    if (status !== 'Open') return
    if (!dayList.some((day) => ALLOWED_DAYS.includes(day))) return

    const format = getField($, row, 'Format:')
    const widgetId = $(row).attr('id')!.replace('widget-league-listing-', '')
    const shortDescription = $(`#widget-league-listing-${widgetId}-shortDescription`).text().trim()
    const signUpLink = $(row).find('a.registration-link, a.view-link').attr('href') || ''

    leagues.push({
      id: getIdFromSignUpLink(signUpLink),
      location,
      neighborhood: NEIGHBORHOODS_BY_LOCATION[location],
      gender: getGender(getField($, row, 'Gender(s):'), format),
      leagueType: getLeagueType(format),
      seasonLength: getSeasonLength(shortDescription),
      startDate: getField($, row, 'Start Date:'),
      signupDeadline: getField($, row, 'Signup Deadline:'),
      signUpLink,
      status,
      skillLevel: getField($, row, 'Skill Level(s):'),
      days: dayList,
    })
  })

  return leagues
}

function toLeagueProperties (league: League): LeagueProperties {
  return {
    Name: { title: [{ type: 'text', text: { content: league.id } }] },
    Location: { select: { name: league.location } },
    Neighborhood: { select: { name: league.neighborhood } },
    Gender: { select: { name: league.gender } },
    'League Type': { select: { name: league.leagueType } },
    'Season Length': { select: { name: league.seasonLength } },
    'Start Date': { date: { start: toIsoDate(league.startDate) } },
    'Signup Deadline': { date: { start: toIsoDate(league.signupDeadline) } },
    'Sign Up': { rich_text: [makeRichText('Sign Up', { link: { url: league.signUpLink } })] },
    'Skill Level': { select: { name: league.skillLevel } },
    Day: { multi_select: league.days.map((day) => ({ name: day })) },
  }
}

interface SyncLeaguesOptions {
  leagues: League[]
  notionToken: string
  softballLeaguesDataSourceId: string
}

async function syncLeagues ({ leagues, notionToken, softballLeaguesDataSourceId }: SyncLeaguesOptions) {
  const dataSources = await getDataSources({ dataSourceId: softballLeaguesDataSourceId, notionToken })
  const pageIdsByName = new Map(dataSources.map((dataSource) => {
    // @ts-ignore
    const name = richTextToPlainText(dataSource.properties.Name.title)

    return [name, dataSource.id]
  }))

  await Promise.all(leagues.map((league) => {
    const properties = toLeagueProperties(league)
    const pageId = pageIdsByName.get(league.id)

    if (pageId) {
      return updatePage({ notionToken, pageId, properties })
    }

    return addDataSourcePage({
      notionToken,
      dataSourceId: softballLeaguesDataSourceId,
      properties,
    })
  }))
}

interface GetSoftballLeaguesOptions {
  notionToken: string
  softballLeaguesDataSourceId: string
}

export async function getSoftballLeagues ({ notionToken, softballLeaguesDataSourceId }: GetSoftballLeaguesOptions) {
  const html = await request<string>({ url: LEAGUE_LISTING_URL })
  const leagues = parseLeagues(html)

  await syncLeagues({ leagues, notionToken, softballLeaguesDataSourceId })
}

/* v8 ignore next 25 -- @preserve */
export default async function main () {
  const notionToken = getEnv('NOTION_TOKEN')!
  const softballLeaguesDataSourceId = getEnv('NOTION_SOFTBALL_LEAGUES_ID')!

  debugVerbose('ENV:', {
    notionToken,
    softballLeaguesDataSourceId,
  })

  try {
    debug('Updating Softball Leagues...')

    await getSoftballLeagues({ notionToken, softballLeaguesDataSourceId })

    debug('Successfully updated Softball Leagues')
  } catch (error: any) {
    debug('Updating Softball Leagues failed:')
    debug(error?.stack || error)

    throw error
  }
}
