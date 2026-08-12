import nock from 'nock'
import { describe, expect, it } from 'vitest'

import { getSoftballLeagues } from '../../../lib/notion/softball-leagues'
import { snapshotBody } from '../../util'
import { nockNotion, richText } from './util'

interface RowOptions {
  id?: string
  days: string
  format?: string
  gender?: string
  linkClass?: string
  linkHref?: string
  location: string
  shortDescription?: string
  signupDeadline?: string
  skillLevel?: string
  startDate?: string
  status: string
  withLink?: boolean
}

function leagueRow ({
  id = '1',
  days,
  format = '10v10 (7/3 Ratio) Ref League',
  gender = 'Mixed',
  linkClass = 'registration-link',
  linkHref = `https://x.leaguelab.com/league/${id}/details`,
  location,
  shortDescription = '7 Gm Season | 6 Reg Season Gms | All Teams Make Playoffs',
  signupDeadline = '4/1/26',
  skillLevel = 'Open',
  startDate = '5/1/26',
  status,
  withLink = true,
}: RowOptions) {
  return `
    <tr class=widget-league-listing id="widget-league-listing-${id}" data-sports="Softball">
      <td><div><span class=inline-head>Location: &nbsp;</span>${location}</div></td>
      <td><div><span class=inline-head>Days: &nbsp;</span>${days}</div></td>
      <td><div><span class=inline-head>Skill Level(s): &nbsp;</span>${skillLevel}</div></td>
      <td><div><span class=inline-head>Gender(s): &nbsp;</span>${gender}</div></td>
      <td><div><span class=inline-head>Format: &nbsp;</span>${format}</div></td>
      <td><div><span class=inline-head>Start Date: &nbsp;</span>${startDate}</div></td>
      <td><div><span class=inline-head>Signup Deadline: &nbsp;</span>${signupDeadline}</div></td>
      <td><div><span class=inline-head>Status: &nbsp;</span>${status}</div></td>
      <td><div>${withLink ? `<a class="btn-sm ${linkClass}" href="${linkHref}">Sign Up!</a>` : ''}</div></td>
    </tr>
    <tr class=widget-short-description id="widget-league-listing-${id}-shortDescription">
      <td class=shortDescription>${shortDescription}</td>
    </tr>
  `
}

describe('lib/notion/softball-leagues', () => {
  it('syncs open leagues at allowed locations/days to the notion database', async () => {
    const html = [
      // matches an existing page by id, so it should be updated
      leagueRow({
        id: '111',
        location: 'PHL BURBS | Sutcliffe Park',
        days: 'Monday',
        status: 'Open',
        gender: 'Mixed',
        format: '10v10 (7/3 Ratio) Ref League',
        shortDescription: '7 Gm Season | 6 Reg Season Gms | All Teams Make Playoffs',
      }),
      // no existing matching page, so it should be added. also covers the
      // males-only gender branch, the wood bat league type branch, and the
      // express season length branch
      leagueRow({
        id: '222',
        location: 'PHL | Kendrick Recreation Center',
        days: 'Saturday',
        status: 'Open',
        gender: 'Males Only',
        format: '10v10 Wood Bat Ref League',
        shortDescription: 'Express League | 5 Gm Season | 4 Reg Season Gms | Top 4 Make Playoffs',
      }),
      // covers a mixed gender with no ratio in the format, a short description
      // with no game count, and no sign up link at all
      leagueRow({
        id: '333',
        location: 'PHL BURBS | Miles Park',
        days: 'Sunday, Thursday',
        status: 'Open',
        gender: 'Mixed',
        format: '10v10 Wood Bat Ref League',
        shortDescription: 'No game count in this description',
        withLink: false,
      }),
      // excluded: status isn't open
      leagueRow({
        id: '444',
        location: 'PHL BURBS | Sutcliffe Park',
        days: 'Monday',
        status: 'Closed',
      }),
      // excluded: location isn't allowed
      leagueRow({
        id: '555',
        location: 'PHL | Some Other Rec Center',
        days: 'Monday',
        status: 'Open',
      }),
      // excluded: no allowed day
      leagueRow({
        id: '666',
        location: 'PHL BURBS | Sutcliffe Park',
        days: 'Tuesday, Wednesday',
        status: 'Open',
      }),
    ].join('\n')
    const table = `<table><tbody>${html}</tbody></table>`

    nock('https://widget.leaguelab.com')
    .get('/v1/heydayathletic/league-listing?sport=Softball')
    .reply(200, table)

    nockNotion({
      method: 'post',
      path: '/v1/data_sources/softball-id/query',
      reply: {
        results: [
          {
            id: 'page-111',
            properties: {
              Name: { title: richText('111') },
            },
          },
        ],
        has_more: false,
        next_cursor: null,
      },
    })

    const updateSnapshot = snapshotBody(nockNotion({
      method: 'patch',
      path: '/v1/pages/page-111',
    }), 'update-111')

    // both new leagues post to the same endpoint concurrently, so their
    // request bodies are collected and sorted before snapshotting to avoid
    // depending on which one happens to hit the wire first
    const addBodies: any[] = []

    nockNotion({
      method: 'post',
      path: '/v1/pages',
      times: 2,
    })
    .on('request', (_req, _interceptor, body) => {
      addBodies.push(JSON.parse(body))
    })

    await getSoftballLeagues({
      notionToken: 'notion-token',
      softballLeaguesDataSourceId: 'softball-id',
    })

    await updateSnapshot

    const sortedAddBodies = [...addBodies].sort((a, b) => {
      return a.properties.Name.title[0].text.content.localeCompare(b.properties.Name.title[0].text.content)
    })

    expect(sortedAddBodies).toMatchSnapshot('add-222-and-333')
  })
})
