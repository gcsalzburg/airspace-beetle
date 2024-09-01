
export default class{

	// geoJSON for map display
	mapData = {
		locations: {
			type: "FeatureCollection",
			features: []					
		},
		routes: {
			type: "FeatureCollection",
			features: []					
		},
		markers: []
	}

	// Mapbox objects
	map = null
	hoveredRoute = null

	// index of the new node we adding to a route
	isHoveringOnIntermediatePoint = false

	// Feature options
	featureOptions = {
		droneRange: 5
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
		})

		// Once the map has loaded
		this.map.on('load', async () => {
			this.initMapLayers()				// Prep mapbox layers
			this.options.onReady()			// Call the ready function to load in first data
		})
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
				'line-color': `#ffc03a`,
				'line-width': [
					'case',
					['boolean', ['feature-state', 'hover'], false],
					7,
					4
				],
				'line-blur': [
					'case',
					['boolean', ['feature-state', 'hover'], false],
					0,
					3
				],
				'line-opacity': [
					'case', 
					['boolean', ['feature-state', 'withinDroneRange'], false],
					1,
					0
				]
			}
		})

		// Add hover effects to routes
		this.map.on('mousemove', 'routes', (e) => {
			this.map.getCanvas().style.cursor = 'crosshair'
			if (e.features.length > 0) {

				for(let feature of e.features){
					if(feature.properties.distance < this.featureOptions.droneRange){
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
						this.options.follower.set(`${Math.round(feature.properties.distance*10)/10} km`, {style: 'route'})

						// Add location labels
						document.querySelectorAll('.marker').forEach(marker => marker.classList.remove('show-label'))
						document.querySelector(`.marker[data-name="${feature.properties.source}"]`).classList.add('show-label')
						document.querySelector(`.marker[data-name="${feature.properties.destination}"]`).classList.add('show-label')
						break
					}
				}
			}
		})

		this.map.on('click', 'routes', (e) => {
			if (e.features.length > 0) {
				// Note: we grab the feature this way, and not just with e.features[0] because for some reason the e.features[0].geometry doesn't update even when we've called setData() in regenerateMap()
				const mapData_feature = this.mapData.routes.features.find(f => f.properties.id == e.features[0].properties.id)

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
		 });

		this.map.on('mouseleave', 'routes', () => {

			this.map.getCanvas().style.cursor = 'grab'

			// Clear hover effect
			if (this.hoveredRoute !== null) {
				this.map.setFeatureState(
					{source: 'routes', id: this.hoveredRoute},
					{hover: false}
				)
			}
			this.hoveredRoute = null
			this.options.follower.clear()

			// Clear location labels too
			document.querySelectorAll('.marker').forEach(marker => marker.classList.remove('show-label'))
		})

		// Add hover effects to list of locations on side
		this.options.dom.locationsList.addEventListener('mousemove', (e) => {
			const location = e.target.closest('.location')
			if(location){
				document.querySelectorAll('.marker').forEach(marker => marker.classList.remove('show-label'))
				document.querySelector(`.marker[data-name="${location.dataset.name}"]`).classList.add('show-label')
			}else{
				document.querySelectorAll('.marker').forEach(marker => marker.classList.remove('show-label'))
			}
		})
	}

	regenerateMap = () => {

		// Clear old markers
		for(let marker of this.mapData.markers){
			marker.remove()
		}
		// Add new markers
		this.addMarkers()
		
		// Reapply the new routes
		this.map.on('sourcedata', this.onSourceData)
		this.map.getSource('routes').setData(this.mapData.routes)

		// Display list of all locations, routes etc
		this.createRoutesData()
		this.createLocationsList()
	}

	createRoutesData = () => {
		this.options.dom.routesData.querySelector('.num-routes').innerHTML = this.mapData.routes.features.length

		// Get min/max route length
		const maxRouteLength = this.mapData.routes.features.reduce((max, feature) => Math.max(max, feature.properties.distance), -Infinity)
		const minRouteLength = this.mapData.routes.features.reduce((min, feature) => Math.min(min, feature.properties.distance), Infinity)
		this.options.dom.routesData.querySelector('.route-length').innerHTML = `(${Math.round(minRouteLength*10)/10} - ${Math.round(maxRouteLength*10)/10} km)`

		// Set bounds of range slider
		const sliderMax = Math.ceil(maxRouteLength/5)*5
		this.options.dom.droneRangeSlider.setAttribute('max', sliderMax)
	}

	createLocationsList = () => {
		this.options.dom.locationsList.innerHTML = ""
		const locationsList = this.mapData.locations.features.map(location => ({name: location.properties.name, numRoutes: location.properties.numRoutes}))
		locationsList.sort((a,b) => a.numRoutes - b.numRoutes).reverse()
		locationsList.forEach(item => {
			this.options.dom.locationsList.insertAdjacentHTML('beforeend',`<div class="location" data-name="${item.name}"><span class="num">${item.numRoutes}</span> ${item.name}</div>`)
		})
	}

	// Add markers from geoJSON
	addMarkers = () => {

		// Add markers for all end locations
		for (const feature of this.mapData.locations.features) {
			// create a HTML element for each feature
			const el = document.createElement('div')
			el.className = 'marker'
			el.dataset.name = feature.properties.name
			el.dataset.routes = feature.properties.routes
			const newMarker = new mapboxgl.Marker(el).setLngLat(feature.geometry.coordinates).addTo(this.map)
			this.mapData.markers.push(newMarker)

			// Add marker hover
			const newElem = newMarker.getElement()
			newElem.addEventListener('mouseover', (e) => {
				newElem.classList.add('show-label')
			})
			newElem.addEventListener('mouseleave', (e) => {
				newElem.classList.remove('show-label')
			})
		}

		// Add markers for extra nodes we added
		for (const feature of this.mapData.routes.features) {

			// Do we have any intermediate points?
			if(feature.geometry.coordinates.length > 2){
				console.log(feature.geometry.coordinates)

				// Get just the intermediate points
				const interpoints = [...feature.geometry.coordinates]
				interpoints.shift()
				interpoints.pop()

				for (const point of interpoints) {
					// create a HTML element for each feature
					const el = document.createElement('div')
					el.className = 'marker-intermediate'
					el.dataset.routeID = feature.properties.id
					el.dataset.pointIndex = -1
					const newMarker = new mapboxgl.Marker(el,{draggable: true}).setLngLat(point).addTo(this.map)
					this.mapData.markers.push(newMarker)

					// Add marker hover
					const newElem = newMarker.getElement()
					newElem.addEventListener('mouseenter', () => {
						console.log('enter')
						this.isHoveringOnIntermediatePoint = true
						this.map.getCanvas().style.cursor = 'move'
					})
					newElem.addEventListener('mouseleave', () => {
						console.log('leave')
						this.isHoveringOnIntermediatePoint = false
						this.map.getCanvas().style.cursor = 'grab'
					})

					// When dragging begins, work out which of the nodes on the path behind it that this marker relates to
					newMarker.on('dragstart', () => {

						// Calculate which is the nearest intermediate point to this marker
						const points = turf.featureCollection(feature.geometry.coordinates.map(coord => turf.point(coord)));
						const nearestPoint = turf.nearestPoint(turf.point(newMarker.getLngLat().toArray()), points)

						// Save index of this point for use in a minute
						newMarker.getElement().dataset.pointIndex = points.features.findIndex(feature => 
							feature.geometry.coordinates[0] === nearestPoint.geometry.coordinates[0] &&
							feature.geometry.coordinates[1] === nearestPoint.geometry.coordinates[1]
						 )
					})

					// Whilst dragging, update the path behind too
					newMarker.on('drag', () => {
						feature.geometry.coordinates[newMarker.getElement().dataset.pointIndex] = newMarker.getLngLat().toArray()
						this.map.getSource('routes').setData(this.mapData.routes)
					})

					newMarker.on('click', (e) => {
						console.log(e)
					})
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
				this.setDroneRange(this.featureOptions.droneRange)
			}, 100)
		}
	}

	// **********************************************************
	// Sync functions
	// These keep the CSV and map display in sync

	// Take an updated CSV from the input box, and convert it to geoJSON and render
	// Expected format: source,lat,lng,destination,lat,lng,metadata1,metadata2,metadata3,etc..
	csvIsUpdated = (csv) => {

		// Trim incoming CSV
		csv = csv.trim()

		// Clear existing map content
		this.mapData.routes.features = []
		this.mapData.locations.features = []

		// Clear errors
		if(this.options.dom.lineNumbers.children.length > 0){
			this.options.dom.lineNumbers.querySelectorAll(`span`).forEach(span => span.classList.remove('has-error'))
		}
		this.options.dom.importWarning.classList.remove('show')
		this.options.dom.importWarning.querySelector('.num-rows').innerHTML = '0'

		// Convert to geoJSON
		let rowNum = 0
		for(let row of csv.split('\n')){
			rowNum++
			const parts = row.split(',')

			// Few basic data integrity checks
			if(parts.length < 6){
				this.addImportError(rowNum, 'Row too short', row)
				continue
			}
			if(isNaN(parts[1]) || isNaN(parts[2]) || isNaN(parts[4]) || isNaN(parts[5])){
				this.addImportError(rowNum, 'Coords not a number', row)
				continue
			}

			// Save coords
			const source_coords = [parseFloat(parts[2]), parseFloat(parts[1])]
			const destination_coords = [parseFloat(parts[5]), parseFloat(parts[4])]

			// 1. Generate a route for this line
			const distance = turf.distance(source_coords, destination_coords, {units: 'kilometers'})
			const newRoute = {
				type: "Feature",
				properties: {
					id: Math.random()*10000,
					source: parts[0],
					destination: parts[3],
					distance: distance
				},
				geometry: {
					type: 'LineString',
					coordinates: [
						source_coords,
						destination_coords,
					]
				}
			}
			for(let metadataCnt=0; metadataCnt<(parts.length-6); metadataCnt++){
				// TODO make this more intelligent, with an axis to roll out the places over time
				newRoute.properties[`meta${metadataCnt}`] = parts[6+metadataCnt]
			}
			this.mapData.routes.features.push(newRoute)

			// 2. Save the location if it is a unique location
			this.addLocation(parts[0], source_coords)
			this.addLocation(parts[3], destination_coords)

		}

		// Add the nodes as markers
		this.regenerateMap()
	}

	// Render a warning underneath that an error occurred
	addImportError = (rowNum, errorMessage, rowContents) => {
		this.options.dom.lineNumbers.querySelector(`:nth-child(${rowNum})`).classList.add('has-error')
		this.options.dom.lineNumbers.querySelector(`:nth-child(${rowNum})`).setAttribute('title', errorMessage)

		this.options.dom.importWarning.querySelector('.num-rows').innerHTML = parseInt(this.options.dom.importWarning.querySelector('.num-rows').innerHTML)+1
		this.options.dom.importWarning.classList.add('show')
		console.warn(rowNum, errorMessage, rowContents)
	}

	// Add a location to the list
	addLocation = (name, coords) => {
		const existingLocation = this.findObjectByProperty(this.mapData.locations.features, "properties.name", name)
		if(!existingLocation){
			this.mapData.locations.features.push({
				type: 'Feature',
				geometry: {
					type: 'Point',
					coordinates: coords
				},
				properties: {
					name: name,
					numRoutes: 1
					// TODO: Add a property called "earliest date" or something
				}
			})
		}else{
			existingLocation.properties.numRoutes++
		}
	}

	// **********************************************************
	// Drone range handling

	setDroneRange = (range) => {
		// Save the range
		this.featureOptions.droneRange = parseInt(range)

		// Clear all routes as being within drone range or not
		for(let feature of this.mapData.routes.features){
			this.map.setFeatureState(
				{source: 'routes', id: feature.properties.id},
				{withinDroneRange: false}
			)
		}
		// Filter routes by which ones are within range
		const validRoutes = this.map.querySourceFeatures('routes', {
			sourceLayer: 'routes',
			filter: [
				'all',
				['<', ['to-number', ['get', 'distance']], this.featureOptions.droneRange]
			]
		})
	
		// For each valid route, set the feature as being within range
		validRoutes.forEach((feature) => {
			this.map.setFeatureState(
				{source: 'routes', id: feature.id},
				{withinDroneRange: true}
			)
		})
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