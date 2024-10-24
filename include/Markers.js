export default class{

	// Default options are below
	options = {
		listContainer: null
	}

	list = []

	// **********************************************************
	// Constructor, to merge in options

	constructor(options){
		this.options = {...this.options, ...options}
	}

	removeFromMap = () => {
		// Clear old markers
		for(let marker of this.list){
			marker.remove()
		}
	}

	addToMap = (locations, networks) => {

		// Add markers for all end locations
		for (const feature of locations) {
			// create a HTML element for each feature
			const el = document.createElement('div')
			el.insertAdjacentHTML('beforeend',`<div class="label"><span class="line1">${feature.properties.name}</span><span class="line2">${feature.properties.type}</span></div>`)
			el.className = 'marker'
			el.dataset.name = `${feature.properties.name}`
			el.dataset.type = feature.properties.type
			el.dataset.trust = feature.properties.trust

			const color = networks.find(network => network.name == feature.properties.trust).color
			el.style = `--tooltip-background-color: ${color}`
			el.style.background = color
			if(feature.properties.isHub){
				el.classList.add('is_hub')
			}
			const newMarker = new mapboxgl.Marker(el).setLngLat(feature.geometry.coordinates).addTo(this.options.map)
			this.list.push(newMarker)

			// Add marker interactions
			el.addEventListener('mouseover', () => {
					document.querySelectorAll('.marker').forEach(marker => marker.classList.remove('show-label'))
					document.querySelector(`.marker[data-name="${feature.properties.name}"]`).classList.add('show-label')
			})
			el.addEventListener('mouseleave', () => {
				document.querySelectorAll('.marker').forEach(marker => marker.classList.remove('show-label'))
			})
			el.addEventListener('click', (e) => {
				if(!feature.properties.isHub){
					if(e.shiftKey){
						// Turning into the hub!
						const currentHub = locations.find(location => location.properties.trust == feature.properties.trust && location.properties.isHub)
						currentHub.properties.isHub = false
						feature.properties.isHub = true
						this.options.onHubChange(currentHub.properties.name, feature.properties.name)
					}else{
						// Toggling to exclude it
						feature.properties.exclude = !feature.properties.exclude
						el.classList.toggle('isExclude', feature.properties.exclude)
						this.options.onToggleExclude(feature.properties.name, feature.properties.exclude)
					}
				}
			})
		}
	}

	// Helper to show/hide location labels
	showLabels = (labels = null) => {
		document.querySelectorAll('.marker').forEach(marker => marker.classList.remove('show-label'))

		if(Array.isArray(labels)){
			for(let label of labels){
				document.querySelector(`.marker[data-name="${label}"]`).classList.add('show-label')
			}
		}else if(labels !== null){
			document.querySelector(`.marker[data-name="${labels}"]`).classList.add('show-label')
		}
	}


/*
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
*/
/*
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

						onDragStart: () => {
							waynode.setPointIndex(feature.geometry.coordinates)
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
							this.highlightRoute()
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
			*/
}