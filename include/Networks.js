import Network from './Network.js'
import Routes from './Routes.js'

export default class{

	// Default options are below
	options = {
		listContainer: null,
		onListMouseLeave: () => {}
	}

	range = {
		max: 10,
		min: 0
	}

	networks = []

	constructor(options){

		this.options = {...this.options, ...options}
		this.map = this.options.map

		// ************
		// Create a routes layer, which is way more performant to do it in one place here
		this.routes = new Routes({
			map: this.map,
			color: 'pink', //this.color,
			layerName: 'routes',
			onRouteMouseOver: (networkName, sourceName, destinationName, length) => {
				this.networks.find(network => network.name == networkName).markers.showLabels([sourceName, destinationName])	// Add location label
				this.options.onRouteMouseOver(length)
			},
			onRouteMouseLeave: (networkName) => {
				this.networks.find(network => network.name == networkName).markers.showLabels()	// Clear location labels too
				this.options.onRouteMouseLeave()
			}
		})

		this.routes.init()

		// ************
		// Add hover effects to list of networks on side
		this.options.listContainer.addEventListener('mousemove', (e) => {
			const network = e.target.closest('.network')
			if(network && e.target.classList.contains('num')){
				if(network.classList.contains('isVisible')){
					this._temporaryShowOnly(network.dataset.name)
				}else{
					this._removeTemporaryShow()
				}
			}
		})
		this.options.listContainer.addEventListener('mouseleave', () => {
			this._removeTemporaryShow()
		})

		// ************
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
			}else if(e.target.classList.contains("show-all")){
				e.preventDefault()
				this._showAll()
				this.options.onChange()
			}else if(e.target.classList.contains("hide-all")){
				e.preventDefault()
				this._hideAll()
				this.options.onChange()
			}
		})
	}

	// **********************************************************	

	importGeoJSON = async (locations) => {

		// delete everything that was there before
		for(let network of this.networks){
			network.removeMarkers()
		}
		this.networks = []

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
					locations: locations.features.filter(item => item.properties.trust == location.properties.trust),
					onRouteMouseOver: (sourceName, destinationName, length) => {
						this.options.onRouteMouseOver(sourceName, destinationName, length)
					},
					onRouteMouseLeave: () => {
						this.options.onRouteMouseLeave()
					},
					onChange: async () => {
						await this.render()
						this.options.onChange()
					},


				})
				this.networks.push(newNetwork)
			}
		}

		await this.render()
	}

	render = async () => {
		// Render each network
		for(let network of this.networks){
			await network.rebuildRoutesAndMarkers()
		}
		await this.routes.drawRoutes({
			type: "FeatureCollection",
			features: this.networks.filter(network => network.isVisible).reduce((routesArray, network) => [...routesArray, ...(network.getRoutes())], [])
		})

		// Render the DOMList
		this._renderDOMList()
	}

	reRenderAfterStyleChange = async () => {
		// Re-render the routes, e.g. after a style change
		this.routes.init()
		await this.routes.drawRoutes({
			type: "FeatureCollection",
			features: this.networks.filter(network => network.isVisible).reduce((routesArray, network) => [...routesArray, ...(network.getRoutes())], [])
		})
		this.networks.forEach(network => {
			if(network.centroid){
				network.addCentroid(this.range.max)
			}
		})
	}

	// **********************************************************	
	// Getters

	getLocations = (filtered = false) => {
		let features
		if(filtered){
			features = this.networks.reduce((featuresArray, network) => [...featuresArray, ...(network.getLocations().filter(location => location.properties.isVisible && location.properties.isInclude))], [])
		}else{
			features = this.networks.reduce((featuresArray, network) => [...featuresArray, ...(network.getLocations())], [])	
		}
		return {
			type: "FeatureCollection",
			features: features			
		}
	}

	getRoutes = () => {
		const routes = this.networks.filter(network => network.isVisible).reduce((routesArray, network) => [...routesArray, ...(network.getRoutes())], [])	
		return {
			type: "FeatureCollection",
			features: routes			
		}
	}

	getRoutesInRange = () => {
		const routes = this.networks.filter(network => network.isVisible).reduce((routesArray, network) => [...routesArray, ...(network.getRoutesInRange(this.range.min, this.range.max))], [])	
		return {
			type: "FeatureCollection",
			features: routes			
		}
	}

	getTotals = () => {
		return {
			numRoutes: this.networks.filter(network => network.isVisible).reduce((sum, network) => sum + network.getRoutesInRange(this.range.min, this.range.max).length, 0),
			numLocations: this.getLocations(true).features.length,
			numNetworks: this.networks.filter(network => network.isVisible).length,
			maxRouteLength: this.networks.reduce((max, network) => Math.max(max, network.getRouteProperties().maxLength), 0)
		}
	}

	getNetworkColors = () => {
		return this.networks.reduce((networksArray, network) => [...networksArray, {name: network.name, color: network.color}], [])
	}

	// **********************************************************	
	// Setters

	// Drone range handling
	setDroneMaxRange = (range) => {
		this.range.max = range
		this.routes.setMaxRange(range)
		this.networks.forEach(network => network.updateCentroidRange(range))
		this._renderDOMList()
	}
	setDroneMinRange = (range) => {
		this.range.min = range
		this.routes.setMinRange(range)
		this._renderDOMList()
	}

	setRouteColor = (colorMode) => {
		this.routes.setColorMode(colorMode)
	}

	setMarkerColor = (colorMode) => {
		this.networks.forEach(network => network.setMarkerColor(colorMode))
	}

	toggleCentroids = (state) => {
		if(state){
			this.networks.filter(network => network.isVisible).forEach(network => network.addCentroid(this.range.max))
		}else{
			// Do it for all, so that we remove ones that might even be hidden
			this.networks.forEach(network => network.removeCentroid())
		}
	}

	setCentroidWeight = (locationType, value) => {
		this.networks.forEach(network => network.setCentroidWeight(locationType, value))
	}
	
	// **********************************************************
	// For hovering only

	_temporaryShowOnly = (networkName) => {		
		for(let network of this.networks.filter(network => network.isVisible)){
			network.markers.filterByNetwork(networkName)
			network.name == networkName ? network.showCentroid() : network.hideCentroid()
		}
		this.routes.filterByNetwork(networkName)
	}

	_removeTemporaryShow = () => {
		for(let network of this.networks.filter(network => network.isVisible)){
			network.markers.filterByNetwork()
			network.showCentroid()
		}
		this.routes.filterByNetwork()
	}

	// **********************************************************	
	// Clicking on list, to make change permanent

	_showHideNetwork = async (networkName, state) => {

		const network = this.networks.find(item => item.name == networkName)
		state ? network.show() : network.hide()

		await this.render()
	//	state ? this._temporaryShowOnly(networkName) : this._removeTemporaryShow()

		this._renderDOMList()
	}

	_showAll = async () => {
		this.networks.forEach(network => network.show())
		await this.render()
		this._renderDOMList()
	}

	_hideAll = async () => {
		this.networks.forEach(network => network.hide())
		await this.render()
		this._renderDOMList()
	}

	_showOnlyNetwork = async (networkName) => {

		// Adjust network states
		this.networks.filter(item => item.name != networkName).forEach(network => network.hide())
		this.networks.find(item => item.name == networkName).show()
		await this.render()
		this._renderDOMList()
	}

	// **********************************************************	
	// Displaying list on side

	_renderDOMList = () => {
		// Sort
		this._sortNetworksList()

		// Update the list
		this.options.listContainer.innerHTML = this.networks.reduce((html, network) => {
			const stats = network.getRouteProperties()
			const routesInRange = network.getRoutesInRange(this.range.min, this.range.max).length
			const networkHTML = `<div class="network ${network.isVisible ? 'isVisible' : ''}" data-name="${network.name}"><span class="num" style="background-color: ${network.color}">${routesInRange} / ${stats.totalRoutes}</span> ${network.name}</div>`
			return html + networkHTML
		}, '')

		// Add show and hide all buttons
		this.options.listContainer.insertAdjacentHTML('afterBegin', `<div class="show-hide-all-buttons"><a href="#" class="show-all">Show all</a> <a href="#" class="hide-all">Hide all</a></div>`)
	}

	_sortNetworksList = () => {
		// Sort list of items now
		this.networks.sort((a,b) => b.name.localeCompare(a.name))
		this.networks.sort((a,b) => a.getRoutesInRange(this.range.min, this.range.max).length - b.getRoutesInRange(this.range.min, this.range.max).length).reverse()
	}

	// **********************************************************	

}