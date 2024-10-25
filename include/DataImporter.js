export default class{

	locationsArray = []

	// Default options are below
	options = {
	}

	// **********************************************************
	// Constructor, to merge in options

	constructor(options){

		// Merge opts
		this.options = {...this.options, ...options}

		// Add handler

		this.options.dom.textarea.addEventListener("input", (e) => {
			const newCSV = e.target.value.replace(/\t/gi,',')
			e.target.value = newCSV // Substitute tabs for commas when pasting in, to help!

			// Update line numbers
			this._generateLineNumbers(e.target)

			// Save changes to localStorage
			localStorage.setItem("importedData", newCSV)

			// Update network
			this._processData(newCSV)
		})

		this.initialLoad()
	}

	initialLoad = async () => {

		const savedData = localStorage.getItem("importedData")

		if(savedData){

			this.options.dom.textarea.value = savedData
			this._generateLineNumbers(this.options.dom.textarea)
			this._processData(savedData)

		}else{

			// Load in initial CSV data
			// Probably first time around

			const response = fetch('include/data.csv')
				.then(response => response.text())
				.catch(err => console.log(err))
			response.then(csv => {
				this.options.dom.textarea.innerHTML = csv
				this._generateLineNumbers(this.options.dom.textarea)
				this._processData(csv)
			})
		}
	}

	sendToMap = () => {
		this.options.onNewDataReady(this.locationsArray)
	}

	// **********************************************************
	// Add line numbers for code block

	_generateLineNumbers = (textarea) => {
		const numberOfLines = textarea.value.split('\n').length
		document.querySelector('.line-numbers').innerHTML = Array(numberOfLines)
			.fill('<span></span>')
			.join('')
	}

	// **********************************************************
	// Process input
	// Expected format: Site name,Latitude,Longitude,Type,Trust,Is hub?

	// TODO add check here duplicate name and/or duplicate lat/lng

	_processData = (csv) => {

		if(!csv || csv.length <= 0){
			return false
		}

		// Trim incoming CSV
		csv = csv.trim()

		// Clear errors
		if(this.options.dom.lineNumbers.children.length > 0){
			this.options.dom.lineNumbers.querySelectorAll(`span`).forEach(span => span.classList.remove('has-error'))
		}
		this.options.dom.importSuccess.classList.remove('show')
		this.options.dom.importWarning.classList.remove('show')
		this.options.dom.importWarning.querySelector('.warning-details').innerHTML = ''
		this.options.dom.importWarning.querySelector('.num-rows').innerHTML = '0'

		this.locationsArray = []

		// Convert to geoJSON
		let rowNum = 0
		let rowSuccessCount = 0
		for(let row of csv.split('\n')){

			rowNum++
			const parts = row.split(',')

			// Few basic data integrity checks
			if(parts.length < 3){
				this._addImportError(rowNum, 'Row too short', row)
				continue
			}
			if(isNaN(parts[1]) || isNaN(parts[2])){
				this._addImportError(rowNum, `Lat/lng coords don't seem to be number`, row)
				continue
			}else if(parts[1].length == 0 || parts[2].length == 0){
				this._addImportError(rowNum, `Lat/lng coords missing`, row)
				continue
			}

			// Save coords
			const location_coords = [parseFloat(parts[2]), parseFloat(parts[1])]
			const isHub = (parts[5]=='y')

			this.locationsArray.push({
				name: parts[0],
				coordinates: location_coords,
				type: parts[3],
				trust: parts[4],
				isHub: isHub
			})

			rowSuccessCount++
		}

		if(rowSuccessCount > 0){
			this.options.dom.importSuccess.querySelector('.num-rows').innerHTML = rowSuccessCount
			this.options.dom.importSuccess.classList.add('show')
		}

		return rowSuccessCount

	}

	// Render a warning underneath that an error occurred
	_addImportError = (rowNum, errorMessage, rowContents) => {
		this.options.dom.lineNumbers.querySelector(`:nth-child(${rowNum})`).classList.add('has-error')
		this.options.dom.lineNumbers.querySelector(`:nth-child(${rowNum})`).setAttribute('title', errorMessage)

		this.options.dom.importWarning.querySelector('.num-rows').innerHTML = parseInt(this.options.dom.importWarning.querySelector('.num-rows').innerHTML)+1
		this.options.dom.importWarning.classList.add('show')

		this.options.dom.importWarning.querySelector('.warning-details').insertAdjacentHTML('beforeend', `<li>Row ${rowNum}: ${errorMessage}<br><i>${rowContents}</i>`)
	}

}