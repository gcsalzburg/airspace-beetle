import Network from './Network.js'

export default class{

	// Default options are below
	options = {
		listContainer: null,
		onListMouseLeave: () => {}
	}

	networks = []

	constructor(options){

		this.options = {...this.options, ...options}
		this.map = this.options.map

			/*	
				onToggleNetworks: async (networkNames, isVisible) => {
					this.toggleLocationVisibility(networkNames, isVisible)
					await this.routes.rebuildFromLocations(this.mapData.locations.features, this.networks.get())
					// TODO: Add/delete centroid for this network here
				}*/




		// Add hover effects to list of networks on side
		this.options.listContainer.addEventListener('mousemove', (e) => {
			const network = e.target.closest('.network')
			if(network){
				if(network.classList.contains('isVisible')){
					this._showOnly(network.dataset.name)
				}else{
					this._removeShowOnly()
				}
			}
		})
		this.options.listContainer.addEventListener('mouseleave', (e) => {
			this._removeShowOnly()
		})

		// Add click effects to list of networks on the side
		this.options.listContainer.addEventListener('click', (e) => {
			e.preventDefault()
			const network = e.target.closest('.network')

			if(network){
				if(e.shiftKey){
					// Hold down shift to show only this network
					this._showOnlyNetwork(network.dataset.name)
					this.options.onChange()
				}else{
					// Otherwise just toggle the network visibility
					this._showHideNetwork(network.dataset.name, !network.classList.contains('isVisible'))
					this.options.onChange()
				}
			}
		})

	}

	// TODO: Merge the two functions below into one

	importCSVLocations = (locations) => {

		// delete everything that was there before
		this._deleteAll()

		// Load new data
		for(let location of locations){
			if(!this.networks.map(network => network.name).includes(location.trust)){
				// Must be a new network, so use this location as the basis to build the network
				// Find all the locations for this network
				const newNetwork = new Network({
					map: this.map,
					name: location.trust,
					isVisible: true,
					color: `hsl(${(this.networks.length*39)%360}, 82%, 43%)`,
					locations: locations.filter(item => item.trust == location.trust),
					onRouteMouseOver: (sourceName, destinationName, length) => {
						this.options.onRouteMouseOver(sourceName, destinationName, length)
					},
					onRouteMouseLeave: () => {
						this.options.onRouteMouseLeave()
					},
					onChange: () => {
						this.options.onChange()
					}

				})
				this.networks.push(newNetwork)
			}
		}
	}

	importGeoJSONLocations = (locations) => {

		console.log('loading from geojson')

		// delete everything that was there before
		this._deleteAll()

		// Load new data
		for(let location of locations.features){
			if(!this.networks.map(network => network.name).includes(location.properties.trust)){
				// Must be a new network, so use this location as the basis to build the network
				// Find all the locations for this network
				const newNetwork = new Network({
					map: this.map,
					name: location.properties.trust,
					isVisible: location.properties.isVisible,
					color: `hsl(${(this.networks.length*39)%360}, 82%, 43%)`,
					locations: locations.features.filter(item => item.properties.trust == location.properties.trust).map(item => ({
						name: item.properties.name,
						coordinates: item.geometry.coordinates,
						type: item.properties.type,
						trust: item.properties.trust,
						isHub: item.properties.isHub
					})),
					onRouteMouseOver: (sourceName, destinationName, length) => {
						this.options.onRouteMouseOver(sourceName, destinationName, length)
					},
					onRouteMouseLeave: () => {
						this.options.onRouteMouseLeave()
					},
					onChange: () => {
						this.options.onChange()
					}

				})
				this.networks.push(newNetwork)
			}
		}

	}

	render = async () => {
		// Render each network
		for(let network of this.networks){
			await network.render()
		}

		// Render the DOMList
		this._renderDOMList()
	}

	reloadRoutes = async () => {
		// Render each network
		for(let network of this.networks){
			await network.reloadRoutes()
		}
	}

	// **********************************************************	
	// Getters

	getLocations = () => {
		return {
			type: "FeatureCollection",
			features: this.networks.reduce((featuresArray, network) => [...featuresArray, ...(network.locations.features)], [])				
		}
	}

	getTotals = () => {
		return {
			numRoutes: this.networks.reduce((sum, network) => sum + network.routes.getVisibleCount(), 0),
			numLocations: this.getLocations().features.length,
			numNetworks: this.networks.length,
			maxRouteLength: this.networks.reduce((max, network) => Math.max(max, network.routes.getRouteProperties().maxLength), 0)
		}
	}

