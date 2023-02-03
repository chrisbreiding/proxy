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

  return results.map(({ properties }) => {
    return {
      // @ts-ignore
      strength: properties['Strength'].select.name as string,
      // @ts-ignore
      grindSize: richTextToPlainText(properties['Grind'].rich_text),
    }
  })
}
