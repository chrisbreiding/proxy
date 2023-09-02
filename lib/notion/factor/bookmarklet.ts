import { Rating, RecordedMeal } from './types'

interface Meal {
  card: Element
  description: string | null
  name: string | null | undefined
  meal?: RecordedMeal
  isGourmetPlus: boolean
  isNonMeat: boolean
  isNew: boolean
  isTopRated: boolean
}

enum Color {
  Brown = '#86552e',
  DarkRed = '#86552e',
  Blue = '#4666da',
  Green = '#6fbd58',
  Grey = '#575b69',
}

interface ButtonProps {
  card: HTMLElement
  color: Color
  description: string
  name: string
  onClick: () => void
  position?: {
    right: string
    top: string
  }
  rating: Rating
}

type Ranking = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11

(async () => {
  const ratingColors = {
    [Rating.OneStar]: Color.Brown,
    [Rating.TwoStars]: Color.DarkRed,
    [Rating.ThreeStars]: Color.Blue,
    [Rating.FourStars]: Color.Green,
    [Rating.Unrated]: Color.Grey,
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
    //  1 - "Top-Rated"
    //  2 - "New"
    //  3 - Unrated, in Notion
    //  4 - Unrated, not in Notion
    //  5 - 3 stars
    //  6 - "Vegan/Vegetarian"
    //  7 - 2 stars
    //  8 - 1 star
    //  9 - Uninterested
    // 10 - Diet-restricted
    // 11 - "Gourmet plus"

    if (meal.meal?.rating) {
      switch (meal.meal.rating) {
        case Rating.FourStars: return 0
        case Rating.ThreeStars: return 5
        case Rating.TwoStars: return 7
        case Rating.OneStar: return 8
        case Rating.Unrated: return meal.isTopRated ? 1 : 3
        case Rating.Uninterested: return 9
        case Rating.DietRestricted: return 10
        default: throw new Error(`Meal rating not handled: ${meal.meal.rating}`)
      }
    }

    if (meal.isGourmetPlus) {
      return 11
    }

    if (meal.isNonMeat) {
      return 6
    }

    if (meal.isNew) {
      return 2
    }

    // Rest are the unrated ones that aren't in Notion
    return 4
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
  const recordedMeals = (await (await fetch(url)).json()) as RecordedMeal[]
  const mealsIndex = recordedMeals.reduce((memo, meal) => {
    memo[indexString(meal.name)] = meal

    return memo
  }, {} as Record<string, RecordedMeal>)

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
        unratedButton.remove()
        uninterestedButton.remove()
        dietRestrictedButton.remove()
      }

      const commonProperties = {
        card: card as HTMLElement,
        description,
        name,
        onClick,
      }

      const unratedButton = createButton({
        ...commonProperties,
        color: Color.Green,
        rating: Rating.Unrated,
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
      meal: matchingMeal,
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
