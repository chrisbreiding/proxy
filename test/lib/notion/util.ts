import type { BlockObjectResponse, ContentPositionSchema, ListBlockChildrenResponse, RichTextItemResponse } from '@notionhq/client'
import { readJsonSync } from 'fs-extra'
import nock from 'nock'
import { NotionToMarkdown } from 'notion-to-md'

import { createUniqueId, fixture, getBody } from '../../util'
import { expect } from 'vitest'
import type { OutgoingBlock } from '../../../lib/notion/types'

const notionVersion = '2025-09-03'

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
  token?: string
}

interface NockOptions extends GetOptions {
  body?: object
  error?: string | object
  method?: string
  path: string
  token?: string
}

export function nockNotion (options: NockOptions) {
  const scope = nock('https://api.notion.com')
  .matchHeader('authorization', `Bearer ${options.token || 'notion-token'}`)
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
  token?: string
}

export function nockAppendBlockChildren ({ id, fixture, reply, token }: AppendOptions) {
  return nockNotion({
    fixture,
    method: 'patch',
    path: `/v1/blocks/${id}/children`,
    reply,
    token,
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

export function richText (text?: string, annotations?: Partial<RichTextItemResponse['annotations']>) {
  if (!text) return []

  return [
    {
      type: 'text',
      text: {
        content: text,
        link: null,
      },
      annotations: annotations || {
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

export function toQueryString (keysAndValues: Record<string, string | null>) {
  return Object.entries(keysAndValues)
  .filter(([, value]) => !!value)
  .map(([key, value]) => {
    return `${key}=${value}`
  })
  .join('&')
}

// @ts-expect-error
const n2m = new NotionToMarkdown({ notionClient: {} })

function moveChildren (blocks: OutgoingBlock[]) {
  return blocks.map((block) => {
    // @ts-ignore
    if (!block[block.type].children) return block

    // @ts-ignore
    block.children = moveChildren(block[block.type].children)
    // @ts-ignore
    delete block[block.type].children

    return block
  }) as ListBlockChildrenResponse['results']
}

async function convertBlocksToMarkdown (blocks: OutgoingBlock[]) {
  const mdBlocks = await n2m.blocksToMarkdown(moveChildren(blocks))

  return n2m.toMarkdownString(mdBlocks).parent
}

interface AppendShape {
  after?: string
  children: OutgoingBlock[]
  position?: ContentPositionSchema
}

interface SnapshotAppendChildrenOptions extends AppendOptions {
  after?: string
  message?: string
  token?: string
  prepend?: true
}

async function assertSnapshot (content: any, message?: string) {
  const md = await convertBlocksToMarkdown(content)

  expect(typeof md).toEqual('string')
  expect(md).toMatchSnapshot(message)
}

export function getAppendBody (scope: nock.Scope) {
  return getBody<AppendShape>(scope)
}

export async function snapshotAppendChildren (options: SnapshotAppendChildrenOptions) {
  const scope = nockAppendBlockChildren(options)
  const body = await getAppendBody(scope)

  if (options.prepend) {
    expect(body.position?.type, 'Expected position type start').to.equal('start')
  }

  if (options.after) {
    expect(body.position?.type, 'Expected position type after_block').to.equal('after_block')
    if (body.position?.type === 'after_block') {
      expect(body.position.after_block.id, 'The after block ID does not match').to.equal(options.after)
    }
  }

  if (body.position?.type === 'after_block' && body.position?.after_block?.id && !options.after) {
    throw new Error(`snapshotAppendChildren: need to assert the after id: ${body.position.after_block.id}`)
  }

  await assertSnapshot(body.children, options.message)
}

interface SnapshotUpdateBlockOptions extends UpdateOptions {
  message?: string
}

async function getUpdateBody (id: string, options: SnapshotUpdateBlockOptions = {}) {
  const scope = nockUpdateBlock(id, options)

  return getBody<OutgoingBlock>(scope)
}

export async function snapshotUpdateBlock (id: string, options: SnapshotUpdateBlockOptions = {}) {
  const body = await getUpdateBody(id, options)

  await assertSnapshot([body], options.message)
}

export async function snapshotUpdateBlocks (ids: string[], options: SnapshotUpdateBlockOptions = {}) {
  const bodies = await Promise.all(ids.map((id) => getUpdateBody(id, options)))

  await assertSnapshot(bodies, options.message)
}
