const clone = (obj) => {
  return JSON.parse(JSON.stringify(obj))
}

const compact = (array) => {
  return array.reduce((memo, item) => {
    return item ? memo.concat(item) : memo
  }, [])
}

module.exports = {
  clone,
  compact,
}
