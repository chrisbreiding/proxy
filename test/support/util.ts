import nock from 'nock'
import path from 'path'

const notionVersion = '2022-06-28'

export function fixture (name: string) {
  return path.join(__dirname, `../fixtures/${name}.json`)
}

interface GetOptions {
  fixture?: string
  reply?: object
}

export function nockGetBlockChildren (id: string, options: GetOptions) {
  const scope = nock('https://api.notion.com')
  .persist()
  .matchHeader('authorization', 'Bearer notion-token')
  .matchHeader('notion-version', notionVersion)
  .get(`/v1/blocks/${id}/children`)

  if (options.fixture) {
    scope.replyWithFile(200, fixture(options.fixture), {
      'Content-Type': 'application/json',
    })
  } else {
    scope.reply(200, options.reply)
  }
}
interface AppendOptions {
  id: string
  body: object
  reply: object
}

export function nockAppendBlockChildren ({ id, body, reply }: AppendOptions) {
  nock('https://api.notion.com')
  .matchHeader('authorization', 'Bearer notion-token')
  .matchHeader('notion-version', notionVersion)
  .patch(`/v1/blocks/${id}/children`, body as nock.DataMatcherMap)
  .reply(200, reply)
}
