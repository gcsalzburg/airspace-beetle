
import * as Utils from './Utils.js'
import Markers from './Markers.js'
import Networks from './Networks.js'
import Routes from './Routes.js'
import LocationTypes from './LocationTypes.js'
import Centroids from './Centroids.js'

export default class{

	// geoJSON for map display
	mapData = {
		locations: {
			type: "FeatureCollection",
			features: []					
		}
	}

	// Mapbox objects
	map = null
	hoveredLocation = null

	// Feature options
	featureOptions = {
		droneRange: 10,
		snapDistance: 0.3, // kilometers
		weights: {
			hospitals: 1,
			others: 1
		}
	}
 
	// Default options are below
	options = {
		mapbox_token: '',
		mapbox_style: 'mapbox://styles/mapbox/light-v11',
		mapbox_view: {
			zoom: 6,
			centre: {
				lng: -1.544136,
				lat: 53.869356,
			}
		},
		route_editing: {
			waypoints_enabled: true,
			waynodes_enabled: false,
			canEdit: false,
			isDragging: false
		}
	}

	// **********************************************************
	// Constructor & init functions

	constructor(options){

		this.options = {...this.options, ...options}

		// Create a new Networks object
		this.networks = new Networks({
			listContainer: this.options.dom.networksList,
			onListMouseMove: (networkName) => {
				this.routes.filterByNetwork(networkName)
			},
			onListMouseLeave: () => {
				this.routes.filterByNetwork()
			},
			onToggleNetwork: (networkName, isVisible) => {
				this.toggleLocationVisibility(networkName, isVisible)
				this.regenerateMap({centroids: false})
			}
		})

		this.types = new LocationTypes({
			listContainer: this.options.dom.weightsSliders,
			onSliderChange: (type, weight) => {
				for(let location of this.mapData.locations.features){
					if(location.properties.type == type){
						location.properties.centroidWeight = weight
					}
				}
				this.centroids.updateLocations(this.mapData.locations)
			}
		})

		// Do this early to switch to correct tab immediately
		if(this.hasMapDataStorage()){
			this.options.onHasStorageData()
		}

		const mapConfig = this.getMapConfigFromStorage()
		this.currentMapStyle = mapConfig.style ?? this.options.mapbox_style

		// Load the Mapbox map
		this.map = new mapboxgl.Map({
			accessToken: this.options.mapbox_token,
			container: this.options.dom.mapbox,
			style: mapConfig.style ?? this.options.mapbox_style,
			center: mapConfig.center ?? [this.options.mapbox_view.centre.lng, this.options.mapbox_view.centre.lat],
			zoom: mapConfig.zoom ?? this.options.mapbox_view.zoom,
			boxZoom: false
		})

		// Create routes collection
		this.routes = new Routes({
			map: this.map,
			onHighlightRoute: (sourceName, destinationName, length) => {
				this.setFollowerDistance(length)									// Set the follower with distance
				this.markers.showLabels([sourceName, destinationName])	// Add location labels
				this.setCursor('routeHover')										// Set cursor
			},
			onClearHighlight: () => {
				this.clearFollower()			// Clear the follower
				this.markers.showLabels()	// Clear location labels too
				this.setCursor()				// Reset cursor
			}
		})

		this.centroids = new Centroids({
			map: this.map
		})

		// Once the map has loaded
		this.map.on('load', async () => {

			// Prep mapbox layers
			this.routes.init()			

			if(this.options.route_editing.waypoints_enabled){
				//this.initRouteEditing()
			}

			// Load data from local storage
			this.loadFromStorage()	
		})

		// Set handler for the map changing
		this.map.on('moveend', () => {
			if(this.mapData.locations.features.length > 0){
				this.saveToStorage()
			}
		})


		// Create new Markers collection
		this.markers = new Markers({
			map: this.map,
			onHubChange: (oldHub, newHub) => {

				// Update geoJSON
				Utils.findObjectByProperty(this.mapData.locations.features, "properties.name", oldHub).properties.isHub  = false
				Utils.findObjectByProperty(this.mapData.locations.features, "properties.name", newHub).properties.isHub  = true	
				
				this.regenerateMap({centroids: false})
				this.centroids.updateLocations(this.mapData.locations)
			},
			onToggleInclude: (locationName, isInclude) => {

				// Update geoJSON
				Utils.findObjectByProperty(this.mapData.locations.features, "properties.name", locationName).properties.isInclude = isInclude

				this.regenerateMap({centroids: false})
				this.centroids.updateLocations(this.mapData.locations)
			}
		})

	}

