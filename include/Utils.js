// My collection of Gemini/Claude functions!

export function findObjectByProperty(array, propertyPath, value){
	for (let i = 0; i < array.length; i++) {
		let obj = array[i];
		const propertyParts = propertyPath.split('.')
		for (let j = 0; j < propertyParts.length; j++) {
			if (!obj) {
			break // If the property path is invalid, break the loop
			}
			obj = obj[propertyParts[j]];
		}
		if (obj === value) {
			return array[i]
		}
	}
	return null
}

export function countOccurrences(array, property){
	return array.reduce((counts, obj) => {
	  // Access the property value using optional chaining
	  const value = this.getNestedProperty(obj, property);
 
	  // Handle missing or invalid property paths
	  if (value === undefined) {
		 return counts // Skip objects without the property
	  }
 
	  // Count occurrences based on the extracted value
	  counts[value] = (counts[value] || 0) + 1
	  return counts
	}, {})
 }
 
 // Helper function to access nested properties with optional chaining
 export function getNestedProperty(obj, propertyPath){
	const parts = propertyPath.split('.')
	let current = obj
	for (const part of parts) {
	  current = current?.[part] // Use optional chaining
	  if (current === undefined) {
		 return undefined // Stop if any property is missing
	  }
	}
	return current
 }