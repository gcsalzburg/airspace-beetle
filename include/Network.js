import Markers from './Markers.js'

export default class{

	// Default options are below
	options = {
	}

	// geoJSON for locations
	locations = {
		type: "FeatureCollection",
		features: []					
	}

	// getJSON for routes
	routes = {
		type: "FeatureCollection",
		features: []
	}


	// **********************************************************
	// Constructor, to merge in options

	constructor(options){
		this.options = {...this.options, ...options}
		this.name = this.options.name
		this.map = this.options.map
		this.color = this.options.color
		this.isVisible = this.options.isVisible

		// Create new Markers collection
		this.markers = new Markers({
			map: this.map,
			color: this.color,
			onHubChange: async (oldHub, newHub) => {
				this.locations.features.find(location => location.properties.name == oldHub).properties.isHub = false
				this.locations.features.find(location => location.properties.name == newHub).properties.isHub = true
				this.options.onChange()
			},
			onToggleInclude: async (locationName, isInclude) => {
				this.locations.features.find(location => location.properties.name == locationName).properties.isInclude = isInclude
				this.options.onChange()
			}
		})

		// Add all locations
		for(let location of this.options.locations){
			this._addLocation(location)
		}
	}

	// **********************************************************

	getRoutes = () => {
		return this.routes.features
	}
	
	getRoutesInRange = (minRange = 0, maxRange = 10) => {
		return this.routes.features.filter(route => route.properties.pathDistance <= maxRange && route.properties.pathDistance >= minRange)
	}

	getRouteProperties = () => {
		return {
			totalRoutes: 					this.routes.features.length,
			minLength: 						this.routes.features.reduce((min, feature) => Math.min(min, feature.properties.pathDistance), Infinity),
			maxLength: 						this.routes.features.reduce((max, feature) => Math.max(max, feature.properties.pathDistance), -Infinity)
		}
	}

	// **********************************************************

	rebuildRoutesAndMarkers = async () => {

		this._generateRoutes()
		this.markers.removeFromMap()
		if(this.isVisible){
			this.markers.addToMap(this.locations.features)
		}
	}

	reloadRoutes = async () => {
		this._generateRoutes()
	}

	hide = () => {
		this.isVisible = false
		for(let location of this.locations.features){
			location.properties.isVisible = false
		}
	}

	// Hide it all
	show = () => {
		this.isVisible = true
		for(let location of this.locations.features){
			location.properties.isVisible = true
		}
	}

	setMarkerColor = (colorMode) => {
		this.markers.setColorMode(colorMode)
	}

	// **********************************************************


	// Add a location to the list
	_addLocation = (location) => {
		const existingLocation = this.locations.features.find(loc => loc.properties.name == location.properties.name)
		if(!existingLocation){
			this.locations.features.push(location)
		}
	}

	// **********************************************************

	_generateRoutes = (locations = this.locations.features) => {
		this.routes.features = []

		// Iterate over, find hubs and draw lines from there
		for (const hubLocation of locations.filter(location => location.properties.isHub)) {
			// Only build routes to/from the hubs
			const trust = hubLocation.properties.trust
			const hubCoords = hubLocation.geometry.coordinates

			const nodes = locations.filter(location => location.properties.trust == trust && location.properties.isInclude)

			for(let node of nodes){
				if(node == hubLocation){
					// Do not connect to self
					continue
				}
				const nodeCoords = node.geometry.coordinates
				const distance = turf.distance(hubCoords, nodeCoords, {units: 'kilometers'})
				const newRoute = {
					type: "Feature",
					properties: {
						id: 				Math.random()*10000,
						source: 			hubLocation.properties.name,
						destination: 	node.properties.name,
						crowDistance: 	distance,
						pathDistance: 	distance,
						trust:			trust,
						nodeType:		node.properties.type,
						color: 			this.options.color,
						isVisible:		node.properties.isVisible
					},
					geometry: {
						type: 'LineString',
						coordinates: [
							hubCoords,
							nodeCoords,
						]
					}
				}
				this.routes.features.push(newRoute)
			}
		}
	}
}