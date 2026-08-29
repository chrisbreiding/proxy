const weather = window.weather
const weatherCurrentEl = document.getElementById('weather-current')
const weatherMessageEl = document.getElementById('weather-message')
const weatherDetectEl = document.getElementById('weather-detect')
const weatherSetEl = document.getElementById('weather-set')
const weatherClearEl = document.getElementById('weather-clear')
const latitudeEl = document.getElementById('weather-latitude')
const longitudeEl = document.getElementById('weather-longitude')

function setWeatherMessage (text, type) {
  weatherMessageEl.textContent = text
  weatherMessageEl.className = type || ''
}

function renderWeatherLocation (data) {
  weather.location = data.location
  weather.defaultCoordinates = data.defaultCoordinates

  if (data.location) {
    weatherCurrentEl.innerHTML = ''
    weatherCurrentEl.appendChild(document.createTextNode(`${data.location.name} `))

    const coordinates = document.createElement('span')

    coordinates.className = 'muted'
    coordinates.textContent = `(${data.location.coordinates})`

    weatherCurrentEl.appendChild(coordinates)
  } else {
    weatherCurrentEl.textContent = data.defaultCoordinates
      ? `Using the default location (${data.defaultCoordinates})`
      : 'No location is set'
  }

  weatherClearEl.style.display = data.location ? '' : 'none'
}

function setWeatherDisabled (disabled) {
  weatherDetectEl.disabled = disabled
  weatherSetEl.disabled = disabled
}

async function saveWeatherLocation (options, successMessage) {
  setWeatherDisabled(true)

  try {
    const res = await fetch('/admin/weather-location', options)
    const body = await res.json().catch(() => ({}))

    if (!res.ok) {
      setWeatherMessage(body.error || 'Saving the location failed', 'error')
    } else {
      renderWeatherLocation(body)
      latitudeEl.value = ''
      longitudeEl.value = ''
      setWeatherMessage(successMessage, 'success')
    }
  } catch (_) {
    setWeatherMessage('Saving the location failed', 'error')
  }

  setWeatherDisabled(false)
}

function saveCoordinates (latitude, longitude) {
  return saveWeatherLocation({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ latitude, longitude }),
  }, 'Location saved')
}

weatherDetectEl.addEventListener('click', () => {
  if (!navigator.geolocation) {
    return setWeatherMessage('This browser cannot detect your location', 'error')
  }

  setWeatherMessage('Detecting your location...')
  setWeatherDisabled(true)

  navigator.geolocation.getCurrentPosition((position) => {
    setWeatherDisabled(false)
    saveCoordinates(position.coords.latitude, position.coords.longitude)
  }, (error) => {
    setWeatherDisabled(false)
    setWeatherMessage(error.message || 'Detecting your location failed', 'error')
  })
})

weatherSetEl.addEventListener('click', () => {
  setWeatherMessage('')
  saveCoordinates(latitudeEl.value.trim(), longitudeEl.value.trim())
})

weatherClearEl.addEventListener('click', () => {
  setWeatherMessage('')
  saveWeatherLocation({ method: 'DELETE' }, 'Now using the default location')
})

renderWeatherLocation(weather)

const jobs = window.jobs
const occurrences = window.occurrences
const original = JSON.stringify(jobs)
const jobsEl = document.getElementById('jobs')
const saveEl = document.getElementById('save')
const messageEl = document.getElementById('message')

function setMessage (text, type) {
  messageEl.textContent = text
  messageEl.className = type || ''
}

function updateSaveState () {
  saveEl.disabled = JSON.stringify(jobs) === original
}

function setError (fileName, message) {
  const row = jobsEl.querySelector(`[data-file-name="${fileName}"]`)

  row.querySelector('.job-error').textContent = message || ''
  row.querySelector('.job-interval').classList.toggle('invalid', !!message)
}

function clearErrors () {
  for (const el of jobsEl.querySelectorAll('.job-error')) {
    el.textContent = ''
  }

  for (const el of jobsEl.querySelectorAll('.job-interval')) {
    el.classList.remove('invalid')
  }
}

// slot 8 is the last distinct categorical color. a 9th job would have to be
// told apart by name alone, so it doesn't get one
function getColor (index) {
  return index < 8 ? `var(--series-${index + 1})` : 'var(--series-other)'
}

function formatTime (minute) {
  const hour = Math.floor(minute / 60)
  const displayHour = hour % 12 === 0 ? 12 : hour % 12
  const displayMinute = String(minute % 60).padStart(2, '0')

  return `${displayHour}:${displayMinute}${hour < 12 ? ' am' : ' pm'}`
}

