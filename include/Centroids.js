import Centroid from './Centroid.js'

export default class{

	// Default options are below
	options = {
	}

	centroids = []

	// **********************************************************
	// Constructor, to merge in options

	constructor(options){
		this.options = {...this.options, ...options}
	}


	create = (locations, networks, range) => {
		// TODO: And make it possible to delete them when loading new CSV data too!

		// TODO: Only send it visible networks
		console.log(networks)
		for(let trust of networks){
			const hubLocation = locations.find(location => location.properties.isHub && location.properties.trust == trust.name)
			
			const centroid = new Centroid({
				map: this.options.map,
				trust: trust.name,
				color: trust.color,
				locations: locations.filter(location => location.properties.trust == trust.name),
				weights: [],
				hub: hubLocation.geometry.coordinates,
				droneRange: range,
				show: true
			})

			this.centroids.push(centroid)
		}
	}

	empty = () => {
		for(let centroid of this.centroids){
			centroid.remove()
		}
		this.centroids = []
	}

	// **********************************************************

	setWeights = (locations, type, weight) => {
		for(let location of this.mapData.locations.features){
			if(location.properties.type == type){
				location.properties.centroidWeight = weight
			}
		}

		this.setCentroidLocations()
	}

	updateLocations = (locations) => {
		for(let centroid of this.centroids){
			centroid.setLocations(locations.filter(location => location.properties.trust == centroid.getTrust() && location.properties.isInclude))
		}
	}

	updateRange = (range) => {
		for(let centroid of this.centroids){
			centroid.setDroneRange(range)
		}
	}

	toggle = (isShow = false) => {
		for(let centroid of this.centroids){
			isShow ? centroid.show() : centroid.hide()
		}
		console.log(isShow)
	}
}