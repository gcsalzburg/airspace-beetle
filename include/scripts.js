'use strict'

import Follower from './Follower.js'
import AirspaceBeetle from './AirspaceBeetle.js'

document.addEventListener("DOMContentLoaded", async () => {

	// **********************************************************
	// Create new Sentry object

	const	myNetwork = new AirspaceBeetle({

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
			locationsList: document.querySelector('.locations-list'),
			routesData: document.querySelector('.routes-data'),
			lineNumbers: document.querySelector('.line-numbers'),
			importWarning: document.querySelector('.import-warning'),
			droneRangeSlider: document.querySelector('.drone-range')
		},
		
		onReady: () => {
			// Load in initial CSV data
			const response = fetch('include/data.csv')
				.then(response => response.text())
				.catch(err => console.log(err))
			response.then(csv => {
				document.querySelector('textarea').innerHTML = csv
				generateLineNumbers(document.querySelector('textarea'))
				myNetwork.csvIsUpdated(csv)
			})
		}
	})


	// **********************************************************
	// Drone range slider

	const droneRangeValue = document.querySelector('.drone-range-wrapper .value')

	document.querySelector('.drone-range-wrapper input[type="range"]').addEventListener("input", (e) => {
		droneRangeValue.textContent = `${e.target.value} km`
		myNetwork.setDroneRange(e.target.value)
	})

	// **********************************************************
/*
	document.querySelector('.route-mode-wrapper select').addEventListener("input", (e) => {
		myNetwork.setRouteType(e.target.value)
	})

	document.querySelector('.type-colour-wrapper input').addEventListener("input", (e) => {
		document.body.dataset.showTypeColours = e.target.checked
	})
*/
	// **********************************************************
	// Handle code input textboxes

	document.querySelector('textarea').addEventListener("input", (e) => {
		const newCSV = e.target.value.replace(/\t/gi,',')
		e.target.value = newCSV // Substitute tabs for commas when pasting in, to help!

		generateLineNumbers(e.target)
		myNetwork.csvIsUpdated(newCSV)
	})

	// **********************************************************
	// Add line numbers for code block

	const generateLineNumbers = (textarea) => {
		const numberOfLines = textarea.value.split('\n').length
		document.querySelector('.line-numbers').innerHTML = Array(numberOfLines)
			.fill('<span></span>')
			.join('')
	}

	// **********************************************************
	// Handle buttons

	document.querySelectorAll('.options a, .code-container a').forEach(link => link.addEventListener('click', async (e) => {
		e.preventDefault()

		// Get the hash, to work out what sort of switch it is
		const url_target = link.href
		if(!url_target) return
		const hash = url_target.substring(url_target.indexOf('#') + 1)

		switch(hash){

			case 'toggle-width':
				document.body.classList.toggle('expand-config-container')
				break

			case 'imported-data':
				document.querySelector('textarea').focus()
				break
		}
	}))

	document.querySelector('textarea').addEventListener('focus', (e) => {
		document.querySelector('.code-container').classList.toggle('is-editing', true)
	});
	document.querySelector('textarea').addEventListener('blur', (e) => {
		document.querySelector('.code-container').classList.toggle('is-editing', false)
	});

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