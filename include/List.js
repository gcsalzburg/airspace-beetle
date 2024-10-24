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

	add = (name) => {
		if(!this.list.find(item => item.name == name)){
			this.list.push({
				name: name,
				count: 1,
				color: `hsl(${this.list.length*39}, 72%, 53%)`
			})
		}
		this.sort()
	}

	get = () => {
		return this.list
	}

	updateCounts = (data) => {
		for(let item of this.list){
			if(data[item.name]){
				item.count = data[item.name]
			}
		}
		this.sort()
	}

	sort = () => {
		// Sort list of items now
		this.list.sort((a,b) => b.name.localeCompare(a.name))
		this.list.sort((a,b) => a.count - b.count).reverse()
	}

	renderDOMList = () => {
		if(this.options.listContainer){
			 // Update the list
			 this.options.listContainer.innerHTML = this.list.reduce((html, item) => {
				const itemHTML = `<div class="item" data-name="${item.name}">${item.name} (${item.count})</div>`
				return html + itemHTML
			 }, '')
		}
	}
}