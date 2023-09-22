import type { BlockObjectResponse } from '@notionhq/client/build/src/api-endpoints'
import { readJsonSync } from 'fs-extra'
import nock from 'nock'

import { createUniqueId, fixture } from '../../util'

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

export function richText (text?: string) {
  if (!text) return []

  return [
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
  ]
}

interface BlockOptions {
  content?: any
  hasChildren?: boolean
  id?: string
  parentId?: string
  text?: string
  type?: string
}

function getHasChildren (type: string, hasChildren?: boolean) {
  if (hasChildren != null) return hasChildren

  return type === 'toggle'
}

export function blockFactory ({ parentId }: { parentId?: string } = {}) {
  const uniqueId = createUniqueId()

  function block (options: BlockOptions = {}) {
    const { content, id, parentId: parentIdOverride, text } = options
    const type = options.type || 'paragraph'
    const hasChildren = getHasChildren(type, options.hasChildren)
    const generatedId = uniqueId()

    return {
      object: 'block',
      id: id || `block-${generatedId}`,
      parent: {
        type: 'page_id',
        page_id: parentIdOverride || parentId || `parent-${generatedId}`,
      },
      created_time: '2022-0829T23:00.000Z',
      last_edited_time: '2022-0829T23:00.000Z',
      created_by: {
        object: 'user',
        id: `user-${generatedId}`,
      },
      last_edited_by: {
        object: 'user',
        id: `user-${generatedId}`,
      },
      has_children: hasChildren,
      archived: false,
      type,
      [type]: content || {
        rich_text: richText(text),
        color: 'default',
      },
    } as BlockObjectResponse
  }

  block.p = (options: Omit<BlockOptions, 'type'> = {}) => {
    return block({ ...options, type: 'paragraph' })
  }

  block.bullet = (options: Omit<BlockOptions, 'type'> = {}) => {
    return block({ ...options, type: 'bulleted_list_item' })
  }

  block.toggle = (options: Omit<BlockOptions, 'type'> = {}) => {
    return block({ ...options, type: 'toggle' })
  }

  block.to_do = (options: Omit<BlockOptions, 'type'> = {}) => {
    return block({ ...options, type: 'to_do' })
  }

  block.divider = ({ id }: { id?: string } = {}) => {
    return block({ id, type: 'divider', content: {} })
  }

  return block
}

export const block = blockFactory()

export function listResults (results: BlockObjectResponse[], next?: string) {
  return {
    object: 'list',
    next_cursor: next || null,
    has_more: !!next,
    type: 'block',
    block: {},
    results,
  }
}
