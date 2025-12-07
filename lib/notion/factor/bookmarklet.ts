import { Rating, NotionMeal } from './types'

interface Meal {
  card: Element
  description: string | null
  isGourmetPlus: boolean
  isNew: boolean
  isNonMeat: boolean
  isTopRated: boolean
  name: string | null | undefined
  notionMeal?: NotionMeal
}

const Color = {
  Brown: '#86552e',
  DarkRed: '#86552e',
  Blue: '#4666da',
  Green: '#6fbd58',
  Grey: '#575b69',
} as const

type ColorValue = (typeof Color)[keyof typeof Color]

interface ButtonProps {
  card: HTMLElement
  color: ColorValue
  description: string
  name: string
  onClick: () => void
  position?: {
    right: string
    top: string
  }
  rating: Rating
}

type Ranking = 0|1|2|3|4|5|6|7|8|9|10|11|12|13

(async () => {
  const ratingColors = {
    [Rating.OneStar]: Color.Brown,
    [Rating.TwoStars]: Color.DarkRed,
    [Rating.ThreeStars]: Color.Blue,
    [Rating.FourStars]: Color.Green,
    [Rating.Considering]: Color.Grey,
    [Rating.Uninterested]: Color.Brown,
    [Rating.DietRestricted]: Color.Grey,
  }

  function indexString (name?: string | null) {
    return (name || '').trim()
  }

  function applySharedStyles (el: HTMLElement, position = { right: '10px', top: '10px' }) {
    el.style.color = 'white'
    el.style.borderRadius = '3px'
    el.style.position = 'absolute'
    el.style.right = position.right
    el.style.top = position.top
    el.style.fontSize = '20px'
    el.style.boxShadow = '0 0 5px black'
  }

  function adornCard (card: HTMLElement, rating: Rating) {
    const color = ratingColors[rating]

    card.style.outline = `solid 5px ${color}`

    const el = document.createElement('div')
    el.textContent = rating
    el.style.backgroundColor = color
    el.style.padding = '1px 6px 5px'
    applySharedStyles(el)

    card.appendChild(el)
  }

  function createButton (props: ButtonProps) {
    const button = document.createElement('button')
    button.setAttribute('type', 'button')
    button.textContent = `+ ${props.rating}`
    button.style.backgroundColor = props.color
    button.style.padding = '5px 10px'
    button.style.border = 'none'
    button.style.cursor = 'pointer'
    button.setAttribute('data-notion-factor-bookmarklet', 'true')
    applySharedStyles(button, props.position)

    button.onclick = async () => {
      try {
        await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: props.name || '',
            description: props.description || '',
            date: props.rating === Rating.Uninterested ? undefined : date,
            rating: props.rating,
          }),
        })

        props.onClick()
        adornCard(props.card as HTMLElement, props.rating)
      } catch (err: any) {
        // eslint-disable-next-line no-console
        console.log('Adding meal failed:', err.stack)
      }

    }

    props.card.appendChild(button)

    return button
  }

  function getMealRanking (meal: Meal): Ranking {
    //  0 - 4 stars
    //  1 - "Top-Rated" & Considering
    //  2 - "Top-Rated", not in Notion
    //  3 - "New" & Considering
    //  4 - "New", not in Notion
    //  5 - Considering
    //  6 - Unrated / Not yet considered
    //  7 - 3 stars
    //  8 - "Vegan/Vegetarian"
    //  9 - 2 stars
    // 10 - 1 star
    // 11 - Uninterested
    // 12 - Diet-restricted
    // 13 - "Gourmet plus"

    if (meal.isGourmetPlus) {
      return 13
    }

    if (meal.notionMeal?.rating === Rating.DietRestricted) {
      return 12
    }

    if (meal.notionMeal?.rating === Rating.Uninterested) {
      return 11
    }

    if (meal.notionMeal?.rating === Rating.OneStar) {
      return 10
    }

    if (meal.notionMeal?.rating === Rating.TwoStars) {
      return 9
    }

    if (meal.isNonMeat) {
      return 8
    }

    if (meal.notionMeal?.rating === Rating.ThreeStars) {
      return 7
    }

    if (meal.isNew && !meal.notionMeal) {
      return 4
    }

    if (meal.isNew && meal.notionMeal?.rating === Rating.Considering) {
      return 3
    }

    if (meal.isTopRated && !meal.notionMeal) {
      return 2
    }

    if (meal.isTopRated && meal.notionMeal?.rating === Rating.Considering) {
      return 1
    }

    if (meal.notionMeal?.rating === Rating.Considering) {
      return 5
    }

    if (meal.notionMeal?.rating === Rating.FourStars) {
      return 0
    }

    // unrated / not yet considered
    return 6
  }

  function hasMeal (meal?: Meal): meal is Meal {
    return !!meal
  }

  if (document.querySelector('[data-notion-factor-bookmarklet="true"]')) {
    // eslint-disable-next-line no-console
    console.log('🍽️ 🥗 🍲 Notion Factor Bookmarklet already applied. Refresh and try again. 🍲 🥗 🍽️')
  }

  // const url = `http://localhost:3333/notion/factor-meals/${process.env.API_KEY}`
  const url = `https://proxy.crbapps.com/notion/factor-meals/${process.env.API_KEY}`
  const recordedMeals = (await (await fetch(url)).json()) as NotionMeal[]
  const mealsIndex = recordedMeals.reduce((memo, meal) => {
    memo[indexString(meal.name)] = meal

    return memo
  }, {} as Record<string, NotionMeal>)

  const mealDescriptionNodes = document.querySelectorAll('[data-recipe-card-headline="true"]')
  const dateNode = document.querySelector('.web-1brazu4')
  const date = dateNode?.textContent
  const container = mealDescriptionNodes[0].closest('ul')

  Array.from(mealDescriptionNodes).map((descriptionNode) => {
    const nameNode = descriptionNode.parentNode!.querySelector('[data-recipe-card-title="true"]')
    const name = nameNode?.textContent || ''
    const description = descriptionNode.textContent || ''
    const matchingMeal = mealsIndex[indexString(name)]
    const card = descriptionNode.closest('.editCard')

    if (!card) return

    if (matchingMeal) {
      adornCard(card as HTMLElement, matchingMeal.rating)
    } else {
      const onClick = () => {
        consideringButton.remove()
        uninterestedButton.remove()
        dietRestrictedButton.remove()
      }

      const commonProperties = {
        card: card as HTMLElement,
        description,
        name,
        onClick,
      }

      const consideringButton = createButton({
        ...commonProperties,
        color: Color.Green,
        rating: Rating.Considering,
      })
      const uninterestedButton = createButton({
        ...commonProperties,
        color: Color.Brown,
        position: {
          right: '10px',
          top: '50px',
        },
        rating: Rating.Uninterested,
      })
      const dietRestrictedButton = createButton({
        ...commonProperties,
        color: Color.Grey,
        position: {
          right: '10px',
          top: '90px',
        },
        rating: Rating.DietRestricted,
      })
    }

    return {
      card: card.closest('li'),
      description,
      isGourmetPlus: !!card.querySelector('[title="Gourmet Plus"]'),
      isNew: !!card.querySelector('[title="New"]'),
      isNonMeat: !!card.querySelector('[title="Vegan"]') || !!card.querySelector('[title="Vegetarian"]'),
      isTopRated: !!card.querySelector('[title="Top-Rated"]'),
      notionMeal: matchingMeal,
      name,
    } as Meal
  })
  .filter(hasMeal)
  .sort((a, b) => {
    const aRanking = getMealRanking(a)
    const bRanking = getMealRanking(b)

    return aRanking - bRanking
  })
  .forEach(({ card }) => {
    if (!container) return

    container.appendChild(card)
  })
})()