	// **********************************************************	
	// Setters

	// Drone range handling
	setDroneMaxRange = (range) => {
		// Save the range
		for(let network of this.networks){
			// TODO: Remove use of network.routes and make routes a private _routes inside network class
			network.routes.setMaxRange(range)
		}
	}
	setDroneMinRange = (range) => {
		// Save the range
		for(let network of this.networks){
			network.routes.setMinRange(range)
		}
	}

	setRouteColor = (colorMode) => {
		for(let network of this.networks){
			network.setRouteColor(colorMode)
		}
	}

	setMarkerColor = (colorMode) => {
		for(let network of this.networks){
			network.setMarkerColor(colorMode)
		}
	}
	
	// **********************************************************	

	// delete everything that was there before
	_deleteAll = () => {
		for(let network of this.networks){
			network.empty()
		}
		this.networks = []
	}

	_showOnly = (networkName) => {
		// TODO make this way more efficient
		// can just turn the whole thing on or off
		for(let network of this.networks){
			network.markers.filterByNetwork(networkName)
			network.routes.filterByNetwork(networkName)
		}

	}

	_removeShowOnly = () => {
		// TODO make this way more efficient
		for(let network of this.networks){
			network.markers.filterByNetwork()
			network.routes.filterByNetwork()
		}
	}

	_renderDOMList = () => {
		if(this.options.listContainer){
			// Update the list
			this.options.listContainer.innerHTML = this.networks.reduce((html, network) => {
				const stats = network.getStats()
				const networkHTML = `<div class="network ${network.isVisible ? 'isVisible' : ''}" data-name="${network.name}"><span class="num" style="background-color: ${network.color}">${stats.totalIncludedInRange} / ${stats.totalRoutes}</span> ${network.name}</div>`
				return html + networkHTML
			}, '')

			// Add show and hide all buttons
			this.options.listContainer.insertAdjacentHTML('afterBegin', `<div class="show-hide-all-buttons"><a href="#show-all">Show all</a> <a href="#hide-all">Hide all</a></div>`)
			this.options.listContainer.querySelector('a[href="#show-all"]').addEventListener('mousemove', () => {
				this._removeShowOnly()
			})
			this.options.listContainer.querySelector('a[href="#hide-all"]').addEventListener('mousemove', () => {
				this._removeShowOnly()
			})
			this.options.listContainer.querySelector('a[href="#show-all"]').addEventListener('click', (e) => {
				e.preventDefault()
				this._showAll()
			})
			this.options.listContainer.querySelector('a[href="#hide-all"]').addEventListener('click', (e) => {
				e.preventDefault()
				this._hideAll()
			})
		}
	}


	_showHideNetwork = async (networkName, state) => {

		const network = this.networks.find(item => item.name == networkName)

		if(state){
			await network.show()
			this._showOnly(networkName)
		}else{
			network.hide()
			this._removeShowOnly()
		}

		this._toggleInList(networkName, state)

	}

	_showOnlyNetwork = async (networkName) => {

		// Adjust network states
		for(let network of this.networks.filter(item => item.name != networkName)){
			network.hide()
		}
		this.networks.find(item => item.name == networkName).show()

		// Adjust in list
		document.querySelectorAll(`.network:not([data-name="${networkName}"])`).forEach(networkElm => {
			networkElm.classList.remove('isVisible')
		})
		document.querySelector(`.network[data-name="${networkName}"]`).classList.add('isVisible')
	}

	// TODO: No need for this in future
	_toggleInList = (networkName, isVisible) => {
		document.querySelector(`.network[data-name="${networkName}"]`).classList.toggle('isVisible', isVisible)
	}






	/*


	onHubChange: (oldHub, newHub) => {

				// Update geoJSON
			Utils.findObjectByProperty(this.mapData.locations.features, "properties.name", oldHub).properties.isHub  = false
			Utils.findObjectByProperty(this.mapData.locations.features, "properties.name", newHub).properties.isHub  = true	
			
			this.regenerateMap({centroids: false})
		//	this.centroids.updateLocations(this.mapData.locations.features)
		},
		onToggleInclude: (locationName, isInclude) => {

			// Update geoJSON
			Utils.findObjectByProperty(this.mapData.locations.features, "properties.name", locationName).properties.isInclude = isInclude

			this.regenerateMap({centroids: false})
		//	this.centroids.updateLocations(this.mapData.locations.features.filter(location => location.properties.isVisible))
		}
*/
}