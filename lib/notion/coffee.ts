import type { DatabaseObjectResponse } from '@notionhq/client/build/src/api-endpoints'
import { queryDatabases, richTextToPlainText } from './util'

interface GetGrindSizesOptions {
  notionToken: string
  notionBeansId: string
}

export async function getActiveGrindSizes ({ notionToken, notionBeansId }: GetGrindSizesOptions) {
  const { results } = await queryDatabases({
    notionToken,
    databaseId: notionBeansId,
    filter: {
      'and': [
        {
          'property': 'Active',
          'checkbox': {
            'equals': true,
          },
        },
      ],
    },
  }) as { results: DatabaseObjectResponse[] }

  return results.reduce((memo, { properties }) => {
    // @ts-ignore
    const strength = properties['Strength'].select.name as string
    // @ts-ignore
    const grindSize = richTextToPlainText(properties['Grind'].rich_text)

    return {
      ...memo,
      [strength.toLowerCase()]: grindSize,
    }
  }, {})
}