	// **********************************************************
	// Map handlers / manipulation etc

	updateMapContainer = () => {
		this.map.resize()
	}

	zoomToLocations = () => {
		const bbox = turf.bbox(this.mapData.locations)
		this.map.fitBounds(bbox,{
			padding: 20
		})
	}
	
	// **********************************************************
	// Public functions (in theory!)
	// TODO: Set all other fns to _ prefix

	getGeojson = () => {
		return {
			type: "FeatureCollection",
			features: [...this.routes.getRoutes().features, ...this.mapData.locations.features]
		}
	}

	setMapStyle = (style) => {

		// For when changing the base map
		if(!this.hasAddedStyleLoadListener){
			this.hasAddedStyleLoadListener = true
			this.map.on('style.load', () => {
				this.routes.init()
				this.routes.drawRoutes()
			})
		}

		switch(style){
			case 'apian':
				this.map.setStyle('mapbox://styles/annamitch/clsded3i901rg01qyc16p8dzw')
				this.currentMapStyle = 'mapbox://styles/annamitch/clsded3i901rg01qyc16p8dzw'
				break
			case 'light':
				this.map.setStyle('mapbox://styles/mapbox/light-v11')
				this.currentMapStyle = 'mapbox://styles/mapbox/light-v11'
				break
			case 'dark':
				this.map.setStyle('mapbox://styles/mapbox/dark-v11')
				this.currentMapStyle = 'mapbox://styles/mapbox/dark-v11'
				break
			case 'satellite':
				this.map.setStyle('mapbox://styles/mapbox/satellite-v9')
				this.currentMapStyle = 'mapbox://styles/mapbox/satellite-v9'
				break
		}

		this.saveToStorage()

	}

	empty = () => {
		localStorage.clear()
	}

	toggleCentroids = (isShow = false) => {
		this.centroids.toggle(isShow)
	}

	// **********************************************************
	// New data importing
	
	// Update geoJSON from updated CSV data
	importNewLocations = (newLocations) => {

		// Clear existing map content

		// Reset all objects
		this.mapData.locations.features = []
		this.routes.empty()
		this.networks.empty()
		this.types.empty()
		this.centroids.empty()
		this.markers.removeFromMap(true)

		// Load in all new locations
		for(let location of newLocations){

			// Update Trusts list
			this.networks.add(location.trust)

			// Update types list
			this.types.add(location.type)

			// Save the location if it is a unique location
			this.addLocation(location.name, location.coordinates, {
				type: location.type,
				trust: location.trust,
				isHub: location.isHub
			})

		}
		
		// Add the nodes as markers
		this.regenerateMap()

		this.zoomToLocations()
	}

	// Add a location to the list
	addLocation = (name, coords, metadata = {}) => {
		const existingLocation = Utils.findObjectByProperty(this.mapData.locations.features, "properties.name", name)
		if(!existingLocation){
			const	properties = {
				name: name,
				centroidWeight: 1,
				isInclude: true,
				isVisible: true,
				...metadata
			}

			this.mapData.locations.features.push({
				type: 'Feature',
				geometry: {
					type: 'Point',
					coordinates: coords
				},
				properties: properties
			})
			return true
		}else{
			existingLocation.properties.numRoutes++
		}
	}

	toggleLocationVisibility = (networkName, isVisible) => {
		for(let location of this.mapData.locations.features.filter(location => location.properties.trust == networkName)){
			location.properties.isVisible = isVisible
		}
		this.markers.toggleNetwork(networkName, isVisible)
	}

	// **********************************************************
	// Building & rebuilding map content

