const compact = (array) => {
  return array.reduce((memo, item) => {
    return item ? memo.concat(item) : memo
  }, [])
}

module.exports = {
  compact,
}
