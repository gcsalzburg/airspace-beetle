'use strict'

import DataImporter from './DataImporter.js'
import AirspaceBeetle from './AirspaceBeetle.js'
import Follower from './Follower.js'

import GeojsonToKml from './GeojsonToKml.js'

document.addEventListener("DOMContentLoaded", async () => {


	// **********************************************************
	// Create new Airspace Beetle object

	const csvImporter = new DataImporter({
		onNewDataReady: (newData) => {
			myBeetle.importNewLocations(newData)
			document.querySelector('.options-panel').dataset.option = 'view'
			localStorage.setItem('optionsView', 'view')
		},
		dom: {
			textarea: document.querySelector('.imported-csv'),
			lineNumbers: document.querySelector('.line-numbers'),
			importSuccess: document.querySelector('.import-success'),
			importWarning: document.querySelector('.import-warning')
		}
	})

	const	myBeetle = new AirspaceBeetle({

		follower: new Follower({
			styles: {
				route: '#232223'
			}
		}),

		mapbox_token: 'pk.eyJ1IjoiZ2NzYWx6YnVyZyIsImEiOiJjam1pNm5uZmcwMXNyM3FtNGp6dTY3MGxsIn0.PmLPkI3T8UxjEIPnz7fxEA',
		mapbox_style: 'apian',

		dom: {
			mapbox: document.querySelector('.map'),
			networksList: document.querySelector('.networks-list'),
			stats: {
				routes: document.querySelector('.num-routes'),
				locations: document.querySelector('.num-locations'),
				networks: document.querySelector('.num-networks'),
			},
			weightsSliders: document.querySelector('.weights-sliders'),
			filterSliders: document.querySelector('.filter-sliders'),
			colourSelectors: document.querySelector('.color-selectors')
		},
		
		onHasStorageData: () => {
			document.body.dataset.panel = 'map'
		}
	})

	// **********************************************************

	const switchView = (target) => {
		switch(target){

			case 'data':
				document.body.dataset.panel = 'data'
				break

			case 'map':
				document.body.dataset.panel = 'map'
				myBeetle.updateMapContainer()
				break
		}
	}

	// **********************************************************
	// Handle buttons

	document.querySelector('.chevron-divider').addEventListener('click', (e) => {
		document.querySelector('.map-options').classList.toggle('is-expanded')
		localStorage.setItem('optionsIsExpanded', document.querySelector('.map-options').classList.contains('is-expanded'))
	})
	if(localStorage.getItem('optionsIsExpanded')){
		document.querySelector('.map-options').classList.toggle('is-expanded', localStorage.getItem('optionsIsExpanded') == 'true')
	}

	//
	//

	document.querySelectorAll('.panel-nav a, .panel-data a, .map-styles a, .map-options a').forEach(link => link.addEventListener('click', async (e) => {
		e.preventDefault()

		// Get the hash, to work out what sort of switch it is
		const url_target = link.href
		if(!url_target) return
		const hash = url_target.substring(url_target.indexOf('#') + 1)

		switch(hash){

			case 'nav-data':
				switchView('data')
				break

			case 'nav-map':
				switchView('map')
				break

			case 'toggle-width':
				document.body.classList.toggle('expand-config-container')
				break

			case 'imported-data':
				document.querySelector('textarea').focus()
				break

			case 'export-geojson':
				exportGeoJSON(myBeetle.getGeojson())
				break

			case 'export-kml':
				const converter = new GeojsonToKml()
				const kmlString = converter.convert(myBeetle.getGeojson())

				const blob = new Blob([kmlString], { type: 'text/plain' })
				const url = URL.createObjectURL(blob)
				const a = document.createElement('a') 
				a.href = url
				a.download = `airspace-beetle-${Date.now()}.kml`
				a.click()
				URL.revokeObjectURL(url)
				break

			case 'add-centroids':
				myBeetle.toggleCentroids(true)
				break
			case 'remove-centroids':
				myBeetle.toggleCentroids(false)
				break

			case 'send-to-map':
				csvImporter.sendToMap()
				switchView('map')
				break		
				
			case 'empty-map':
				console.log('empty')
				myBeetle.empty()
				location.reload()
				break

			case 'map-style-apian':
				myBeetle.setMapStyle('apian')
				break

			case 'map-style-light':
				myBeetle.setMapStyle('light')
				break

			case 'map-style-dark':
				myBeetle.setMapStyle('dark')
				break

			case 'map-style-satellite':
				myBeetle.setMapStyle('satellite')
				break

			case 'options-view':
				document.querySelector('.options-panel').dataset.option = 'view'
				localStorage.setItem('optionsView', 'view')
				break
			case 'options-filter':
				document.querySelector('.options-panel').dataset.option = 'filter'
				localStorage.setItem('optionsView', 'filter')
				break

			case 'options-analyse':
				document.querySelector('.options-panel').dataset.option = 'analyse'
				localStorage.setItem('optionsView', 'analyse')
				break

			case 'options-edit':
				document.querySelector('.options-panel').dataset.option = 'edit'
				localStorage.setItem('optionsView', 'edit')
				break

			case 'options-export':
				document.querySelector('.options-panel').dataset.option = 'export'
				localStorage.setItem('optionsView', 'export')
				break
		}
	}))


	if(localStorage.getItem('optionsView')){
		document.querySelector('.options-panel').dataset.option = localStorage.getItem('optionsView')
	}

	const exportGeoJSON = (geojson) => {

		// Generate human readable JSON file with: https://futurestud.io/tutorials/node-js-human-readable-json-stringify-with-spaces-and-line-breaks 
		// Trigger download

		const helper_link = document.createElement('a')
		helper_link.href = `data:application/geo+json;charset=utf-8,${encodeURI(JSON.stringify(geojson, null, 2))}`
		helper_link.target = '_blank'
		helper_link.download = `airspace-beetle-${Math.round(Date.now()/1000)}.geojson`
		helper_link.click()
	}
})