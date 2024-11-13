import Networks from './Networks.js'
import RangeSlider from './RangeSlider.js'
import Select from './Select.js'
import './Utils.js'

export default class{

	// geoJSON for map display
	mapData = {
		locations: {
			type: "FeatureCollection",
			features: []					
		}
	}

	newNetworks = []

	// Mapbox objects
	map = null
	hoveredLocation = null

	// Feature options
	featureOptions = {
		droneRange: 10,
		droneMinRange: 0,
		snapDistance: 0.3, // kilometers
		weights: {
			hospitals: 1,
			others: 1
		},
		routeColor: 'network',
		markerColor: 'network',
		showCentroids: false
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

		// Create new filter range sliders
		this.maxRangeSlider = new RangeSlider({
			container: this.options.dom.filterSliders,
			label: 'Max range:',
			min: 1,
			max: 10,
			value: 10,
			step: 1,
			valueSuffix: 'km',
			onInput: (value) => {
				this.featureOptions.droneRange = parseInt(value)
				this.networks.setDroneMaxRange(this.featureOptions.droneRange)
				this._recalculateStats()
				this._saveToStorage()
			}
		})
		this.minRangeSlider = new RangeSlider({
			container: this.options.dom.filterSliders,
			label: 'Min range:',
			min: 0,
			max: 5,
			value: 0,
			step: 0.1,
			valueSuffix: 'km',
			onInput: (value) => {
				this.featureOptions.droneMinRange = parseInt(value)
				this.networks.setDroneMinRange(this.featureOptions.droneMinRange)
				this._recalculateStats()
				this._saveToStorage()
			}
		})

		// Create colour selectors
/*		this.markerSizeSelect = new Select({
			container: this.options.dom.colourSelectors,
			label: 'Marker size:',
			options: [
				{name: 'Mini', 			value: 'mini'},
				{name: 'Normal', 			value: 'normal'},
			],
			onChange: (colorMode) => {
				// TODO: Toggle page class & save to localStorage
			}
		})*/
		this.markerColorSelect = new Select({
			container: this.options.dom.colourSelectors,
			label: 'Marker display:',
			options: [
				{name: 'None', 			value: 'none'},
				{name: 'Ghost', 			value: 'ghost'},
				{name: 'Blue', 			value: 'blue'},
				{name: 'Yellow', 			value: 'yellow'},
				{name: 'By network', 	value: 'network', selected: true},
	//			{name: 'By type', 		value: 'type'}
			],
			onChange: (colorMode) => {
				this.featureOptions.markerColor = colorMode
				this.networks.setMarkerColor(colorMode)
				this._saveToStorage()
			}
		})
		this.routeColorSelect = new Select({
			container: this.options.dom.colourSelectors,
			label: 'Route display:',
			options: [
				{name: 'None', 			value: 'none'},
				{name: 'Ghost', 			value: 'ghost'},
				{name: 'Blue', 			value: 'blue'},
				{name: 'Yellow', 			value: 'yellow'},
				{name: 'By network', 	value: 'network', selected: true},
				{name: 'By length', 		value: 'length'}
			],
			onChange: (colorMode) => {
				this.featureOptions.routeColor = colorMode
				this.networks.setRouteColor(colorMode)
				this._saveToStorage()
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
			style: this.getStyleURLFromStyle(this.currentMapStyle),
			center: mapConfig.center ?? [this.options.mapbox_view.centre.lng, this.options.mapbox_view.centre.lat],
			zoom: mapConfig.zoom ?? this.options.mapbox_view.zoom,
			boxZoom: false
		})

		// Once the map has loaded
		this.map.on('load', async () => {

			// Create a new Networks object
			this.networks = new Networks({
				map: this.map,
				listContainer: this.options.dom.networksList,
				onChange: () => {
					// Save to storage
					this._recalculateStats()
					this._saveToStorage()
				},
				onRouteMouseOver: (length) => {
					this.setFollowerText(`${Math.round(length*10)/10} km`, 'route')	// Set the follower with distance
					this.setCursor('routeHover')		// Set cursor
				},
				onRouteMouseLeave: () => {
					this.clearFollower()			// Clear the follower
					this.setCursor()				// Reset cursor
				}
			})

			// Load data from local storage
			this.loadFromStorage()	
		})

		// Set handler for the map changing
		this.map.on('moveend', () => {
			if(this.networks.getLocations().features.length > 0){
				this._saveToStorage()
			}
		})

	}

	// **********************************************************
	// Map handlers / manipulation etc

	_zoomToLocations = () => {
		const bbox = turf.bbox(this.networks.getLocations(true))
		this.map.fitBounds(bbox,{
			padding: 20
		})
	}
	
	// **********************************************************
	// Public functions (in theory!)
	// TODO: Set all other fns to _ prefix

	updateMapContainer = () => {
		this.map.resize()
	}

	getGeojson = () => {

		// Get the data we want to return
		const routes = this.networks.getRoutesInRange().features
		const locations = this.networks.getLocations(true).features

		// Add simple-style properties
		const networkColors = this.networks.getNetworkColors()
		for(let route of routes){
			route.properties.stroke = networkColors.find(network => network.name == route.properties.trust).color			
		}
		for(let location of locations){
			location.properties['marker-color'] = networkColors.find(network => network.name == location.properties.trust).color				
		}

		// Return as one big featurecollection
		return {
			type: "FeatureCollection",
			features: [...routes, ...locations]
		}
	}

	setMapStyle = async (style) => {

		if(style == this.currentMapStyle){
			return
		}

		this.currentMapStyle = style

		// For when changing the base map
		this.map.once('style.load', async (e) => {
			await this.networks.reRenderAfterStyleChange()
		})
		this.map.setStyle(this.getStyleURLFromStyle(style))

		this._saveToStorage()
	}

	getStyleURLFromStyle = (style) => {
		switch(style){
			case 'light':
				return 'mapbox://styles/mapbox/light-v11'
			case 'dark':
				return 'mapbox://styles/mapbox/dark-v11'
			case 'satellite':``
				return 'mapbox://styles/mapbox/satellite-v9'
			case 'apian':
			default:
				return 'mapbox://styles/annamitch/clsded3i901rg01qyc16p8dzw'
		}
	}

	toggleCentroids = (state) => {
		this.networks.toggleCentroids(state)
		this.featureOptions.showCentroids = state
		this._saveToStorage()
	}

	// **********************************************************
	// Adjust general drone / styling properties 

	empty = () => {
		localStorage.removeItem('mapData')
	}

	// **********************************************************
	// New data importing
	
	// Update geoJSON from updated CSV data
	importNewLocations = async (newLocations) => {
		await this.networks.importGeoJSON(newLocations)
		this._recalculateStats()
		this._zoomToLocations()
		this._saveToStorage()
	}

	_importFromStorage = async (storedData) => {

		// Configure map
		this.map.setCenter(storedData.map.center)
		this.map.setZoom(storedData.map.zoom)

		// Set UI options
		this.featureOptions = storedData.featureOptions
		this.maxRangeSlider.setValue(this.featureOptions.droneRange)
		this.minRangeSlider.setValue(this.featureOptions.droneMinRange)
		this.routeColorSelect.setValue(this.featureOptions.routeColor)
		this.markerColorSelect.setValue(this.featureOptions.markerColor)

		// Add centroid sliders
		this._createCentroidWeightSliders(storedData.locations.features.countOccurrences("properties.type"))

		// Now load in data to networks object
		await this.networks.importGeoJSON(storedData.locations)

		// Set saved settings
		this.networks.setDroneMaxRange(this.featureOptions.droneRange)
		this.networks.setDroneMinRange(this.featureOptions.droneMinRange)
		this.networks.setRouteColor(this.featureOptions.routeColor)
		this.networks.setMarkerColor(this.featureOptions.markerColor)
		this.networks.toggleCentroids(this.featureOptions.showCentroids)

		// Update numbers
		this._recalculateStats()
	}

	_createCentroidWeightSliders = (types) => {

		// Sort by name
		types.sort((a, b) => a.name.localeCompare(b.name))

		for(let type of types){
			new RangeSlider({
				container: this.options.dom.weightsSliders,
				label: `${type.name}:`,
				min: 1,
				max: 100,
				value: 1,
				step: 1,
				valueSuffix: '',
				onInput: async (value) => {
					await this.networks.setCentroidWeight(type.name, parseInt(value))
					this._saveToStorage()
				}
			})
		}
	}

	// **********************************************************

	_recalculateStats = () => {

		// Recalculate the stats and metadata bit
		const routeProps = this.networks.getTotals()
		this.options.dom.stats.routes.innerHTML = routeProps.numRoutes
		this.options.dom.stats.locations.innerHTML = routeProps.numLocations
		this.options.dom.stats.networks.innerHTML = routeProps.numNetworks

		this.maxRangeSlider.setLimits({
			// TODO: check this
			max: Math.min(Math.ceil(routeProps.maxRouteLength/5)*5, 50)
		})
	}

	// **********************************************************
	// Interactions to play with map content

	setCursor(type){

		let cursor = 'grab'
		switch(type){
			case 'routeHover':
				cursor = 'default'
				break
			default:
				cursor = 'grab'
				break
		}
		this.map.getCanvasContainer().style.cursor = cursor
	}

	// Helpers for the follower that shows the total distance
	setFollowerText = (msg, style) => {
		this.options.follower.set(msg, {style: style})
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
			if(loadedDataJSON.locations.features.length > 0){
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

	loadFromStorage = async () => {

		const loadedData = localStorage.getItem('mapData')

		if (loadedData) {
			const loadedDataJSON = JSON.parse(loadedData)
			await this._importFromStorage(loadedDataJSON)
		}
	}

	_saveToStorage = () => {
		const dataToSave = {
			locations : this.networks.getLocations(),
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