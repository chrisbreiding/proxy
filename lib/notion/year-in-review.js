const debug = require('debug')('proxy:scripts')
const minimist = require('minimist')

const { appendBlockChildren, getBlockChildren, getPlainText, makeBlock } = require('./util')
const { compact } = require('../util/collections')
const { patienceDiffPlus } = require('../util/patience-diff')
const { getEnv } = require('../util/env')

const notionToken = getEnv('NOTION_TOKEN')
const donePageId = getEnv('NOTION_DONE_ID')

debug('ENV:', {
  notionToken,
  donePageId,
})

const findId = (blocks, filter, error) => {
  const block = blocks.find(filter)

  if (!block && error) {
    throw new Error(error)
  }

  return block ? block.id : undefined
}

const getPageIds = async (year) => {
  const { results: doneBlocks } = await getBlockChildren({ notionToken, pageId: donePageId })

  const yearId = findId(doneBlocks, (block) => {
    return block.child_page && block.child_page.title === `${year}`
  }, `Could not find page for year: ${year}`)

  const { results: yearBlocks } = await getBlockChildren({ notionToken, pageId: yearId })

  const months = compact(yearBlocks.map((block) => {
    if (!block.child_page) return

    return {
      id: block.id,
      name: block.child_page.title,
    }
  }))

  return {
    months,
    yearId,
  }
}

const getSimilarity = (string1, string2) => {
  const diff = patienceDiffPlus(string1.split(' '), string2.split(' '))

  return (
    diff.lines.length - diff.lineCountMoved - diff.lineCountDeleted - diff.lineCountInserted
  ) / (diff.lines.length - diff.lineCountMoved)
}

const withoutEmoji = (text) => {
  return text.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '').trim()
}

const whitespaceRegex = /\W+/g

const normalizeWhitespace = (text) => {
  return text.replace(whitespaceRegex, ' ')
}

const findMatching = (data, quest) => {
  const normalizedQuestName = normalizeWhitespace(quest)
  const questNameWithoutEmoji = withoutEmoji(normalizedQuestName)

  for (let storedQuests of data) {
    let hasSimilarity = false

    for (let storedQuest of storedQuests) {
      const normalizedStoredQuestName = normalizeWhitespace(storedQuest.quest)

      if (normalizedStoredQuestName === normalizedQuestName) {
        return { exact: true, addTo: storedQuest }
      }

      if (getSimilarity(withoutEmoji(normalizedStoredQuestName), questNameWithoutEmoji) > 0.5) {
        hasSimilarity = true
      }
    }

    if (hasSimilarity) {
      return { exact: false, addTo: storedQuests }
    }
  }
}

const dateRegex = /[A-Za-z]{3}, (\d{1,2}\/\d{1,2})/

const getMonthData = async (month, data) => {
  const { results } = await getBlockChildren({ notionToken, pageId: month.id })

  let date

  for (let block of results) {
    const text = getPlainText(block)

    if (!text) continue

    const dateMatch = text.match(dateRegex)

    if (dateMatch) {
      date = dateMatch[1]

      continue
    }

    const match = findMatching(data, text)

    if (!match) {
      data.push([{
        dates: [date],
        quest: text,
      }])

      continue
    }

    if (match.exact) {
      match.addTo.dates.push(date)
    } else {
      match.addTo.push({
        dates: [date],
        quest: text,
      })
    }
  }

  return data
}

const getDates = (quests) => quests.map((q) => q.dates).flat()

const getData = async (months) => {
  let data = []

  for (let month of months) {
    data = await getMonthData(month, data)
  }

  return data
  .filter((quests) => {
    return getDates(quests).length > 3
  })
  .map((quests) => {
    return quests.sort((a, b) => a.quest.length - b.quest.length)
  })
  .sort((a, b) => getDates(b).length - getDates(a).length)
}

const makeBlocks = (data) => {
  return data.map((quests) => {
    return makeBlock({
      text: `${quests[0].quest} (${getDates(quests).length})`,
      type: 'toggle',
      children: quests.map(({ quest, dates }) => {
        return makeBlock({
          text: `${quest} (${dates.length}) [${dates.join(', ')}]`,
          type: 'bulleted_list_item',
        })
      }),
    })
  })
}

const yearInReview = async () => {
  try {
    const args = minimist(process.argv.slice(2))

    if (!args.year) {
      throw new Error('Must specify --year')
    }

    const { months, yearId } = await getPageIds(args.year)
    const data = await getData(months)
    const blocks = makeBlocks(data)

    await appendBlockChildren({ notionToken, blocks, pageId: yearId })

    // eslint-disable-next-line no-console
    console.log('Successfully added Year In Review')

    process.exit(0)
  } catch (error) {
    // eslint-disable-next-line no-console
    console.log('Adding year failed:')
    // eslint-disable-next-line no-console
    console.log(error.stack)

    process.exit(1)
  }
}

yearInReview()
