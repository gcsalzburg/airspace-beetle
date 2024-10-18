export default class{

	// Default options are below
	options = {
		show: false
	}

	// **********************************************************
	// Constructor, to merge in options

	constructor(options){

		// Merge opts
		this.options = {...this.options, ...options}

		// Set mapbox source/layer name
		this.options.centreHubLineName = `${this.options.trust}-centroid-line`
		this.createCentreHubLine()

		// Initial setup
		this.setLocations(this.options.locations)

		// And show it
		if(this.options.show){
			this.show()
		}
	}

	// **********************************************************
	// init / creators

	createCentreHubLine = () => {
		this.options.map.addSource(this.options.centreHubLineName, {
			'type': 'geojson',
			'data': {
				'type': 'Feature',
				'properties': {},
				'geometry': {
					'type': 'LineString',
					'coordinates': [0,0]
				}
			}
	  	})
		this.options.map.addLayer({
			'id': this.options.centreHubLineName,
			'type': 'line',
			'source': this.options.centreHubLineName,
			'layout': {
					'line-join': 'round',
					'line-cap': 'round'
			},
			'paint': {
				'line-color': this.options.color,
				'line-dasharray': [0.5,2],
				'line-width': 3,
				'line-blur': 2,
				'line-opacity': 0.7
			}
		})
		this.options.map.setLayoutProperty(this.options.centreHubLineName, 'visibility', 'none')
	}

	// **********************************************************
	// Get/set

	isVisible = () => {
		return 
	}

	getTrust = () => {
		return this.options.trust
	}

	setLocations = (locations) => {
		this.options.locations = locations

		this.options.hubCenter = this.options.locations.find(location => location.properties.isHub).geometry.coordinates
		this._calculateCenter()
	}

	setCenter = (coords) => {
		this.options.center = coords
		if(this.circle){
			this.circle.setCenter({lat: coords[1], lng: coords[0]})
		}
	}

	setDroneRange = (km) => {
		this.options.droneRange = km
		if(this.circle){
			this.circle.setRadius(km*1000)
		}
	}

	setCentreHubLineGeometry = () => {
		this.options.map.getSource(this.options.centreHubLineName).setData({
				'type': 'Feature',
				'properties': {},
				'geometry': {
					'type': 'LineString',
					'coordinates': [
						this.options.center,
						this.options.hubCenter
					]
				}
		})
	}

	// **********************************************************
	// Visibility toggles

	show = () => {

		if(this.circle){
			this.hide()
		}

		// Draw centroid
		const circleOptions = {
			editable: false,
			fillColor: this.options.color,
			fillOpacity: 0.03,
			strokeWeight: 1,
			strokeColor: this.options.color,
			strokeOpacity: 0.3
		}

		this.circle = new MapboxCircle({lat: this.options.center[1], lng: this.options.center[0]}, this.options.droneRange*1000, circleOptions)
		this.circle.addTo(this.options.map)

		this.options.map.setLayoutProperty(this.options.centreHubLineName, 'visibility', 'visible')
	}

	hide = () => {
		if(this.circle){
			this.circle.remove()
			this.circle = null
		}
		this.options.map.setLayoutProperty(this.options.centreHubLineName, 'visibility', 'none')
	}

	// **********************************************************
	// Internal calcs

	_calculateCenter = () => {
		// Explanations: https://turfjs.org/docs/api/centerMedian
		// https://turfjs.org/docs/api/centerMean
		const centerOfMass = turf.centerMean({
			type: "FeatureCollection",
			features: this.options.locations					
		},{
			weight: 'centroidWeight'
		})
		this.setCenter(centerOfMass.geometry.coordinates)
		this.setCentreHubLineGeometry()
	}

}