const { mapPromisesSerially } = require('../util/collections')

const scripts = [
  require('../lib/notion/update-restaurants-last-visit'),
  require('../lib/notion/update-date-extrapolation'),
]

mapPromisesSerially(scripts, (script) => script())