function formatHour (hour) {
  const displayHour = hour % 12 === 0 ? 12 : hour % 12

  return displayHour + (hour % 24 < 12 ? 'a' : 'p')
}

const chartEl = document.getElementById('chart')
const svgNamespace = 'http://www.w3.org/2000/svg'
const chart = {
  height: 150,
  left: 4,
  right: 4,
  top: 14,
  bottom: 26,
  barWidth: 4,
  // the surface gap that keeps stacked segments reading as separate jobs
  gap: 2,
  // how much of the day fits without scrolling
  visibleHours: 12,
  minWidth: 320,
}
const plotHeight = chart.height - chart.top - chart.bottom
const minutesPerDay = 24 * 60

function createSvgElement (name, attributes) {
  const el = document.createElementNS(svgNamespace, name)

  for (const key of Object.keys(attributes)) {
    el.setAttribute(key, attributes[key])
  }

  return el
}

// one entry per minute of the day something runs, holding the jobs that run
// then in list order, so a job's place in the stack never moves
function getStacks () {
  const byMinute = new Map()

  jobs.forEach((job, index) => {
    if (!job.enabled) return

    for (const minute of occurrences[job.fileName] || []) {
      if (!byMinute.has(minute)) {
        byMinute.set(minute, [])
      }

      byMinute.get(minute).push({ name: job.name, color: getColor(index) })
    }
  })

  return [...byMinute.entries()]
  .map(([minute, entries]) => ({ minute, entries }))
  .sort((a, b) => a.minute - b.minute)
}

function buildTooltip (stack) {
  const tooltip = document.createElement('div')

  tooltip.className = 'chart-tooltip'

  const time = document.createElement('div')

  time.className = 'chart-tooltip-time'
  time.textContent = formatTime(stack.minute)
  tooltip.appendChild(time)

  for (const entry of stack.entries) {
    const line = document.createElement('div')
    const dot = document.createElement('span')

    dot.className = 'dot'
    dot.style.background = entry.color
    dot.style.height = '8px'
    dot.style.width = '8px'
    line.appendChild(dot)
    line.appendChild(document.createTextNode(` ${entry.name}`))
    tooltip.appendChild(line)
  }

  return tooltip
}

function clamp (value, max) {
  return Math.max(0, Math.min(value, max))
}

// measured once it's in the document, then nudged to stay inside the chart,
// flipping below the bar when it won't fit above it. it lives in the
// scrolling element so it stays with its bar as the chart is scrolled
function showTooltip (scrollEl, width, stack, x, y) {
  const tooltip = buildTooltip(stack)

  scrollEl.appendChild(tooltip)

  const above = y - tooltip.offsetHeight - 4

  tooltip.style.top = `${clamp(above < 0 ? y + 8 : above, chart.height - tooltip.offsetHeight)}px`
  tooltip.style.left = `${clamp(x - tooltip.offsetWidth / 2, width - tooltip.offsetWidth)}px`
}

function hideTooltip () {
  const tooltip = chartEl.querySelector('.chart-tooltip')

  if (tooltip) {
    tooltip.remove()
  }
}

