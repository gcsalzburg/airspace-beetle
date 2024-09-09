export default class{

	elm = null
	marker = null

	// Default options are below
	options = {
		routeID: 0
	}

	// **********************************************************
	// Constructor, to merge in options

	constructor(options){

		this.options = {...this.options, ...options}

		// Create new waynode
		this.elm = document.createElement('div')
		this.elm.className = this.options.className
		this.elm.dataset.routeID = this.options.routeID
		this.elm.dataset.pointIndex = -1


		this.elm.addEventListener('mouseenter', () => {
			this.options.setUIState('waynodeHover', {feature: this.options.mapboxRouteFeature})
		})
		this.elm.addEventListener('mouseleave', () => {
			this.options.setUIState('waynodeLeave')
		})
		this.elm.addEventListener('click', () => {
			console.log('delete')
		})
	}

	addToMap = (map, location) => {
		this.options.map = map
		this.options.location = location
		this.marker = new mapboxgl.Marker(this.elm,{draggable: true}).setLngLat(location).addTo(this.options.map)

		// Add handlers for new marker
		this.marker.on('dragstart', this.options.onDragStart)
		this.marker.on('drag', this.options.onDrag)
		this.marker.on('dragend', this.options.onDragEnd)
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
	getPointIndex = () => {
		return this.pointIndex
	}
	getLngLat = () => {
		return this.marker.getLngLat().toArray()
	}

	// **********************************************************
	// Setters

	setLngLat = (coords) => {
		this.marker.setLngLat(coords)
	}

	setPointIndex = (waynodes) => {

		// Calculate which is the nearest waynode to this marker
		const points = turf.featureCollection(waynodes.map(coord => turf.point(coord)));
		const nearestPoint = turf.nearestPoint(turf.point(this.getLngLat()), points)

		// Save index of this point for use in a minute
		this.pointIndex = points.features.findIndex(feature => 
			feature.geometry.coordinates[0] === nearestPoint.geometry.coordinates[0] &&
			feature.geometry.coordinates[1] === nearestPoint.geometry.coordinates[1]
		)

		// TODO remove this line?
		this.elm.dataset.pointIndex = this.pointIndex
	}

}