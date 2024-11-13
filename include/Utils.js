// My collection of Claude functions!

Array.prototype.countOccurrences = function(path) {
	return Object.entries(
		 this.reduce((acc, obj) => {
			  const value = path.split('.').reduce((o, k) => o?.[k], obj)
			  if (value !== undefined) acc[value] = (acc[value] || 0) + 1
			  return acc
		 }, {})
	).map(([name, count]) => ({ name, count }))
}