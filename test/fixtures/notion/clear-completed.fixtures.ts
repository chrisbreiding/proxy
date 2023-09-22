import { compact } from '../../../lib/util/collections'
import { block, blockFactory, listResults, richText } from '../../lib/notion/util'

export const emptyList = listResults([])

export const page = (withRecentlyCleared = false) => {
  const block = blockFactory()

  return listResults(compact([
    block({ id: 'column-list-id', type: 'column_list', content: {} }),
    block.divider(),
    block.p({ text: 'Clear Completed' }),
    block.divider(),
    withRecentlyCleared ? block.toggle({ id: 'recently-cleared-id', text: 'Recently Cleared' }) : undefined,
    block.p(),
    block.p(),
  ]))
}

export const columns = listResults([
  block({ id: 'column-1-id', type: 'column', content: {} }),
  block({ id: 'column-2-id', type: 'column', content: {} }),
])

export const recentlyCleared = listResults([
  block.divider(),
  block.p({ text: 'Permanently Delete Recently Cleared' }),
  block.divider({ id: 'recently-cleared-divider-id' }),
  block.p({ text: 'Previously Deleted Store' }),
  block.to_do({ content: { rich_text: richText('Previously Removed'), checked: false } }),
])

export const column1 = (empty = false, allUnchecked = false) => {
  const block = blockFactory({ parentId: 'column-1-id' })

  return listResults(compact([
    block({ type: 'unsupported' }),
    block.p({ id: 'store-1-id', text: 'Store 1' }),
    block.to_do({ content: { rich_text: richText('Keep'), checked: false } }),
    block.to_do({
      id: 'item-1-1-id',
      content: {
        rich_text: richText('Remove 1.1'),
        checked: !allUnchecked,
      },
    }),
    block.p(),
    block.p({ id: 'store-2-id', text: 'Store 2' }),
    block.to_do({
      id: 'item-2-1-id',
      content: {
        rich_text: richText('Remove 2.1'),
        checked: !allUnchecked,
      },
    }),
    block.to_do({
      id: 'item-2-2-id',
      content: {
        rich_text: richText('Remove 2.2'),
        checked: !allUnchecked,
      },
    }),
    block.to_do({
      id: 'item-2-3-id',
      content: {
        rich_text: richText(empty ? 'Remove 2.3' : 'Keep'),
        checked: empty,
      },
    }),
    block.p(),
    block.p({ id: 'store-3-id', text: 'Store 3' }),
    block.to_do({ content: { rich_text: [], checked: false } }),
    block.p(),
  ]))
}

export const column2 = (empty = false, nested = false, allUnchecked = false) => {
  const block = blockFactory({ parentId: 'column-2-id' })

  return listResults(compact([
    block({ type: 'unsupported' }),
    block.p({ id: 'store-4-id', text: 'Store 4' }),
    block.to_do({
      id: 'item-4-1-id',
      hasChildren: nested,
      content: {
        rich_text: richText('Remove 4.1'),
        checked: !allUnchecked,
      },
    }),
    block.to_do({
      id: 'item-4-2-id',
      content: {
        rich_text: richText(empty ? 'Remove 4.2' : 'Keep'),
        checked: empty,
      },
    }),
    block.p(),
    block.p({ id: 'store-5-id', text: 'Store 5' }),
    block.to_do({ content: { rich_text: richText('Keep'), checked: false } }),
    block.to_do({
      id: 'item-5-1-id',
      hasChildren: nested,
      content: {
        rich_text: richText('Remove 5.1'),
        checked: !allUnchecked,
      },
    }),
    block.p(),
    block.p({ id: 'store-6-id', text: 'Store 6' }),
    nested ? block.toggle({ id: 'toggle-id', text: 'Notes' }) : undefined,
    block.to_do({ content: { rich_text: richText('Keep'), checked: false } }),
    block.to_do({ content: { rich_text: richText('Keep'), checked: false } }),
    block.p(),
  ]))
}

export const nested1 = listResults([
  block.bullet({ id: 'nested-1-id', text: 'Nested bullet' }),
])

export const nested2 = listResults([
  block.to_do({ id: 'nested-2-id', text: 'Nested checkbox' }),
])

export const nested3 = listResults([
  block.p({ id: 'nested-3-id', text: 'Nested paragraph' }),
])
