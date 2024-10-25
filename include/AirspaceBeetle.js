
import Waynode from './Waynode.js'
import Markers from './Markers.js'
import Networks from './Networks.js'
import LocationTypes from './LocationTypes.js'
import Centroid from './Centroid.js'

export default class{

	// geoJSON for map display
	mapData = {
		locations: {
			type: "FeatureCollection",
			features: []					
		},
		waypoints: {
			type: "FeatureCollection",
			features: []	
		},
		routes: {
			type: "FeatureCollection",
			features: []					
		}
	}

	centroids = []

	// Mapbox objects
	map = null
	hoveredRoute = null
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
	// Constructor, to merge in options
	constructor(options){

		this.options = {...this.options, ...options}

		// Create a new Networks object
		this.networks = new Networks({
			listContainer: this.options.dom.networksList,
			onListMouseMove: (location) => {
				// Set all routes to false
				for(let feature of this.mapData.routes.features){
					this.map.setFeatureState(
						{source: 'routes', id: feature.properties.id},
						{showThisNetwork: false}
					)
				}
				// Filter routes by which ones are within range
				const validRoutes = this.map.querySourceFeatures('routes', {
					sourceLayer: 'routes',
					filter: ['==', 'trust', location.dataset.name]
				})

				// For each valid route, set the feature as being within range
				validRoutes.forEach((feature) => {
					this.map.setFeatureState(
						{source: 'routes', id: feature.id},
						{showThisNetwork: true}
					)
				})
			},
			onListMouseLeave: () => {
				for(let feature of this.mapData.routes.features){
					this.map.setFeatureState(
						{source: 'routes', id: feature.properties.id},
						{showThisNetwork: true}
					)
				}
			}
		})

		this.types = new LocationTypes({
			listContainer: this.options.dom.weightsSliders,
			onSliderChange: (name, value) => {
				this.setCentroidWeights(name, value)
			}
		})

		// Do this early to switch to correct tab immediately
		if(this.hasMapDataStorage()){
			this.options.onHasStorageData()
		}

		const mapLocation = this.getMapPositionFromStorage()

		// Load the Mapbox map
		this.map = new mapboxgl.Map({
			accessToken: this.options.mapbox_token,
			container: this.options.dom.mapbox,
			style: this.options.mapbox_style,
			center: mapLocation.center ?? [this.options.mapbox_view.centre.lng, this.options.mapbox_view.centre.lat],
			zoom: mapLocation.zoom ?? this.options.mapbox_view.zoom,
			boxZoom: false
		})

		// Once the map has loaded
		this.map.on('load', async () => {

			// Prep mapbox layers
			this.initMapLayers()				

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
				this.findObjectByProperty(this.mapData.locations.features, "properties.name", oldHub).properties.isHub  = false
				this.findObjectByProperty(this.mapData.locations.features, "properties.name", newHub).properties.isHub  = true	
				
				this.regenerateMap({centroids: false})
				this.setCentroidLocations()
			},
			onToggleInclude: (locationName, isInclude) => {

				// Update geoJSON
				this.findObjectByProperty(this.mapData.locations.features, "properties.name", locationName).properties.isInclude = isInclude

				this.regenerateMap({markers: false, centroids: false})
				this.setCentroidLocations()
			}
		})
	}

	updateMapContainer = () => {
		this.map.resize()
	}

	// **********************************************************
	// Getters

	getGeojson = () => {
		return {
			type: "FeatureCollection",
			features: [...this.mapData.routes.features, ...this.mapData.locations.features]
		}
	}

	// **********************************************************
	// Map stuff

	// Init the layers for map
	initMapLayers = () => {
		this.map.addSource('routes', {type: 'geojson', data: this.mapData.routes, 'promoteId': "id"})
		this.map.addLayer({
			'id': 'routes',
			'type': 'line',
			'source': 'routes',
			'layout': {
				'line-join': 'round',
				'line-cap': 'round'
			},
			'paint': {
				'line-color': ['get', 'color'],
				'line-width': [
					'case',
					['boolean', ['feature-state', 'hover'], false],
						["match", ["get", "nodeType"], "Hospital", 6, 4],
						["match", ["get", "nodeType"], "Hospital", 4, 2]
				],
				'line-blur': [
					'case',
					['boolean', ['feature-state', 'hover'], false],
					0,
					2
				],
				// Useful page explaining how this works: https://docs.mapbox.com/style-spec/reference/expressions/#case
				'line-opacity': [
					'case',
					['boolean', ['feature-state', 'showThisNetwork'], true],
						[
							'case',
							['<=', ['to-number', ['get', 'pathDistance']], ['to-number', ['feature-state', 'droneRange']]],
								["match", ["get", "nodeType"], "Hospital", 1, [
									'case', ['boolean', ['feature-state', 'hover'], false], 1, 0.6
								]],
								0
						],
						0			
				]
			}
		})

		if(this.options.route_editing.waypoints_enabled){
			this.initRouteEditing()
		}

		// Add hover effects to routes
		this.map.on('mousemove', 'routes', (e) => {
			if (e.features.length > 0) {
				this.highlightRoute(e.features[0])
			}
		})
		this.map.on('mouseleave', 'routes', () => {
			// Clear the route highlighting effect
			this.highlightRoute()
		})
	}

	initRouteEditing = () => {

		// Keypress capture for CTRL or COMMAND key on Mac (to enable add a waynode effect)
		document.addEventListener('keydown', (e) => {
			this.ctrlKeyHeld = e.ctrlKey || e.metaKey
			this.options.route_editing.is_currently_editing = this.ctrlKeyHeld
			this.setCursor()
	 	})
		document.addEventListener('keyup', (e) => {
			this.ctrlKeyHeld = e.ctrlKey || e.metaKey
			this.options.route_editing.is_currently_editing = this.ctrlKeyHeld
			this.setCursor()
		})

		// Add click effect to map
		this.map.on('click', (e) => {
			if(this.options.route_editing.canEdit && !this.options.route_editing.isDragging){
				// TODO: also prevent this if hovering a route - use this.hoveredRoute
				this.createWaypoint(e.lngLat.toArray())
			}
		})

		// Add click effect to route
		this.map.on('mousedown', 'routes', (e) => {
			if (e.features.length > 0 && this.options.route_editing.canEdit && !this.options.route_editing.isDragging){
				// TODO: also prevent this when hovering on a waynode - use this.hoveredWaynode

				// Note: we grab the feature this way, and not just with e.features[0] because for some reason the e.features[0].geometry doesn't update even when we've called setData() in regenerateMap()
				const mapData_feature = this.mapData.routes.features.find(f => f.properties.id == e.features[0].properties.id)
		
				if(mapData_feature.properties.pathDistance < this.featureOptions.droneRange){
		
					// Split the line based on the clicked location
					const newPoint = turf.nearestPointOnLine(mapData_feature.geometry, e.lngLat.toArray())
					const split = turf.lineSplit(turf.lineString(mapData_feature.geometry.coordinates), newPoint)
		
					// Update the line geometry to have the new coordinate spliced in
					split.features[1].geometry.coordinates.shift()
					const newCoords = [...split.features[0].geometry.coordinates, ...split.features[1].geometry.coordinates]
					mapData_feature.geometry.coordinates = newCoords
		
					// Regenerate the map
					this.regenerateMap()
				}
			}
		 })
	}

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
			// Delete out old routes
			this.mapData.routes.features = []

			// Build routes again
			this.buildRoutes()

			// Reapply the new routes
			this.map.on('sourcedata', this.onSourceData)
			this.map.getSource('routes').setData(this.mapData.routes)
		}

		if(_options.metadata){	
			// Render lists of networks and types
			this.networks.updateCounts(this.countOccurrences(this.mapData.locations.features.filter(location => location.properties.isInclude), 'properties.trust'))
			this.networks.renderDOMList()
			this.types.renderDOMList()

			this.setDroneRangeSliderBounds()
		}

		if(_options.centroids){
			// Show centroids
			this.createCentroids()
		}

		// Save to storage as something probably changed
		this.saveToStorage()

	}

	setDroneRangeSliderBounds = () => {
		this.options.dom.routesData.querySelector('.num-routes').innerHTML = this.mapData.routes.features.length

		// Get min/max route length
		const maxRouteLength = this.mapData.routes.features.reduce((max, feature) => Math.max(max, feature.properties.pathDistance), -Infinity)
		const minRouteLength = this.mapData.routes.features.reduce((min, feature) => Math.min(min, feature.properties.pathDistance), Infinity)

		this.options.dom.routesData.querySelector('.route-length').innerHTML = `(${Math.round(minRouteLength*10)/10} - ${Math.round(maxRouteLength*10)/10} km)`

		// Set bounds of range slider
		const sliderMax = Math.min(Math.ceil(maxRouteLength/5)*5, 50)
		this.options.dom.droneRangeSlider.setAttribute('max', sliderMax)
	}

	createCentroids = () => {
		// TODO: Put these into their own object
		// TODO: And make it possible to delete them when loading new CSV data too!
	/*	for(let trust of this.networks.get()){
			const hubLocation = this.mapData.locations.features.find(location => location.properties.isHub && location.properties.trust == trust.name)
			
			const centroid = new Centroid({
				map: this.map,
				trust: trust.name,
				color: trust.color,
				locations: this.mapData.locations.features.filter(location => location.properties.trust == trust.name),
				weights: [],
				hub: hubLocation.geometry.coordinates,
				droneRange: this.featureOptions.droneRange
			})

			this.centroids.push(centroid)
		}*/
	}

	highlightRoute = (feature = null) => {

		// Clear highligthing
		if(!feature){
			if (this.hoveredRoute !== null) {
				this.map.setFeatureState(
					{source: 'routes', id: this.hoveredRoute},
					{hover: false}
				)
				this.hoveredRoute = null
			}

			// Clear the follower
			this.clearFollower()

			// Clear location labels too
			this.markers.showLabels()

			// Reset cursor
			this.setCursor()

		}else{
			// Apply feature state to the correct route
			// Only do the hover if we are within the droneRange or not
			// TODO: Make this filtering more generic
			if(feature.properties.pathDistance < this.featureOptions.droneRange){

				// Unhighlight current hovered one
				if (this.hoveredRoute !== null) {
					this.map.setFeatureState(
						{source: 'routes', id: this.hoveredRoute},
						{hover: false}
					)
				}

				// Highlight new one
				this.hoveredRoute = feature.id
				this.map.setFeatureState(
					{source: 'routes', id: feature.id},
					{hover: true}
				)

				// Set the follower with distance
				this.setFollowerDistance(feature.properties.pathDistance)

				// Add location labels
				this.markers.showLabels([feature.properties.source, feature.properties.destination])

				// Set cursor
				this.setCursor('routeHover')
			}
		}

		
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

	zoomToLocations = () => {
		const bbox = turf.bbox(this.mapData.locations)
		this.map.fitBounds(bbox,{
			padding: 20
		})
	}

	// Create a new waypoint
	createWaypoint = (lngLat) => {
		this.mapData.waypoints.features.push({
			type: 'Feature',
			geometry: {
				type: 'Point',
				coordinates: lngLat
			},
			properties: {
				name: `Waypoint ${this.mapData.waypoints.features.length+1}`,
				type: 'waypoint',
			}
		})
		this.regenerateMap()
	}

	buildRoutes = () => {

		for (const hubLocation of this.mapData.locations.features) {
			if(hubLocation.properties.isHub){
				// Only build routes to/from the hubs
				const trust = hubLocation.properties.trust
				const hubCoords = hubLocation.geometry.coordinates

				const nodes = this.mapData.locations.features.filter(location => location.properties.trust == trust && location.properties.isInclude)

				for(let node of nodes){
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
							color: 			this.networks.get().find(t => t.name == trust).color
						},
						geometry: {
							type: 'LineString',
							coordinates: [
								hubCoords,
								nodeCoords,
							]
						}
					}
					this.mapData.routes.features.push(newRoute)
				}
			}
		}
	}

	buildNetworksAndTypes = () => {
		for(let location of this.mapData.locations.features){
			this.networks.add(location.properties.trust)
			this.types.add(location.properties.type)
		}
	}

	// Helper function to do first call to set drone range once the route data has been loaded onto the map
	onSourceData = (e) => {
		if (e.isSourceLoaded && e.sourceDataType != 'metadata'){ // I worked out these parameter checks by inspection and guesswork, may not be stable!
			this.map.off('sourcedata', this.onSourceData)
			setTimeout(() => {
				// HACK HACK HACK HACK HACK
				// TODO try map.loaded()
				this.setDroneRange(this.featureOptions.droneRange)
			}, 100)
		}
	}

	empty = () => {
		localStorage.clear()
	}

	// **********************************************************
	// Update geoJSON from updated CSV data

	importNewLocations = (newLocations) => {

		// Clear existing map content
		this.mapData.routes.features = []
		this.mapData.locations.features = []

		// Reset all objects
		this.networks.empty()
		this.types.empty()
		this.markers.removeFromMap(true)

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
		const existingLocation = this.findObjectByProperty(this.mapData.locations.features, "properties.name", name)
		if(!existingLocation){
			const	properties = {
				name: name,
				centroidWeight: 1,
				isInclude: true,
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

	// **********************************************************
	// Drone range handling

	setDroneRange = (range) => {
		// Save the range
		this.featureOptions.droneRange = parseInt(range)

		for(let feature of this.mapData.routes.features){
			this.map.setFeatureState(
				{source: 'routes', id: feature.properties.id},
				{droneRange: this.featureOptions.droneRange}
			)
		}

		// Update this info in the centroids too
		for(let centroid of this.centroids){
			centroid.setDroneRange(range)
		}
	}

	// **********************************************************
	// Centroids

	setCentroidWeights = (type, weight) => {
		for(let location of this.mapData.locations.features){
			if(location.properties.type == type){
				location.properties.centroidWeight = weight
			}
		}

		this.setCentroidLocations()
	}

	setCentroidLocations = () => {
		for(let centroid of this.centroids){
			centroid.setLocations(this.mapData.locations.features.filter(location => location.properties.trust == centroid.getTrust() && location.properties.isInclude))
		}
	}

	toggleCentroids = (isShow = false) => {
		for(let centroid of this.centroids){
			isShow ? centroid.show() : centroid.hide()
		}
	}

	// **********************************************************
	// localStorage

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

	getMapPositionFromStorage = () => {
		const loadedData = localStorage.getItem('mapData')

		if (loadedData) {
			const loadedDataJSON = JSON.parse(loadedData)

			if(loadedDataJSON.map){
				return {
					center: loadedDataJSON.map.center,
					zoom: loadedDataJSON.map.zoom
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
				zoom: this.map.getZoom()
			}
		}
	
		localStorage.setItem('mapData', JSON.stringify(dataToSave))
	}

	// **********************************************************
	// Generic helper functions

	findObjectByProperty = (array, propertyPath, value) => {
		for (let i = 0; i < array.length; i++) {
			let obj = array[i];
			const propertyParts = propertyPath.split('.')
			for (let j = 0; j < propertyParts.length; j++) {
				if (!obj) {
				break // If the property path is invalid, break the loop
				}
				obj = obj[propertyParts[j]];
			}
			if (obj === value) {
				return array[i]
			}
		}
		return null
	}

	countOccurrences = (array, property) => {
		return array.reduce((counts, obj) => {
		  // Access the property value using optional chaining
		  const value = this.getNestedProperty(obj, property);
	 
		  // Handle missing or invalid property paths
		  if (value === undefined) {
			 return counts // Skip objects without the property
		  }
	 
		  // Count occurrences based on the extracted value
		  counts[value] = (counts[value] || 0) + 1
		  return counts
		}, {})
	 }
	 
	 // Helper function to access nested properties with optional chaining
	 getNestedProperty = (obj, propertyPath) => {
		const parts = propertyPath.split('.')
		let current = obj
		for (const part of parts) {
		  current = current?.[part] // Use optional chaining
		  if (current === undefined) {
			 return undefined // Stop if any property is missing
		  }
		}
		return current
	 }


}