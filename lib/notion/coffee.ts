import type { DataSource } from './types'
import { queryDataSources } from './util/queries'

interface GetGrindSizesOptions {
  notionToken: string
  notionBeansId: string
}

export async function getActiveBeanDetails ({ notionToken, notionBeansId }: GetGrindSizesOptions) {
  const { results } = await queryDataSources({
    notionToken,
    dataSourceId: notionBeansId,
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
  })

  return results as DataSource[]
}
