const fs = require('fs-extra')
const minimist = require('minimist')
const path = require('path')

const { count, limit } = minimist(process.argv.slice(2))

const options = [
  't.a.a',
  't.a.b',
  't.a.c',
  't.b.a',
  't.b.b',
  't.b.c',
  't.c.a',
  't.c.b',
  't.c.c',
  't.d.a',
  't.d.b',
  't.d.c',
]

const randomInt = (minimum, maxPlusOne) => {
  return Math.floor((Math.random() * (maxPlusOne - minimum))) + minimum
}

const randomPermutations = new Array(count).fill(1).map(() => {
  const itemCount = randomInt(1, limit + 1)
  const perms = new Array(itemCount).fill(1).map(() => {
    return options[randomInt(0, options.length)]
  }).join(', ')

  return `...d('', ${perms}),`
}).join('\n')

fs.writeFileSync(path.join(process.cwd(), '.fixtures/permutations.txt'), `${randomPermutations}`)
