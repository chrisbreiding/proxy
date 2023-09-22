import type {
  BlockObjectResponse,
  BookmarkBlockObjectResponse,
  BulletedListItemBlockObjectResponse,
  CalloutBlockObjectResponse,
  ChildDatabaseBlockObjectResponse,
  ChildPageBlockObjectResponse,
  ColumnBlockObjectResponse,
  ColumnListBlockObjectResponse,
  DividerBlockObjectResponse,
  EmbedBlockObjectResponse,
  EquationBlockObjectResponse,
  FileBlockObjectResponse,
  Heading1BlockObjectResponse,
  Heading2BlockObjectResponse,
  Heading3BlockObjectResponse,
  ImageBlockObjectResponse,
  LinkPreviewBlockObjectResponse,
  LinkToPageBlockObjectResponse,
  NumberedListItemBlockObjectResponse,
  ParagraphBlockObjectResponse,
  PdfBlockObjectResponse,
  QuoteBlockObjectResponse,
  SyncedBlockBlockObjectResponse,
  TableBlockObjectResponse,
  TableOfContentsBlockObjectResponse,
  TableRowBlockObjectResponse,
  TemplateBlockObjectResponse,
  ToDoBlockObjectResponse,
  ToggleBlockObjectResponse,
  UnsupportedBlockObjectResponse,
  UpdateBlockBodyParameters,
  VideoBlockObjectResponse,
} from '@notionhq/client/build/src/api-endpoints'

export type Content = BookmarkBlockObjectResponse['bookmark']
| BulletedListItemBlockObjectResponse['bulleted_list_item']
| CalloutBlockObjectResponse['callout']
| ChildDatabaseBlockObjectResponse['child_database']
| ChildPageBlockObjectResponse['child_page']
| ColumnBlockObjectResponse['column']
| ColumnListBlockObjectResponse['column_list']
| DividerBlockObjectResponse['divider']
| EmbedBlockObjectResponse['embed']
| EquationBlockObjectResponse['equation']
| FileBlockObjectResponse['file']
| Heading1BlockObjectResponse['heading_1']
| Heading2BlockObjectResponse['heading_2']
| Heading3BlockObjectResponse['heading_3']
| ImageBlockObjectResponse['image']
| LinkPreviewBlockObjectResponse['link_preview']
| LinkToPageBlockObjectResponse['link_to_page']
| NumberedListItemBlockObjectResponse['numbered_list_item']
| ParagraphBlockObjectResponse['paragraph']
| PdfBlockObjectResponse['pdf']
| QuoteBlockObjectResponse['quote']
| SyncedBlockBlockObjectResponse['synced_block']
| TableBlockObjectResponse['table']
| TableOfContentsBlockObjectResponse['table_of_contents']
| TableRowBlockObjectResponse['table_row']
| TemplateBlockObjectResponse['template']
| ToDoBlockObjectResponse['to_do']
| ToggleBlockObjectResponse['toggle']
| UnsupportedBlockObjectResponse['unsupported']
| VideoBlockObjectResponse['video']

export interface OwnBlock {
  children?: OwnBlock[] | NotionBlock[]
  type: BlockObjectResponse['type']
  content: Content
}

export interface NotionBlock extends OwnBlock {
  children?: NotionBlock[]
  has_children: boolean
  id: string
  parentId: string
}

export type Block = OwnBlock | NotionBlock

export type OutgoingBlock = UpdateBlockBodyParameters & {
  object: string
  type: BlockObjectResponse['type']
}
