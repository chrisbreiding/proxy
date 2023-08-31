import type { Meal } from './meals'

(async () => {
  const indexString = (name?: string | null) => {
    return (name || '').trim()
  }

  const ratings = [
    { representation: '– – – –', color: '#575b69' },
    { representation: '★☆☆☆', color: '#86552e' },
    { representation: '★★☆☆', color: '#862e2e' },
    { representation: '★★★☆', color: '#4666da' },
    { representation: '★★★★', color: '#6fbd58' },
  ]

  const applySharedStyles = (el: HTMLElement) => {
    el.style.color = 'white'
    el.style.borderRadius = '3px'
    el.style.position = 'absolute'
    el.style.right = '10px'
    el.style.top = '10px'
    el.style.fontSize = '20px'
    el.style.boxShadow = '0 0 5px black'
  }

  const adornCard = (card: HTMLElement, rating = ratings[0]) => {
    card.style.outline = `solid 5px ${rating.color}`

    const el = document.createElement('div')
    el.textContent = rating.representation
    el.style.backgroundColor = rating.color
    el.style.padding = '1px 6px 5px'
    applySharedStyles(el)

    card.appendChild(el)
  }

  const url = `https://proxy.crbapps.com/notion/factor-meals/${process.env.API_KEY}`
  const meals = (await (await fetch(url)).json()) as Meal[]
  const mealsIndex = meals.reduce((memo, meal) => {
    memo[indexString(meal.name)] = meal

    return memo
  }, {} as Record<string, Meal>)

  const mealDescriptionNodes = document.querySelectorAll('[data-recipe-card-headline="true"]')
  const dateNode = document.querySelector('.web-1brazu4')
  const date = dateNode?.textContent

  Array.from(mealDescriptionNodes).forEach((descriptionNode) => {
    const nameNode = descriptionNode.parentNode!.querySelector('[data-recipe-card-title="true"]')
    const name = nameNode?.textContent
    const description = descriptionNode.textContent
    const matchingMeal = mealsIndex[indexString(name)]
    const card = descriptionNode.closest('.editCard')

    if (!card) return

    if (matchingMeal) {
      adornCard(card as HTMLElement, ratings[matchingMeal.rating])
    } else {
      const el = document.createElement('button')
      el.setAttribute('type', 'button')
      el.textContent = '+ Add'
      el.style.backgroundColor = '#6fbd58'
      el.style.padding = '5px 10px'
      el.style.border = 'none'
      el.style.cursor = 'pointer'
      applySharedStyles(el)
      el.onclick = async () => {
        try {
          await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name: name || '',
              description: description || '',
              date,
            }),
          })

          el.remove()
          adornCard(card as HTMLElement)
        } catch (err: any) {
          // eslint-disable-next-line no-console
          console.log('Adding meal failed:', err.stack)
        }
      }

      card.appendChild(el)
    }
  })
})()
