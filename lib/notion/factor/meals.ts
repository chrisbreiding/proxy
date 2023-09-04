import type express from 'express'

import { getEnv } from '../../util/env'
import dayjs from 'dayjs'
import type { Rating } from './types'
import { getDatabasePages } from '../util/queries'
import { addDatabasePage } from '../util/updates'
import { richTextToPlainText } from '../util/conversions'

const notionToken = getEnv('NOTION_TOKEN')!
const databaseId = getEnv('NOTION_FACTOR_MEALS_DATABASE_ID')!

export async function getMeals (req: express.Request, res: express.Response) {
  try {
    const databasePages = await getDatabasePages({
      notionToken,
      databaseId,
    })

    const meals = databasePages.map((databasePage) => {
      const { properties } = databasePage
      // @ts-ignore
      const nameRichText = properties.Name.title
      const name = richTextToPlainText(nameRichText)
      // @ts-ignore
      const descriptionRichText = properties.Description.rich_text
      const description = richTextToPlainText(descriptionRichText)
      // @ts-ignore
      const rating = properties.Rating.select.name as Rating

      return {
        name,
        description,
        rating,
      }
    })

    res.json(meals)
  } catch (error: any) {
    res.status(500).json({
      error: {
        code: error?.code,
        message: error?.message,
      },
      data: error?.response?.data,
    })
  }
}

const getDate = (dateString: string) => {
  const currentDate = dayjs()
  const date = dayjs(dateString).year(dayjs().year())

  // date is for the following year
  if (currentDate.month() > date.month()) {
    return date.add(1, 'year')
  }

  return date
}

interface MealProperties {
  Date?: { date: { start: string } }
  Description: { rich_text: [{ type: 'text', text: { content: string } }] },
  Rating: { select: { name: Rating } },
  Name: { title: [{ type: 'text', text: { content: string } }] },
}

export async function addMeal (req: express.Request, res: express.Response) {
  try {
    const { name, date: dateString, description, rating } = req.body
    const properties = {
      Description: { rich_text: [{ type: 'text', text: { content: description } }] },
      Rating: { select: { name: rating } },
      Name: { title: [{ type: 'text', text: { content: name } }] },
    } as MealProperties

    if (dateString) {
      const date = getDate(dateString)

      properties.Date = { date: { start: date.format('YYYY-MM-DD') } }
    }

    await addDatabasePage<MealProperties>({
      notionToken,
      databaseId,
      properties,
    })

    res.sendStatus(200)
  } catch (error: any) {
    res.status(500).json({
      error: {
        code: error?.code,
        message: error?.message,
      },
      data: error?.response?.data,
    })
  }
}
