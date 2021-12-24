const dayjs = require('dayjs')
const debug = require('debug')('proxy:scripts')
const minimist = require('minimist')

const { appendBlockChildren, getBlockChildren, getPlainText, makeBlock, removeAnnotations } = require('./util')
const { clone, compact } = require('../util/collections')
const { getEnv } = require('../util/env')

const notionToken = getEnv('NOTION_TOKEN')
const futurePageId = getEnv('NOTION_FUTURE_ID')

debug('ENV:', {
  notionToken,
  futurePageId,
})

const getBlockContent = async (block) => {
  if (!block[block.type].text[0].plain_text.trim()) return

  const children = block.has_children ? (await getChildrenContent(block.id)) : undefined

  return {
    object: 'block',
    type: block.type,
    [block.type]: {
      text: removeAnnotations(block[block.type].text),
    },
    children,
  }
}

const getChildrenContent = async (pageId) => {
  const { results } = await getBlockChildren({ notionToken, pageId })

  const blocks = await Promise.all(results.map(getBlockContent))

  return compact(blocks)
}

const getYearTemplate = async (yearTemplateId) => {
  const { results } = await getBlockChildren({ notionToken, pageId: yearTemplateId })

  const blocks = results.filter((block) => {
    return block.has_children
  })

  return Promise.all(blocks.map(async (block) => {
    return {
      rule: getPlainText(block),
      quests: await getChildrenContent(block.id),
    }
  }))
}

const getMonthNameFromIndex = (monthIndex) => {
  return dayjs().month(monthIndex).format('MMMM')
}

const getMonths = () => {
  return Array.from(new Array(12)).map((_, i) => {
    return getMonthNameFromIndex(i)
  })
}

const getStartingMonthsData = () => {
  return getMonths().map((name, index) => {
    return {
      name,
      index,
      dates: {},
    }
  })
}

const everyMonthRegex = /Every month( on (\d{1,2})\w{2})?/
const evenMonthsRegex = /Even months( on (\d{1,2}\w{2}))?/
const oddsMonthsRegex = /Odd months( on (\d{1,2}\w{2}))?/
const monthPattern = `(?:${getMonths().join('|')})`
const monthRegex = new RegExp(monthPattern)
const monthsRegex = new RegExp(`(${monthPattern}(?:(?:, )${monthPattern})*)`)
const dateRegex = / on (\d{1,2})[a-z]{2}/
const numberRegex = /^\d+$/

const patterns = [
  // <month>[, <month>...]
  (templateString) => {
    const match = templateString.match(everyMonthRegex)

    if (!match) return { matches: false }

    if (!match[2]) return { matches: true, date: 1 }

    return { matches: true, date: Number(match[2]) }
  },
  // Every month [on <date>] (or assume 1st)
  (templateString, monthIndex) => {
    if (monthIndex % 2 === 0) return { matches: false }

    const match = templateString.match(evenMonthsRegex)

    if (!match) return { matches: false }

    if (!match[2]) return { matches: true, date: 1 }

    return { matches: true, date: Number(match[2]) }
  },
  // Even months [on <date>] (or assume 1st)
  (templateString, monthIndex) => {
    if (monthIndex % 2 !== 0) return { matches: false }

    const match = templateString.match(oddsMonthsRegex)

    if (!match) return { matches: false }

    if (!match[2]) return { matches: true, date: 1 }

    return { matches: true, date: Number(match[2]) }
  },
  // Odd months [on <date>] (or assume 1st)
  (templateString, monthIndex) => {
    const monthsMatch = templateString.match(monthsRegex)
    const dateMatch = templateString.match(dateRegex)

    if (!monthsMatch) return { matches: false }

    const matchedMonths = monthsMatch[1].split(/\s*,\s*/)
    const monthName = getMonthNameFromIndex(monthIndex)

    if (!matchedMonths.includes(monthName)) return { matches: false }

    if (!dateMatch || !dateMatch[1]) return { matches: true, date: 1 }

    return { matches: true, date: Number(dateMatch[1]) }
  },
]

const ascending = (a, b) => a - b

const datesObjectToSortedArray = (dates) => {
  return Object.keys(dates).sort(ascending).map((date) => {
    return { date, quests: dates[date] }
  })
}

