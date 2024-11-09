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
		this.layerName = `${this.options.layerName}-routes`
	}

	init = () => {

		// Just in case we call this again (sometimes happen when changing base map style)
		if(this.options.map.getSource(this.layerName)){
			this.options.map.removeLayer(this.layerName)
			this.options.map.removeSource(this.layerName)
		}

		// Add the routes source and layer to the map
		this.options.map.addSource(this.layerName, {type: 'geojson', data: this.routes, 'promoteId': "id"})
		this.options.map.addLayer({
			'id': this.layerName,
			'type': 'line',
			'source': this.layerName,
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
							['<=', ['to-number', ['get', 'pathDistance']], ['to-number', ['feature-state', 'droneMaxRange']]],
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
		this.options.map.on('mousemove', this.layerName, (e) => {
			if (e.features.length > 0) {
				this._highlightRoute(e.features[0])
			}
		})
		this.options.map.on('mouseleave', this.layerName, () => {
			// Clear the route highlighting effect
			this._highlightRoute()
		})
	}


	// **********************************************************

	drawRoutes = async (routeData) => {

		this.routes = routeData

		// Reapply the new routes
		this.options.map.getSource(this.layerName).setData(routeData)

		await new Promise(resolve => {
			const checkData = (e) => {
				// Via: https://gis.stackexchange.com/a/282140
				if (e.sourceId === this.layerName && e.isSourceLoaded && e.sourceDataType !== 'metadata'){
					this.setMaxRange(this.range.max)
					this.setMinRange(this.range.min)
					this.setColorMode(this.colorMode)
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
					{source: this.layerName, id: feature.properties.id},
					{showThisNetwork: true}
				)
			}
			this.currentNetworkFilter = null
			return
		}
		
		// Set all routes to false
		for(let feature of this.routes.features){
			this.options.map.setFeatureState(
				{source: this.layerName, id: feature.properties.id},
				{showThisNetwork: false}
			)
		}
		// Filter routes by which ones are within range
		const validRoutes = this.options.map.querySourceFeatures(this.layerName, {
			sourceLayer: this.layerName,
			filter: ['==', 'trust', network]
		})

		// For each valid route, set the feature as being within range
		validRoutes.forEach((feature) => {
			this.options.map.setFeatureState(
				{source: this.layerName, id: feature.id},
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
				{source: this.layerName, id: feature.properties.id},
				{droneMaxRange: range}
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
				{source: this.layerName, id: feature.properties.id},
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
		if(this.options.map.getSource(this.layerName)){
			this.options.map.setPaintProperty(this.layerName, 'line-color', paintProperty)
		}
	}

	// **********************************************************

	_highlightRoute = (feature = null) => {


		// Clear highlighting
		if(!feature){
			if (this.hoveredRoute !== null) {
				this.options.onRouteMouseLeave(this.hoveredRoute.properties.trust)
				this.options.map.setFeatureState(
					{source: this.layerName, id: this.hoveredRoute.id},
					{hover: false}
				)
				this.hoveredRoute = null
			}
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
						{source: this.layerName, id: this.hoveredRoute.id},
						{hover: false}
					)
				}

				// Highlight new one
				this.hoveredRoute = feature
				this.options.map.setFeatureState(
					{source: this.layerName, id: feature.id},
					{hover: true}
				)

				this.options.onRouteMouseOver(feature.properties.trust, feature.properties.source, feature.properties.destination, feature.properties.pathDistance)
			}
		}
	}
}