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

	colorMode = 'network'

	currentNetworkFilter = null

	// **********************************************************
	// Constructor, to merge in options

	constructor(options){
		this.options = {...this.options, ...options}
	}

	init = () => {

		// Just in case we call this again (sometimes happen when changing base map style)
		if(this.options.map.getSource('routes')){
			this.options.map.removeLayer('routes')
			this.options.map.removeSource('routes')
		}

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
								[
									'case',
									['>=', ['to-number', ['get', 'pathDistance']], ['to-number', ['feature-state', 'droneMinRange']]],
										["match", ["get", "nodeType"], "Hospital", 1, [
											'case', ['boolean', ['feature-state', 'hover'], false], 1, 0.6
										]],
										0
									],
									0


						],
						0			
				]
			}
		})

		// We have to call this to preserve the change when changing background map styles
		this.setColorMode()

		// Add hover effects to routes
		this.options.map.on('mousemove', 'routes', (e) => {
			if (e.features.length > 0) {
				this._highlightRoute(e.features[0])
			}
		})
		this.options.map.on('mouseleave', 'routes', () => {
			// Clear the route highlighting effect
			this._highlightRoute()
		})
	}

	// **********************************************************

	getRoutes = () => {
		return this.routes.features.filter(route => (route.properties.pathDistance <= this.range.max && route.properties.pathDistance >= this.range.min))
	}

	getRouteProperties = () => {
		return {
			total: 			this.routes.features.length,
			totalInRange:	this.routes.features.filter(feature => feature.properties.pathDistance <= this.range.max && feature.properties.pathDistance >= this.range.min).length,
			minLength: 		this.routes.features.reduce((min, feature) => Math.min(min, feature.properties.pathDistance), Infinity),
			maxLength: 		this.routes.features.reduce((max, feature) => Math.max(max, feature.properties.pathDistance), -Infinity)
		}
	}


	// **********************************************************

	empty = () => {
		this.routes.features = []
	}

	rebuildFromLocations = async (locations, colors) => {

		this.empty()

		// Iterate over, find hubs and draw lines from there
		for (const hubLocation of locations) {
			if(hubLocation.properties.isHub && hubLocation.properties.isVisible){
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

		await this.drawRoutes()
	}

	drawRoutes = async () => {

		// Reapply the new routes
		this.options.map.getSource('routes').setData(this.routes)

		await new Promise(resolve => {
			const checkData = (e) => {
				// Via: https://gis.stackexchange.com/a/282140
				if (e.sourceId === 'routes' && e.isSourceLoaded && e.sourceDataType !== 'metadata'){
					this.setMaxRange(this.range.max)
					this.setMinRange(this.range.min)
					this.options.map.off('sourcedata', checkData)
					resolve()
				}
			}
			this.options.map.on('sourcedata', checkData)
	  })
		return true
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
			this.currentNetworkFilter = null
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

		this.currentNetworkFilter = network
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

		if(this.colorMode == 'length'){
			this.setColorMode()
		}
	}

	setMinRange = (range) => {

		// Save it for later
		this.range.min = range

		for(let feature of this.routes.features){
			this.options.map.setFeatureState(
				{source: 'routes', id: feature.properties.id},
				{droneMinRange: range}
			)
		}

	}

	// **********************************************************
	// Toggle the colour mode

	setColorMode = (newColorMode = this.colorMode) => {

		this.colorMode = newColorMode
		let paintProperty = ''

		switch(newColorMode){
			case 'network':
				paintProperty = ['get', 'color']
				break
			case 'length':
				paintProperty = [
					'interpolate-hcl',
						['exponential', 1.5],
						['get', 'pathDistance'],
						this.range.min, '#00ff00',   // Red
						this.range.max, '#ff0000'  // Green
				]
				break
			case 'blue':
				paintProperty = '#005EB8'
				break
			case 'ghost':
				paintProperty = 'rgba(255,255,255,0.3)'
				break
			case 'none':
				paintProperty = 'rgba(255,255,255,0)'
				break
			case 'yellow':
			default:
				paintProperty = '#ffc03a'
				break
		}

		this.options.map.setPaintProperty('routes', 'line-color', paintProperty)
	}

	// **********************************************************

	_highlightRoute = (feature = null) => {


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

			// Don't do anything if this is not a filtered network
			if(this.currentNetworkFilter && (feature.properties.trust != this.currentNetworkFilter)){
				return
			}

			// Apply feature state to the correct route
			// Only do the hover if we are within the droneRange or not
			// TODO: Make this filtering more generic
			if(feature.properties.pathDistance <= this.range.max && feature.properties.pathDistance >= this.range.min){
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