function renderChart () {
  const stacks = getStacks()
  // re-rendering throws away the scroll position, so it's put back after
  const scrolled = chartEl.querySelector('.chart-scroll')
  const scrollLeft = scrolled ? scrolled.scrollLeft : 0

  hideTooltip()
  chartEl.innerHTML = ''

  if (!stacks.length) {
    const empty = document.createElement('p')

    empty.className = 'chart-empty'
    empty.textContent = 'No enabled job has an interval that can be charted'
    chartEl.appendChild(empty)

    return
  }

  const maxCount = stacks.reduce((max, { entries }) => Math.max(max, entries.length), 0)
  const unitHeight = plotHeight / maxCount
  const baseline = chart.top + plotHeight
  const scrollEl = document.createElement('div')

  scrollEl.className = 'chart-scroll'
  chartEl.appendChild(scrollEl)

  // drawn at one user unit per pixel so the labels aren't scaled with it
  const width = Math.max(scrollEl.clientWidth, chart.minWidth) * (24 / chart.visibleHours)
  const plotWidth = width - chart.left - chart.right
  const svg = createSvgElement('svg', {
    viewBox: `0 0 ${width} ${chart.height}`,
    width,
    height: chart.height,
    role: 'img',
    'aria-label': 'When each enabled job runs over 24 hours',
  })

  function getX (minute) {
    return chart.left + (minute / minutesPerDay) * plotWidth
  }

  for (let count = 0; count <= maxCount; count++) {
    const y = baseline - count * unitHeight

    svg.appendChild(createSvgElement('line', {
      class: 'grid',
      x1: chart.left,
      x2: chart.left + plotWidth,
      y1: y,
      y2: y,
    }))
  }

  for (let hour = 0; hour <= 24; hour++) {
    const label = createSvgElement('text', {
      class: 'axis',
      x: getX(hour * 60),
      y: baseline + 17,
      'text-anchor': hour === 0 ? 'start' : hour === 24 ? 'end' : 'middle',
    })

    label.textContent = formatHour(hour)
    svg.appendChild(label)
  }

  for (const stack of stacks) {
    const x = getX(stack.minute)

    stack.entries.forEach((entry, index) => {
      const top = baseline - (index + 1) * unitHeight
      const isTop = index === stack.entries.length - 1
      const height = Math.max(unitHeight - (isTop ? 0 : chart.gap), 1)

      svg.appendChild(createSvgElement('rect', {
        x: x - chart.barWidth / 2,
        y: top,
        width: chart.barWidth,
        height,
        rx: isTop ? chart.barWidth / 2 : 0,
        fill: entry.color,
      }))
    })

    // a 4px bar is too small to hover, so a wider invisible target covers it
    const target = createSvgElement('rect', {
      x: x - 7,
      y: chart.top,
      width: 14,
      height: plotHeight,
      fill: 'transparent',
    })

    target.addEventListener('mouseenter', () => {
      hideTooltip()
      showTooltip(scrollEl, width, stack, x, baseline - stack.entries.length * unitHeight)
    })

    target.addEventListener('mouseleave', hideTooltip)

    svg.appendChild(target)
  }

  scrollEl.appendChild(svg)
  scrollEl.scrollLeft = scrollLeft
}

jobs.forEach((job) => {
  const row = document.createElement('div')

  row.className = `job${job.enabled ? '' : ' disabled'}`
  row.dataset.fileName = job.fileName

  // doubles as the chart's legend, which is what makes the colors readable
  // without relying on hue alone
  const dot = document.createElement('span')

  dot.className = 'dot'
  dot.style.background = getColor(jobs.indexOf(job))

  const name = document.createElement('span')

  name.className = 'job-name'
  name.textContent = job.name

  const interval = document.createElement('input')

  interval.className = 'job-interval'
  interval.type = 'text'
  interval.value = job.interval
  interval.setAttribute('aria-label', `${job.name} interval`)
  interval.addEventListener('input', () => {
    job.interval = interval.value
    setError(job.fileName, '')
    setMessage('')
    updateSaveState()
  })

  const toggleLabel = document.createElement('label')
  const toggle = document.createElement('input')

  toggle.type = 'checkbox'
  toggle.checked = job.enabled
  toggle.addEventListener('change', () => {
    job.enabled = toggle.checked
    row.classList.toggle('disabled', !toggle.checked)
    setMessage('')
    updateSaveState()
    renderChart()
  })

  toggleLabel.appendChild(toggle)
  toggleLabel.appendChild(document.createTextNode(' Enabled'))

  const error = document.createElement('span')

  error.className = 'job-error'

  row.appendChild(dot)
  row.appendChild(name)
  row.appendChild(interval)
  row.appendChild(toggleLabel)
  row.appendChild(error)
  jobsEl.appendChild(row)
})

renderChart()

let chartWidth = chartEl.clientWidth

// the chart is sized in pixels, so it has to be rebuilt when that changes
window.addEventListener('resize', () => {
  if (chartEl.clientWidth === chartWidth) return

  chartWidth = chartEl.clientWidth
  renderChart()
})

saveEl.addEventListener('click', async () => {
  clearErrors()
  setMessage('')
  saveEl.disabled = true

  try {
    const res = await fetch('/admin/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobs }),
    })
    const body = await res.json().catch(() => ({}))

    if (res.ok) {
      window.location.reload()

      return
    }

    if (body.errors) {
      for (const fileName of Object.keys(body.errors)) {
        setError(fileName, body.errors[fileName])
      }

      setMessage('Fix the errors above and try again', 'error')
    } else {
      setMessage(body.error || 'Saving failed', 'error')
    }
  } catch (_) {
    setMessage('Saving failed', 'error')
  }

  updateSaveState()
})

document.getElementById('logout').addEventListener('click', async () => {
  await fetch('/admin/logout', { method: 'POST' })
  window.location.reload()
})