const getExtras = async (extrasId) => {
  const { results } = await getBlockChildren({ notionToken, pageId: extrasId })

  const months = {}
  let currentMonth
  let currentDate

  for (let block of results) {
    const text = getPlainText(block)

    if (!text) {
      currentMonth = undefined
      currentDate = undefined

      continue
    }

    if (monthRegex.test(text)) {
      months[text] = {}
      currentMonth = text

      continue
    }

    if (numberRegex.test(text)) {
      if (!currentMonth) {
        throw new Error(`Tried to add the following date, but could not determine the month: '${text}'`)
      }

      months[currentMonth][text] = []
      currentDate = text

      continue
    }

    if (!currentMonth) {
      throw new Error(`Tried to add the following quest, but could not determine the month: '${text}'`)
    }

    if (!currentDate) {
      throw new Error(`Tried to add the following quest, but could not determine the date: '${text}'`)
    }

    const content = await getBlockContent(block)
    months[currentMonth][currentDate].push(content)
  }

  return months
}

const getMonthsData = (yearTemplate, extras) => {
  return getStartingMonthsData().map((month) => {
    for (let template of yearTemplate) {
      for (let matchesPattern of patterns) {
        const result = matchesPattern(template.rule, month.index)

        if (result.matches) {
          const quests = clone(template.quests)
          month.dates[result.date] = (month.dates[result.date] || []).concat(quests)
        }
      }
    }

    const monthExtras = extras[month.name]

    if (monthExtras) {
      for (let date in monthExtras) {
        month.dates[date] = (month.dates[date] || []).concat(monthExtras[date])
      }
    }

    return {
      ...month,
      dates: datesObjectToSortedArray(month.dates),
    }
  })
}

const getDateString = (year, month, date) => {
  return dayjs(`${year}/${month}/${date}`, 'YYYY/M/D').format('ddd, M/D')
}

const makeBlocks = (monthsData, year) => {
  const blocks = monthsData.map(({ name, index, dates }) => {
    if (!dates.length) return

    return [
      makeBlock({
        text: '',
        type: 'paragraph',
      }),
      makeBlock({
        text: name,
        type: 'paragraph',
        annotations: {
          bold: true,
        },
      }),
      ...dates.map(({ date, quests }) => {
        return [
          makeBlock({
            text: getDateString(year, index + 1, date),
            type: 'paragraph',
          }),
          ...quests,
        ]
      }),
    ]
  })

  return compact(blocks.flat())
}

const findId = (blocks, filter, error) => {
  const block = blocks.find(filter)

  if (!block && error) {
    throw new Error(error)
  }

  return block ? block.id : undefined
}

const getPageIds = async (year) => {
  const { results } = await getBlockChildren({ notionToken, pageId: futurePageId })

  const extrasId = findId(results, (block) => {
    return block.child_page && block.child_page.title === `${year}`
  })

  const dropZoneId = findId(results, (block) => {
    return block.type === 'synced_block'
  }, 'Could not find drop zone')

  const yearTemplateId = findId(results, (block) => {
    return block.child_page && block.child_page.title === 'Year Template'
  }, 'Could not find year template')

  return {
    extrasId,
    dropZoneId,
    yearTemplateId,
  }
}

const addYear = async () => {
  try {
    const args = minimist(process.argv.slice(2))

    if (!args.year) {
      throw new Error('Must specify --year')
    }

    const { yearTemplateId, dropZoneId, extrasId } = await getPageIds(args.year)
    const yearTemplateBlocks = await getYearTemplate(yearTemplateId)
    const extras = extrasId ? await getExtras(extrasId) : {}
    const monthsData = getMonthsData(yearTemplateBlocks, extras)
    const blocks = makeBlocks(monthsData, args.year)

    await appendBlockChildren({ notionToken, blocks, pageId: dropZoneId })

    // eslint-disable-next-line no-console
    console.log('Successfully added year')

    process.exit(0)
  } catch (error) {
    // eslint-disable-next-line no-console
    console.log('Adding year failed:')
    // eslint-disable-next-line no-console
    console.log(error.stack)

    process.exit(1)
  }
}

addYear()
