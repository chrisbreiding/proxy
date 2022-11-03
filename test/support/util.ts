import fs from 'fs-extra'
import nock from 'nock'
import path from 'path'

const notionVersion = '2022-06-28'

export function fixture (name: string) {
  return path.join(__dirname, `../fixtures/${name}.json`)
}

interface GetOptions {
  fixture?: string
  reply?: object
  times?: number
}

interface NockOptions extends GetOptions {
  body?: object
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

  if (options.fixture) {
    scope.replyWithFile(200, fixture(options.fixture), {
      'Content-Type': 'application/json',
    })
  } else {
    scope.reply(200, options.reply)
  }

  return scope
}

export function nockGetBlockChildren (id: string, options: GetOptions) {
  nockNotion({
    path: `/v1/blocks/${id}/children`,
    ...options,
  })
}

interface AppendOptions {
  id: string
  body: object
  reply?: object
}

export function nockAppendBlockChildren ({ id, body, reply }: AppendOptions) {
  nockNotion({
    body,
    method: 'patch',
    reply,
    path: `/v1/blocks/${id}/children`,
  })
}

interface UpdateOptions {
  fixture: string
}

export function nockUpdateBlock (id: string, { fixture: fixtureName }: UpdateOptions) {
  const update = fs.readJsonSync(fixture(fixtureName))

  nock('https://api.notion.com')
  .matchHeader('authorization', 'Bearer notion-token')
  .matchHeader('notion-version', notionVersion)
  .patch(`/v1/blocks/${id}`, update as nock.DataMatcherMap)
  .reply(200)
}

function createUniqueId () {
  const tracker = {}
  let defaultCount = 0

  return (prefix?: string) => {
    if (!prefix) {
      return `${++defaultCount}`
    }

    const counter = (tracker[prefix] || 0) + 1

    tracker[prefix] = counter

    return `${prefix}${counter}`
  }
}

export const uniqueId = createUniqueId()

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
  }
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