	regenerateMap = (options) => {

		const _options = {...{
			networksAndTypes: false,
			markers: true,
			routes: true,
			metadata: true,
			centroids: true,
			saveToStorage: true
		}, ...options}

		if(_options.networksAndTypes){
			this.networks.empty()
			this.types.empty()
			this.buildNetworksAndTypes()
		}
	
		if(_options.markers){
			this.markers.removeFromMap()
			this.markers.addToMap(this.mapData.locations.features, this.networks.get())
		}
			
		if(_options.routes){
			// Rebuild all routes again
			this.routes.rebuildFromLocations(this.mapData.locations.features, this.networks.get())
		}

		if(_options.metadata){	
			// Render lists of networks and types
			this.networks.updateCounts(Utils.countOccurrences(this.mapData.locations.features.filter(location => location.properties.isInclude), 'properties.trust'))
			this.networks.renderDOMList()
			this.types.renderDOMList()

			// Update states in the networks list based on the state of the location of the hub
			for(let location of this.mapData.locations.features.filter(location => location.properties.isHub)){
				this.networks.toggleInList(location.properties.trust, location.properties.isVisible)
			}

			this.setDroneRangeSliderBounds()
		}

		if(_options.centroids){
			// Create centroids
			this.centroids.create(this.mapData.locations, this.networks.get(), this.featureOptions.droneRange)
		}

		// Save to storage as something probably changed
		this.saveToStorage()

	}

	buildNetworksAndTypes = () => {
		for(let location of this.mapData.locations.features){
			this.networks.add(location.properties.trust)
			this.types.add(location.properties.type)
		}
	}

	// **********************************************************
	// Interactions to play with map content

	// Drone range handling
	setDroneRange = (range) => {
		// Save the range
		this.featureOptions.droneRange = parseInt(range)

		this.routes.setMaxRange(this.featureOptions.droneRange)
		this.centroids.updateRange(range)
	}

	setDroneRangeSliderBounds = () => {

		const routeProps = this.routes.getRouteProperties()

		this.options.dom.routesData.querySelector('.num-routes').innerHTML = routeProps.total
		this.options.dom.routesData.querySelector('.route-length').innerHTML = `(${Math.round(routeProps.minLength*10)/10} - ${Math.round(routeProps.maxLength*10)/10} km)`

		// Set bounds of range slider
		const sliderMax = Math.min(Math.ceil(routeProps.maxLength/5)*5, 50)
		this.options.dom.droneRangeSlider.setAttribute('max', sliderMax)
	}

	setCursor(type){

		let cursor = 'grab'

		switch(type){
			case 'routeHover':
				cursor = this.options.route_editing.is_currently_editing ? 'crosshair' : 'default'
				break
			default:
				cursor = this.options.route_editing.is_currently_editing ? 'crosshair' : 'grab'
				break
		}

		this.map.getCanvasContainer().style.cursor = cursor
	}

	// Helpers for the follower that shows the total distance
	setFollowerDistance = (distance) => {
		this.options.follower.set(`${Math.round(distance*10)/10} km`, {style: 'route'})
	}
	clearFollower = () => {
		this.options.follower.clear()
	}

	// **********************************************************
	// localStorage handling

	hasMapDataStorage = () => {
		const loadedData = localStorage.getItem('mapData')
		if (loadedData) {
			const loadedDataJSON = JSON.parse(loadedData)
			if(loadedDataJSON.mapData.locations.features.length > 0){
				return true
			}
		}
		return false
	}

	getMapConfigFromStorage = () => {
		const loadedData = localStorage.getItem('mapData')

		if (loadedData) {
			const loadedDataJSON = JSON.parse(loadedData)

			if(loadedDataJSON.map){
				return {
					center: loadedDataJSON.map.center,
					zoom: loadedDataJSON.map.zoom,
					style: loadedDataJSON.map.style,
				}
			}
		}
		return false
	}

	loadFromStorage = () => {

		const loadedData = localStorage.getItem('mapData')

		if (loadedData) {
			const loadedDataJSON = JSON.parse(loadedData)

			if(loadedDataJSON.map){
				this.map.setCenter(loadedDataJSON.map.center)
				this.map.setZoom(loadedDataJSON.map.zoom)
			//	this.map.setStyle(loadedDataJSON.map.style)
			}

			if(loadedDataJSON.featureOptions){
				this.featureOptions = loadedDataJSON.featureOptions
				this.setDroneRange(this.featureOptions.droneRange)
			}

			if(loadedDataJSON.mapData){
				this.mapData = loadedDataJSON.mapData
				this.regenerateMap({
					networksAndTypes: true
				})
			}

		}
	}

	saveToStorage = () => {

		const dataToSave = {
			mapData : this.mapData,
			featureOptions: this.featureOptions,
			map: {
				center: this.map.getCenter(),
				zoom: this.map.getZoom(),
				style: this.currentMapStyle
			}
		}
		localStorage.setItem('mapData', JSON.stringify(dataToSave))
	}
}