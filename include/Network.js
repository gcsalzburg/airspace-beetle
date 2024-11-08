import Markers from './Markers.js'
import Routes from './Routes.js'

export default class{

	// Default options are below
	options = {
	}

	// geoJSON for locations
	locations = {
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

				// Update geoJSON
				this.locations.features.find(location => location.properties.name == oldHub).properties.isHub = false
				this.locations.features.find(location => location.properties.name == newHub).properties.isHub = true

				await this._renderRoutes()
				this.options.onChange()
				
			},
			onToggleInclude: async (locationName, isInclude) => {

				this.locations.features.find(location => location.properties.name == locationName).properties.isInclude = isInclude

				await this._renderRoutes()
				this.options.onChange()
			}
		})

		// Create routes collection
		this.routes = new Routes({
			map: this.map,
			color: this.color,
			layerName: this.name,
			onRouteMouseOver: (sourceName, destinationName, length) => {
				this.markers.showLabels([sourceName, destinationName])	// Add location label
				this.options.onRouteMouseOver(sourceName, destinationName, length)
			},
			onRouteMouseLeave: () => {
				this.markers.showLabels()	// Clear location labels too
				this.options.onRouteMouseLeave()
			}
		})

		this.routes.init()

		// Add all locations
		for(let location of this.options.locations){
			this._addLocation(location.name, location.coordinates, {
				type: location.type,
				trust: location.trust,
				isHub: location.isHub
			})
		}
	}

	// **********************************************************

	getStats(){
		return {
			totalRoutes: this.routes.getTotalCount(),
			totalIncludedInRange: this.routes.getTotalIncludedInRange()
		}
	}

	render = async () => {
		if(this.isVisible){
			this.markers.addToMap(this.locations.features)
			await this.routes.rebuildFromLocations(this.locations.features)
		}
	}

	reloadRoutes = async () => {
		this.routes.init()
		await this.routes.rebuildFromLocations(this.locations.features)
	}

	empty = () => {
		this.markers.removeFromMap(true)
		this.routes.remove()
	}

	hide = () => {
		this.isVisible = false
		for(let location of this.locations.features){
			location.properties.isVisible = false
		}
		this.empty()
	}

	// Hide it all
	show = async () => {
		this.isVisible = true
		for(let location of this.locations.features){
			location.properties.isVisible = true
		}
		this.markers.addToMap(this.locations.features)
		this.routes.init()
		await this.routes.rebuildFromLocations(this.locations.features)
	}

	setMarkerColor = (colorMode) => {
		this.markers.setColorMode(colorMode)
	}
	setRouteColor = (colorMode) => {
		this.routes.setColorMode(colorMode)
	}

	// **********************************************************


	// Add a location to the list
	_addLocation = (name, coords, metadata = {}) => {
		const existingLocation = this.locations.features.find(location => location.properties.name == name)
		if(!existingLocation){
			this.locations.features.push({
				type: 'Feature',
				geometry: {
					type: 'Point',
					coordinates: coords
				},
				properties: {
					name: name,
				//	centroidWeight: 1,
					isInclude: true,
					isVisible: true,
					...metadata
				}
			})
		}
	}
}