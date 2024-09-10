export default class{

	id = Math.random()*10000

	elm = null
	marker = null

	// Default options are below
	options = {}

	// **********************************************************
	// Constructor, to merge in options

	constructor(options){

		this.options = {...this.options, ...options}

		// Create new waynode
		this.elm = document.createElement('div')
		this.elm.className = this.options.className ?? ''

		this.elm.addEventListener('click', (e) => {
			if (e.ctrlKey || e.metaKey) {
				console.log(this)
				this.options.onDelete(this)
			}
		})
	}

	addToMap = (map, location) => {
		this.options.map = map
		this.options.location = location
		this.marker = new mapboxgl.Marker(this.elm,{draggable: true}).setLngLat(location).addTo(this.options.map)

		// Add handlers for new marker
		if(this.options.onDragStart) this.marker.on('dragstart', this.options.onDragStart)
		if(this.options.onDrag) this.marker.on('drag', this.options.onDrag)
		if(this.options.onDragEnd) this.marker.on('dragend', this.options.onDragEnd)
	}

	snapTo = (snapPoints, snapDistance) => {
		// TODO: Update to use pageX and pageY rather than turf.distance() to get the snap distance

		for(let point of snapPoints){
			if(turf.distance(this.getLngLat(), point.geometry.coordinates, {units:"kilometers"}) <= snapDistance){
				this.setLngLat(point.geometry.coordinates)
				// TODO: Save reference to which waypoint we are snapped to
				return true
			}
		}

		return false
	}

	remove = () => {
		this.marker.remove()
	}

	// **********************************************************
	// Getters

	getMarker = () => {
		return this.marker
	}
	getLngLat = () => {
		return this.marker.getLngLat().toArray()
	}
	getID = () => {
		return this.id
	}

	// **********************************************************
	// Setters

	setLngLat = (coords) => {
		this.marker.setLngLat(coords)
	}

}