export default class{

	// Default options are below
	options = {
	}

	routes =  {
		type: "FeatureCollection",
		features: []	
	}

	hoveredRoute = null

	range = {
		max: 10,
		min: 0
	}

	hasLoadedDataAfterRebuild = false

	// **********************************************************
	// Constructor, to merge in options

	constructor(options){
		this.options = {...this.options, ...options}
	}

	init = () => {

		// Add the routes source and layer to the map
		this.options.map.addSource('routes', {type: 'geojson', data: this.routes, 'promoteId': "id"})
		this.options.map.addLayer({
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

		// Add hover effects to routes
		this.options.map.on('mousemove', 'routes', (e) => {
			if (e.features.length > 0) {
				this.highlightRoute(e.features[0])
			}
		})
		this.options.map.on('mouseleave', 'routes', () => {
			// Clear the route highlighting effect
			this.highlightRoute()
		})
	}

	// **********************************************************

	getRoutes = () => {
		return this.routes
	}

	getRouteProperties = () => {
		return {
			total: 		this.routes.features.length,
			minLength: 	this.routes.features.reduce((min, feature) => Math.min(min, feature.properties.pathDistance), Infinity),
			maxLength: 	this.routes.features.reduce((max, feature) => Math.max(max, feature.properties.pathDistance), -Infinity)
		}
	}


	// **********************************************************

	empty = () => {
		this.routes.features = []
	}

	rebuildFromLocations = (locations, colors) => {

		this.empty()

		// Iterate over, find hubs and draw lines from there
		for (const hubLocation of locations) {
			if(hubLocation.properties.isHub){
				// Only build routes to/from the hubs
				const trust = hubLocation.properties.trust
				const hubCoords = hubLocation.geometry.coordinates

				const nodes = locations.filter(location => location.properties.trust == trust && location.properties.isInclude)

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
							color: 			colors.find(t => t.name == trust).color
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

		this.drawRoutes()
	}

	drawRoutes = () => {

		this.hasLoadedDataAfterRebuild = false

		// Reapply the new routes
		this.options.map.on('data', (e) => {
			if (e.sourceId === 'routes' && !this.hasLoadedDataAfterRebuild) {
				this.setMaxRange(this.range.max)
				this.hasLoadedDataAfterRebuild = true
			}

		})
		this.options.map.getSource('routes').setData(this.routes)
	}

	// **********************************************************

	filterByNetwork = (network = null) => {

		// Do not set network to just show them all
		if(!network){
			for(let feature of this.routes.features){
				this.options.map.setFeatureState(
					{source: 'routes', id: feature.properties.id},
					{showThisNetwork: true}
				)
			}
			return
		}
		
		// Set all routes to false
		for(let feature of this.routes.features){
			this.options.map.setFeatureState(
				{source: 'routes', id: feature.properties.id},
				{showThisNetwork: false}
			)
		}
		// Filter routes by which ones are within range
		const validRoutes = this.options.map.querySourceFeatures('routes', {
			sourceLayer: 'routes',
			filter: ['==', 'trust', network]
		})

		// For each valid route, set the feature as being within range
		validRoutes.forEach((feature) => {
			this.options.map.setFeatureState(
				{source: 'routes', id: feature.id},
				{showThisNetwork: true}
			)
		})
	}

	setMaxRange = (range) => {

		// Save it for later
		this.range.max = range
		
		for(let feature of this.routes.features){
			this.options.map.setFeatureState(
				{source: 'routes', id: feature.properties.id},
				{droneRange: range}
			)
		}
	}

	// **********************************************************

	highlightRoute = (feature = null) => {

		// Clear highligthing
		if(!feature){
			if (this.hoveredRoute !== null) {
				this.options.map.setFeatureState(
					{source: 'routes', id: this.hoveredRoute},
					{hover: false}
				)
				this.hoveredRoute = null
			}
			this.options.onClearHighlight()

		}else{
			// Apply feature state to the correct route
			// Only do the hover if we are within the droneRange or not
			// TODO: Make this filtering more generic
			if(feature.properties.pathDistance < this.range.max){

				// Unhighlight current hovered one
				if (this.hoveredRoute !== null) {
					this.options.map.setFeatureState(
						{source: 'routes', id: this.hoveredRoute},
						{hover: false}
					)
				}

				// Highlight new one
				this.hoveredRoute = feature.id
				this.options.map.setFeatureState(
					{source: 'routes', id: feature.id},
					{hover: true}
				)

				this.options.onHighlightRoute(feature.properties.source, feature.properties.destination, feature.properties.pathDistance)
			}
		}
	}
}