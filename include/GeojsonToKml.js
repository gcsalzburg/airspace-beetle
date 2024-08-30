export default class {
	constructor() {
	  this.kml = `<?xml version="1.0" encoding="UTF-8"?>
	  <kml xmlns="http://www.opengis.net/kml/2.2">
		 <Document>`;
	}
 
	convert(geojson) {
	  const features = geojson.features;
	  for (const feature of features) {
		 this.handleFeature(feature);
	  }
 
	  this.kml += '</Document></kml>';
	  return this.kml;
	}
 
	handleFeature(feature) {
		const properties = feature.properties
		const coordinates = feature.geometry.coordinates;
		let placemark = `<Placemark>`

		// Add name as the placemark's name
		if (properties.name) {
			placemark += `<name>${properties.name.replace(/&/g, "&amp;")}</name>`;
		}

		placemark += `<ExtendedData>`
		// Add other properties as extended data
		for (const key in properties) {
			if (properties.hasOwnProperty(key) && key !== "name") {
				let propValue = String(properties[key])
				placemark += `<Data name="${key}"><value>${propValue.replace(/&/g, "&amp;")}</value></Data>`;
			}
		}
		placemark += `</ExtendedData>`
		
		if (feature.geometry.type === 'Point') {
			placemark += `<Point><coordinates>${coordinates.join(',')}</coordinates></Point>`
		} else if (feature.geometry.type === 'LineString') {
			placemark += `<LineString><coordinates>${coordinates.map(coord => coord.join(',')).join(' ')}</coordinates></LineString>`
		}
		placemark += `</Placemark>`

		this.kml += placemark;
	}

 }