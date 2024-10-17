export default class{

	id = Math.random()*10000

	elm = null
	marker = null

	// Default options are below
	options = {
		show: false
	}

	// **********************************************************
	// Constructor, to merge in options

	constructor(options){

		this.options = {...this.options, ...options}

		this.calculateCenter()
		if(this.options.show){
			this.show()
		}
	}

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
	}

	hide = () => {
		if(this.circle){
			this.circle.remove()
			this.circle = null
		}
	}

	isVisible = () => {
		return 
	}

	getTrust = () => {
		return this.options.trust
	}

	setLocations = (locations) => {
		this.options.locations = locations
		this.calculateCenter()
	}

	setCenter = (coords) => {
		this.options.center = coords
		if(this.circle){
			this.circle.setCenter({lat: coords[1], lng: coords[0]})
		}
	}

	setDroneRange = (km) => {
		this.circle.setRadius(km*1000)
	}

	calculateCenter = () => {
		// Explanations: https://turfjs.org/docs/api/centerMedian
		// https://turfjs.org/docs/api/centerMean
		const centerOfMass = turf.centerMean({
			type: "FeatureCollection",
			features: this.options.locations					
		},{
			weight: 'centroidWeight'
		})
		this.setCenter(centerOfMass.geometry.coordinates)
	}

}