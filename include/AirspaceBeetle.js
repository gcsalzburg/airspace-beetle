
import Waynode from './Waynode.js'
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
		},
		centroids: [],
		markers: [],
		trusts: [],
		types: []
	}

	// Mapbox objects
	map = null
	hoveredRoute = null

	currentUIState = 'initial'

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
			zoom: 10,
			centre: {
				lng: -0.164136,
				lat: 51.569356,
			}
		}
	}

	// **********************************************************
	// Constructor, to merge in options
	constructor(options){

		this.options = {...this.options, ...options}

		// Load map
		this.initMap()

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
	// Start the Airspace Beetle
	initMap = async () => {

		// Load the Mapbox map
		this.map = new mapboxgl.Map({
			accessToken: this.options.mapbox_token,
			container: this.options.dom.mapbox,
			style: this.options.mapbox_style,
			center: [this.options.mapbox_view.centre.lng, this.options.mapbox_view.centre.lat],
			zoom: this.options.mapbox_view.zoom,
			boxZoom: false
		})

		// Once the map has loaded
		this.map.on('load', async () => {
			this.initMapLayers()				// Prep mapbox layers

			this.loadFromStorage()					// Load settings from local storage
			this.options.onReady()			// Call the ready function to load in first data
		})

		// Set handler for the map changing
		this.map.on('moveend', () => {
			this.saveToStorage()
		})
	}

	updateMapContainer = () => {
		this.map.resize()
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

		// Keypress capture for CTRL or COMMAND key on Mac (to enable add a waynode effect)
		//document.addEventListener('keydown', (e) => {
		//	this.ctrlKeyHeld = e.ctrlKey || e.metaKey
		////	if(this.currentUIState == 'routeHover'){
		//		this.map.getCanvasContainer().style.cursor = 'crosshair'
		////	}
	 	//})
		//document.addEventListener('keyup', (e) => {
		//	this.ctrlKeyHeld = e.ctrlKey || e.metaKey
		////	if(this.currentUIState == 'routeHover'){
		//		this.map.getCanvasContainer().style.cursor = 'default'
		////	}
		//})

		// Add click effect to map
		//this.map.on('click', (e) => {
		//	if (this.ctrlKeyHeld && this.currentUIState && !['waynodeDrag', 'waynodeHover', 'routeHover'].includes(this.currentUIState)) {
		//		this.createWaypoint(e.lngLat.toArray())
		//	}
		//})

		// Add hover effects to routes
		this.map.on('mousemove', 'routes', (e) => {
			if (e.features.length > 0) {
				this.setUIState('routeHover', {feature: e.features[0]})
			}
		})

		//// Add click effect to route
		//this.map.on('mousedown', 'routes', (e) => {
		//	if (e.features.length > 0 && this.ctrlKeyHeld && (this.currentUIState != 'waynodeHover')){
		//		// Note: we grab the feature this way, and not just with e.features[0] because for some reason the e.features[0].geometry doesn't update even when we've called setData() in regenerateMap()
		//		const mapData_feature = this.mapData.routes.features.find(f => f.properties.id == e.features[0].properties.id)
		//
		//
		//		if(mapData_feature.properties.pathDistance < this.featureOptions.droneRange){
		//
		//			// Split the line based on the clicked location
		//			const newPoint = turf.nearestPointOnLine(mapData_feature.geometry, e.lngLat.toArray())
		//			const split = turf.lineSplit(turf.lineString(mapData_feature.geometry.coordinates), newPoint)
		//
		//			// Update the line geometry to have the new coordinate spliced in
		//			split.features[1].geometry.coordinates.shift()
		//			const newCoords = [...split.features[0].geometry.coordinates, ...split.features[1].geometry.coordinates]
		//			mapData_feature.geometry.coordinates = newCoords
		//
		//			// Regenerate the map
		//			this.regenerateMap()
		//		}
		//	}
		// });

		this.map.on('mouseleave', 'routes', () => {
			this.setUIState('routeLeave')
		})

		// Add hover effects to list of locations on side
		this.options.dom.locationsList.addEventListener('mousemove', (e) => {
			const location = e.target.closest('.location')
			if(location){

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

			}
		})
		this.options.dom.locationsList.addEventListener('mouseleave', (e) => {
			for(let feature of this.mapData.routes.features){
				this.map.setFeatureState(
					{source: 'routes', id: feature.properties.id},
					{showThisNetwork: true}
				)
			}
		})
	}

	regenerateMap = (options) => {

		const _options = {...{
			markers: true,
			routes: true,
			metadata: true,
			centroids: true,
			saveToStorage: true
		}, ...options}
	
		if(_options.markers){
			// Clear old markers
			for(let marker of this.mapData.markers){
				marker.remove()
			}
			// Add new markers
			this.addMarkers()
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
			// Create list of all Trust networks
			this.createTrustsList()

			this.createTypesList()

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

	createTrustsList = () => {

		this.options.dom.locationsList.innerHTML = ""

		// Recalculate list
		for(let trust of this.mapData.trusts){
			trust.numLocations = this.mapData.locations.features.filter(location => location.properties.trust == trust.name && !location.properties.exclude).length
		}

		// Sort list of Trusts
		this.mapData.trusts.sort((a,b) => b.name.localeCompare(a.name))
		this.mapData.trusts.sort((a,b) => a.numLocations - b.numLocations).reverse()

		// Print the list
		for(let trust of this.mapData.trusts){
			this.options.dom.locationsList.insertAdjacentHTML('beforeend',`<div class="location" data-name="${trust.name}"><span class="num" style="background-color:${trust.color}">${trust.numLocations}</span> ${trust.name}</div>`)
		}
	}

	createTypesList = () => {

		this.options.dom.weightsSliders.innerHTML = ""

		// Sort list of types alphabetically
		this.mapData.types.sort((a,b) => a.name - b.name)

		for(let type of this.mapData.types){
			const safeName = type.name.replace(/\s/g, "")
			const sliderHTML = `<div class="slider-wrapper ${safeName}-weight-wrapper">
									<label for="${safeName}-weight">${type.name}:</label>
									<span class="slider">
										<input type="range" class="${safeName}-weight" id="${safeName}-weight" name="${safeName}-weight" min="1" max="100" step="1" value="1" />
									</span>
									<span class="value">1</span>
								</div>`
			this.options.dom.weightsSliders.insertAdjacentHTML('beforeend',sliderHTML)

			document.querySelector(`.${safeName}-weight-wrapper input[type="range"]`).addEventListener("input", (e) => {
				document.querySelector(`.${safeName}-weight-wrapper .value`).textContent = `${e.target.value}`
				this.setCentroidWeights(type.name,e.target.value)
			})
		}
	}

	createCentroids = () => {
		for(let trust of this.mapData.trusts){
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

			this.mapData.centroids.push(centroid)
		}
	}

	setUIState = (state, options = {}) => {

		// Clear any differences here
		if(state == this.currentUIState){
			// Do nothing?
			return
		}

		switch(state){

			case 'locationHover':
				// Show the hovered name for this location
				// (maybe) highlight all routes to/from this location

				if(this.currentUIState != 'waynodeDrag'){
					document.querySelectorAll('.marker').forEach(marker => marker.classList.remove('show-label'))
					document.querySelector(`.marker[data-name="${options.location}"]`).classList.add('show-label')
					this.currentUIState = state
				}

				break

			case 'locationLeave':
				if(!['waynodeDrag', 'waynodeHover'].includes(this.currentUIState)){
					this.setUIState('initial')
					this.currentUIState = state
				}
				break

			case 'routeHover':
				// Highlight the route
				// Label the start and end locations
				// Add follower with the length of the route
				// Set cursor, based on if CTRL key held down or not

				if(!['waynodeDrag', 'waynodeHover'].includes(this.currentUIState)){
					this.map.getCanvasContainer().style.cursor = this.ctrlKeyHeld ? 'crosshair' : 'default'
					this.highlightRoute(options.feature)
					this.currentUIState = state
				}
				
				break
			
			case 'routeLeave':
				if(!['waynodeDrag', 'waynodeHover'].includes(this.currentUIState)){
					this.setUIState('initial')
					this.currentUIState = state
				}
				break

			case 'waynodeHover':
				// Change cursor to move cursor
				// (maybe) make the route dashed to show it is about to be edited
				// Add follower with the length of the route

				if(this.currentUIState != 'waynodeDrag'){
					this.highlightRoute(options.feature)
					this.map.getCanvasContainer().style.cursor = 'move'
					this.currentUIState = state
				}

				break

			case 'waynodeLeave':
				if(this.currentUIState != 'waynodeDrag'){
					// TODO: Do we switch to the route hover at this point or not?
					this.setUIState('initial')
					this.currentUIState = state
				}
				break

			case 'waynodeDrag':
				// Match whatver the above is
				// Add follower with the length of the route
				this.highlightRoute(options.feature)
				this.map.getCanvasContainer().style.cursor = 'move'
				this.currentUIState = state
				break

			case 'waynodeDragEnd':
				this.setUIState('initial')
				this.currentUIState = state
				break

			case 'initial':
				// Default case here

				this.map.getCanvasContainer().style.cursor = 'grab'

				// Clear any route hover effects
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
				this.showLocationLabels()

				this.currentUIState = state

				break
		}
	}

	highlightRoute = (feature) => {
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
			this.showLocationLabels([feature.properties.source, feature.properties.destination])
		}
	}

	// Helper to show/hide location labels
	showLocationLabels = (labels = null) => {
		document.querySelectorAll('.marker').forEach(marker => marker.classList.remove('show-label'))

		if(Array.isArray(labels)){
			for(let label of labels){
				document.querySelector(`.marker[data-name="${label}"]`).classList.add('show-label')
			}
		}else if(labels !== null){
			document.querySelector(`.marker[data-name="${labels}"]`).classList.add('show-label')
		}
	}

	// Helpers for the follower that shows the total distance
	setFollowerDistance = (distance) => {
		this.options.follower.set(`${Math.round(distance*10)/10} km`, {style: 'route'})
	}
	clearFollower = () => {
		this.options.follower.clear()
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

	// Add markers from geoJSON
	addMarkers = () => {

		// Add markers for all end locations
		for (const feature of this.mapData.locations.features) {
			// create a HTML element for each feature
			const el = document.createElement('div')
			el.insertAdjacentHTML('beforeend',`<div class="label"><span class="line1">${feature.properties.name}</span><span class="line2">${feature.properties.type}</span></div>`)
			el.className = 'marker'
			el.dataset.name = `${feature.properties.name}`//<br>${feature.properties.type}`
			el.dataset.type = feature.properties.type
			el.dataset.trust = feature.properties.trust

			const color = this.mapData.trusts.find(trust => trust.name == feature.properties.trust).color
			el.style = `--tooltip-background-color: ${color}`
			el.style.background = color
			if(feature.properties.isHub){
				el.classList.add('is_hub')
			}
			const newMarker = new mapboxgl.Marker(el).setLngLat(feature.geometry.coordinates).addTo(this.map)
			this.mapData.markers.push(newMarker)

			// Add marker interactions
			el.addEventListener('mouseover', () => {
				this.setUIState('locationHover', {location:feature.properties.name})
			})
			el.addEventListener('mouseleave', () => {
				this.setUIState('locationLeave')
			})
			el.addEventListener('click', (e) => {

				if(!feature.properties.isHub){

					if(e.shiftKey){

						// Turning into the hub!
						const currentHub = this.mapData.locations.features.find(location => location.properties.trust == feature.properties.trust && location.properties.isHub)
						currentHub.properties.isHub = false
						feature.properties.isHub = true
						this.regenerateMap({
							centroids: false
						})
						this.setCentroidLocations()

					}else{

						// Toggling to exclude it
						feature.properties.exclude = !feature.properties.exclude
						el.classList.toggle('isExclude', feature.properties.exclude)

						this.regenerateMap({
							markers: false,
							centroids: false
						})
						this.setCentroidLocations()

					}

				}
			})
		}

		// Add markers for all waypoints
		for (const feature of this.mapData.waypoints.features) {
			// TODO: Merge the below into a generic DraggableWayMarker class, from which the Waynode and WayMarker are derived
			// create a HTML element for each feature
			const el = document.createElement('div')
			el.className = 'marker-waypoint'
			el.dataset.name = feature.properties.name
			const newMarker = new mapboxgl.Marker(el,{draggable: true}).setLngLat(feature.geometry.coordinates).addTo(this.map)
			this.mapData.markers.push(newMarker)

			el.addEventListener('click', (e) => {
				if(this.ctrlKeyHeld){

				}
			})

			newMarker.on('dragstart', () => {
			})

			newMarker.on('drag', () => {
			})
			
			newMarker.on('dragend', () => {
				feature.geometry.coordinates = newMarker.getLngLat().toArray()
			})
		}

		// Add markers for extra nodes we added
		for (const feature of this.mapData.routes.features) {

			// Do we have any waynodes?
			if(feature.geometry.coordinates.length > 2){

				// Get just the waynodes
				const interpoints = [...feature.geometry.coordinates]
				interpoints.shift()
				interpoints.pop()

				for (const point of interpoints) {

					// Find the mapbox feature on the map corresponding to this route
					const mapboxRouteFeatures = this.map.querySourceFeatures('routes', {
						filter: ['==', 'id', feature.properties.id]
					})
					const mapboxRouteFeature = mapboxRouteFeatures[0]

					// Create new Waynode and add to the map
					const waynode = new Waynode({
						'className': 'marker-waynode',
						'routeID': feature.properties.id,
						'mapboxRouteFeature': mapboxRouteFeature,
						'setUIState': (state, opts) => this.setUIState(state, opts),

						onDragStart: () => {
							waynode.setPointIndex(feature.geometry.coordinates)
							this.setUIState('waynodeDrag', {feature: mapboxRouteFeature})
						},
						onDrag: () => {
							
							// Snap to a waypoint, if close enough
							waynode.snapTo(this.mapData.waypoints.features, this.featureOptions.snapDistance)
						
							// Update node in the coordinates for this feature
							feature.geometry.coordinates[waynode.getPointIndex()] = waynode.getLngLat()

							// Re-render
							feature.properties.pathDistance = turf.length(feature, 'kilometers')						
							this.regenerateMap({markers: false, centroids: false})

							// Show follower
							this.setFollowerDistance(feature.properties.pathDistance)
						},
						onDragEnd: () => {
							this.setUIState('waynodeDragEnd')
						},
						onDelete: (waynode) => {
							// Find the correct route for this waynode
							const route = this.mapData.routes.features.find(route => route.properties.id == waynode.getRouteID())

							// Remove the correct node
							route.geometry.coordinates.splice(route.geometry.coordinates.findIndex(coord => (coord[0] == waynode.getLngLat()[0]) && (coord[1] == waynode.getLngLat()[1])), 1)

							// Find and remove this node from the list of markers
							this.mapData.markers.splice(this.mapData.markers.findIndex(item => item.uniqueID == waynode.getID()), 1)
							
							// Regen map
							this.regenerateMap()
						}
					})

					// Add to the map
					waynode.addToMap(this.map, point)

					// Save the waynode in list of markers
					this.mapData.markers.push(waynode)
				}
			}
		}
	}

	buildRoutes = () => {

		for (const hubLocation of this.mapData.locations.features) {
			if(hubLocation.properties.isHub){
				// Only build routes to/from the hubs
				const trust = hubLocation.properties.trust
				const hubCoords = hubLocation.geometry.coordinates

				const nodes = this.mapData.locations.features.filter(location => location.properties.trust == trust && !location.properties.exclude)

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
							color: 			this.mapData.trusts.find(t => t.name == trust).color
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

	// **********************************************************
	// Update geoJSOn from updated CSV data

	importNewLocations = (newLocations) => {

		// Clear existing map content
		this.mapData.routes.features = []
		this.mapData.locations.features = []

		for(let location of newLocations){

			// Update Trusts list
			this.addTrust(location.trust)

			// Update types list
			this.addType(location.type)

			// Save the location if it is a unique location
			this.addLocation(location.name, location.coordinates, {
				type: location.type,
				trust: location.trust,
				isHub: location.isHub
			})

		}
		
		// Add the nodes as markers
		this.regenerateMap()
	}


	// Add a new Trust to the list
	addTrust = (name) => {
		const existingTrust = this.findObjectByProperty(this.mapData.trusts, "name", name)
		if(!existingTrust){
			this.mapData.trusts.push({
				name: name,
				numLocations: 1,
				color: `hsl(${this.mapData.trusts.length*39}, 72%, 53%)`
			})
		}else{
			existingTrust.numLocations = existingTrust.numLocations + 1
		}
	}

	// Add a new type to the list
	addType = (name) => {
		const existingType = this.findObjectByProperty(this.mapData.types, "name", name)
		if(!existingType){
			this.mapData.types.push({
				name: name,
				numLocations: 1
			})
		}else{
			existingType.numLocations = existingType.numLocations + 1
		}
	}

	// Add a location to the list
	addLocation = (name, coords, metadata = {}) => {
		const existingLocation = this.findObjectByProperty(this.mapData.locations.features, "properties.name", name)
		if(!existingLocation){
			const	properties = {
				name: name,
				centroidWeight: 1,
				exclude: false,
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
		for(let centroid of this.mapData.centroids){
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
		for(let centroid of this.mapData.centroids){
			centroid.setLocations(this.mapData.locations.features.filter(location => location.properties.trust == centroid.getTrust() && !location.properties.exclude))
		}
	}

	toggleCentroids = (isShow = false) => {
		for(let centroid of this.mapData.centroids){
			isShow ? centroid.show() : centroid.hide()
		}
	}

	// **********************************************************
	// localStorage

	loadFromStorage = () => {

		const loadedData = localStorage.getItem('mapData')

		if (loadedData) {
			const loadedDataJSON = JSON.parse(loadedData)

		//	if(loadedDataJSON.mapData){
		//		this.mapData = loadedDataJSON.mapData
		//		this.regenerateMap()
		//	}

			if(loadedDataJSON.featureOptions){
				this.featureOptions = loadedDataJSON.featureOptions
				this.setDroneRange(this.featureOptions.droneRange)
			}

			if(loadedDataJSON.map){
				this.map.setCenter(loadedDataJSON.map.center)
				this.map.setZoom(loadedDataJSON.map.zoom)
			}
		}
	}

	saveToStorage = () => {

		const dataToSave = {
			// TODO fix this so we don't save objects (like markers and centroids), just the data we need to re-create them when we load it back in
		//	mapData : this.mapData,
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


}