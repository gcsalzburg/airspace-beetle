import DraggableMarker from './DraggableMarker.js'

export default class extends DraggableMarker{

	// **********************************************************
	// Constructor, to merge in options

	constructor(options){

		super(options)

		// Set properties of waynode
		this.elm.className = 'marker-waynode'
		this.elm.dataset.routeID = this.options.routeID ?? 0
		this.elm.dataset.pointIndex = -1

		// Set hover effects
		this.elm.addEventListener('mouseenter', () => {
			this.options.setUIState('waynodeHover', {feature: this.options.mapboxRouteFeature})
		})
		this.elm.addEventListener('mouseleave', () => {
			this.options.setUIState('waynodeLeave')
		})
	}
	// **********************************************************
	// Getters

	getPointIndex = () => {
		return this.pointIndex
	}
	getRouteID = () => {
		return this.options.routeID
	}

	// **********************************************************
	// Setters

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