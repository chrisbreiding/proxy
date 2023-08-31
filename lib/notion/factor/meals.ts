import type express from 'express'

import { addDatabasePage, getDatabasePages, richTextToPlainText } from '../util'
import { getEnv } from '../../util/env'
import dayjs from 'dayjs'

const notionToken = getEnv('NOTION_TOKEN')!
const databaseId = getEnv('NOTION_FACTOR_MEALS_DATABASE_ID')!

const ratingConversion = {
  '★☆☆☆': 1,
  '★★☆☆': 2,
  '★★★☆': 3,
  '★★★★': 4,
}

function ratingToNumber (rating: keyof typeof ratingConversion) {
  return ratingConversion[rating]
}

export interface Meal {
  name: string;
  description: string;
  rating: number;
}

export async function getMeals (req: express.Request, res: express.Response) {
  try {
    const databasePages = await getDatabasePages({
      notionToken,
      databaseId,
    })

    const meals = databasePages.map((databasePage) => {
      const { properties } = databasePage
      // @ts-ignore
      const name = richTextToPlainText(properties.Name.title)
      // @ts-ignore
      const description = richTextToPlainText(properties.Description.rich_text)
      // @ts-ignore
      const rating = ratingToNumber(properties.Rating.select.name)

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

export async function addMeal (req: express.Request, res: express.Response) {
  try {
    const { name, date: dateString, description } = req.body
    const date = getDate(dateString)
    const properties = {
      Description: { rich_text: [{ type: 'text', text: { content: description } }] },
      Rating: { select: { name: '– – – –' } },
      Date: { date: { start: date.format('YYYY-MM-DD') } },
      Name: { title: [{ type: 'text', text: { content: name } }] },
    }

    await addDatabasePage({
      notionToken,
      databaseId,
      properties,
    })

    res.json({})
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
