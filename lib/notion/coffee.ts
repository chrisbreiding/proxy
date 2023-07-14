import type { DatabaseObjectResponse } from '@notionhq/client/build/src/api-endpoints'
import { queryDatabases } from './util'

interface GetGrindSizesOptions {
  notionToken: string
  notionBeansId: string
}

export async function getActiveBeanDetails ({ notionToken, notionBeansId }: GetGrindSizesOptions) {
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

  return results
}
