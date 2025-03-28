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
				'line-dasharray': [1,2],
				'line-width': 3,
				'line-blur': 2,
				'line-opacity': 0.7
			}
		})
		this.options.map.setLayoutProperty(this.options.centreHubLineName, 'visibility', 'none')
	}

	remove = () => {
		if(this.options.map.getSource(this.options.centreHubLineName)){
			if(this.circle){
				this.circle.remove()
				this.circle = null
			}
			this.options.map.removeLayer(this.options.centreHubLineName)
			this.options.map.removeSource(this.options.centreHubLineName)
		}
	}

	// **********************************************************
	// Get/set

	setLocations = (locations) => {
		if(!locations || locations.length <= 0){
			return
		}
		this.options.locations = locations

		this.options.hubCenter = this.options.locations.find(location => location.properties.isHub).geometry.coordinates
		this._calculateCenter()
	}

	setDroneRange = (km) => {
		this.options.droneRange = km
		if(this.circle){
			this.circle.setRadius(km*1000)
		}
	}

	// **********************************************************
	// Visibility toggles

	show = () => {

		if(this.circle){
			return
		}

		// Draw centroid
		const circleOptions = {
			editable: false,
			fillColor: this.options.color,
			fillOpacity: 0.1,
			strokeWeight: 1,
			strokeColor: this.options.color,
			strokeOpacity: 0.5
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

	_setCenter = (coords) => {
		this.options.center = coords
		if(this.circle){
			this.circle.setCenter({lat: coords[1], lng: coords[0]})
		}
	}


	_setCentreHubLineGeometry = () => {
		// TODO: Draw dashed lines to each of the hubs in the circle
		// TODO: Add a diamond marker on the centre of the circle
		// TODO: Halo or outline (maybe a solid ring around it, same as the ring around the whole circle) the location nearest to the centre of the centroid
		// TODO: Might need a getBestHubLocation() which we can call from Network class for this
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

	_calculateCenter = () => {
		// Explanations: https://turfjs.org/docs/api/centerMedian
		// https://turfjs.org/docs/api/centerMean
		const centerOfMass = turf.centerMean({
			type: "FeatureCollection",
			features: this.options.locations					
		},{
			weight: 'centroidWeight'
		})
		this._setCenter(centerOfMass.geometry.coordinates)
		this._setCentreHubLineGeometry()
	}

}