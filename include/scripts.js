'use strict'

import Follower from './Follower.js'
import MapDesigner from './MapDesigner.js'

document.addEventListener("DOMContentLoaded", async () => {

	// **********************************************************
	// Create new Sentry object

	const	myNetwork = new MapDesigner({

		follower: new Follower({
			styles: {
				route: '#ffc03a'
			}
		}),

		mapbox_token: 'pk.eyJ1IjoiZ2NzYWx6YnVyZyIsImEiOiJjam1pNm5uZmcwMXNyM3FtNGp6dTY3MGxsIn0.PmLPkI3T8UxjEIPnz7fxEA',
		mapbox_style: 'mapbox://styles/annamitch/clsded3i901rg01qyc16p8dzw',

		dom: {
			mapbox: document.querySelector('.map'),
			codeCSV: document.querySelector('[data-code=csv]'),
			codeGeoJSON: document.querySelector('[data-code=geojson]'),
			typeColours: document.querySelector('.type-colours')
		}		
	})

	// **********************************************************
	// Handle selects,sliders,checkboxes etc

	const droneRangeValue = document.querySelector('.drone-range-wrapper .value')

	document.querySelector('.drone-range-wrapper input[type="range"]').addEventListener("input", (e) => {
		droneRangeValue.textContent = `${e.target.value} km`
		myNetwork.setDroneRange(e.target.value)
	})

	document.querySelector('.route-mode-wrapper select').addEventListener("input", (e) => {
		myNetwork.setRouteType(e.target.value)
	})

	document.querySelector('.type-colour-wrapper input').addEventListener("input", (e) => {
		document.body.dataset.showTypeColours = e.target.checked
	})

	// **********************************************************
	// Handle code input textboxes

	document.querySelector('[data-code=csv]').addEventListener("input", (e) => {
		const newCSV = e.target.value.replace(/\t/gi,',')
		e.target.value = newCSV // Substitute tabs for commas when pasting in, to help!
		myNetwork.csvIsUpdated(newCSV)
	})
	document.querySelector('[data-code=geojson]').addEventListener("input", (e) => {
		// TODO
	})

	// **********************************************************
	// Handle buttons

	document.querySelectorAll('.options a, .code-container a').forEach(link => link.addEventListener('click', async (e) => {
		e.preventDefault()

		// Get the hash, to work out what sort of switch it is
		const url_target = link.href
		if(!url_target) return
		const hash = url_target.substring(url_target.indexOf('#') + 1)

		switch(hash){

			case 'toggle-code-csv':
				document.querySelector('.code-container').dataset.selected = 'csv'
				document.querySelector('[data-code=csv]').focus()
				break

			case 'toggle-code-geojson':
				document.querySelector('.code-container').dataset.selected = 'geojson'
				document.querySelector('[data-code=geojson]').focus()
				break
		}
	}))

	const exportGeoJSON = (geojson) => {

		// Generate human readable JSON file with: https://futurestud.io/tutorials/node-js-human-readable-json-stringify-with-spaces-and-line-breaks 
		// Trigger download

		const helper_link = document.createElement('a')
		helper_link.href = `data:application/geo+json;charset=utf-8,${encodeURI(JSON.stringify(geojson, null, 2))}`
		helper_link.target = '_blank'
		helper_link.download = `routes-builder-${Math.round(Date.now()/1000)}.geojson`
		helper_link.click()
	}
})