const clone = (obj) => {
  return JSON.parse(JSON.stringify(obj))
}

const compact = (array) => {
  return array.reduce((memo, item) => {
    return item ? memo.concat(item) : memo
  }, [])
}

const mapPromisesSerially = async (array, callback) => {
  const result = []

  for (let item of array) {
    result.push(await callback(item))
  }

  return result
}

module.exports = {
  clone,
  compact,
  mapPromisesSerially,
}
