import type { BlockObjectResponse } from '@notionhq/client/build/src/api-endpoints'
import { readJsonSync } from 'fs-extra'
import nock from 'nock'

import { fixture, uniqueId } from '../../util'

const notionVersion = '2022-06-28'

export function notionFixture (name: string) {
  return fixture(`notion/${name}`)
}

export function notionFixtureContents (name: string) {
  return readJsonSync(notionFixture(name))
}

interface GetOptions {
  fixture?: string
  reply?: object
  times?: number
}

interface NockOptions extends GetOptions {
  body?: object
  error?: string | object
  method?: string
  path: string
}

export function nockNotion (options: NockOptions) {
  const scope = nock('https://api.notion.com')
  .matchHeader('authorization', 'Bearer notion-token')
  .matchHeader('notion-version', notionVersion)
  .intercept(
    options.path,
    (options.method || 'get').toUpperCase(),
    options.body as nock.DataMatcherMap,
  )
  .times(options.times || 1)

  if (options.error) {
    return scope.replyWithError(options.error)
  }


  const reply = options.fixture
    ? notionFixtureContents(options.fixture)
    : options.reply

  return scope.reply(200, reply)
}

export function nockGetBlockChildren (id: string, options: GetOptions) {
  nockNotion({
    path: `/v1/blocks/${id}/children`,
    ...options,
  })
}

interface AppendOptions {
  id: string
  fixture?: string
  reply?: object
}

export function nockAppendBlockChildren ({ id, fixture, reply }: AppendOptions) {
  return nockNotion({
    fixture,
    method: 'patch',
    path: `/v1/blocks/${id}/children`,
    reply,
  })
}

interface UpdateOptions {
  fixture?: string
}

export function nockUpdateBlock (id: string, { fixture: fixtureName }: UpdateOptions = {}) {
  const update = fixtureName ? notionFixtureContents(fixtureName) : undefined

  return nock('https://api.notion.com')
  .matchHeader('authorization', 'Bearer notion-token')
  .matchHeader('notion-version', notionVersion)
  .patch(`/v1/blocks/${id}`, update)
  .reply(200)
}

export function nockDeleteBlock (id: string) {
  return nock('https://api.notion.com')
  .matchHeader('authorization', 'Bearer notion-token')
  .matchHeader('notion-version', notionVersion)
  .delete(`/v1/blocks/${id}`)
  .reply(200)
}

interface BlockOptions {
  id?: string
  text: string
  type?: string
}

export function block ({ id, text, type }: BlockOptions) {
  return {
    object: 'block',
    id: id || uniqueId('block-'),
    parent: {
      type: 'page_id',
      page_id: uniqueId('page-'),
    },
    created_time: '2022-0829T23:00.000Z',
    last_edited_time: '2022-0829T23:00.000Z',
    created_by: {
      object: 'user',
      id: uniqueId('user-'),
    },
    last_edited_by: {
      object: 'user',
      id: uniqueId('user-'),
    },
    has_children: type === 'toggle',
    archived: false,
    type: type || 'paragraph',
    [type || 'paragraph']: {
      rich_text: [
        {
          type: 'text',
          text: {
            content: text,
            link: null,
          },
          annotations: {
            bold: false,
            italic: false,
            strikethrough: false,
            underline: false,
            code: false,
            color: 'default',
          },
          plain_text: text,
          href: null,
        },
      ],
      color: 'default',
    },
  } as BlockObjectResponse
}

block.p = ({ id, text }: BlockOptions) => {
  return block({ id, text, type: 'paragraph' })
}

block.bullet = ({ id, text }: BlockOptions) => {
  return block({ id, text, type: 'bulleted_list_item' })
}

block.toggle = ({ id, text }: BlockOptions) => {
  return block({ id, text, type: 'toggle' })
}
