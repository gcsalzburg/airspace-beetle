import List from './List.js'
import * as Utils from './Utils.js'

export default class extends List{

	isIsolated = false

	constructor(options){

		super(options)

		if(this.options.listContainer){

			// Add hover effects to list of networks on side
			this.options.listContainer.addEventListener('mousemove', (e) => {
				const network = e.target.closest('.network')
				if(network && !this.isIsolated){
					if(network.classList.contains('isVisible')){
						this.options.onListMouseMove(network.dataset.name)
					}else{
						this.options.onListMouseLeave()
					}
				}
			})
			this.options.listContainer.addEventListener('click', (e) => {
				e.preventDefault()
				const network = e.target.closest('.network')

				if(network){
					if(e.shiftKey && network.classList.contains('isVisible')){
						const isIsolated = this.isolate(network.dataset.name)
						this.options.onIsolate(network.dataset.name, isIsolated)
					}else if(!this.isIsolated){
						this.toggleVisibility(network.dataset.name, !network.classList.contains('isVisible'))
					}
				}
			})
			this.options.listContainer.addEventListener('mouseleave', (e) => {
				if(!this.isIsolated){
					this.options.onListMouseLeave()
				}
			})
		}
	}

	renderDOMList = () => {
		if(this.options.listContainer){
			 // Update the list
			 this.options.listContainer.innerHTML = this.list.reduce((html, item) => {
				const itemHTML = `<div class="network isVisible ${item.name == this.isIsolated ? 'isIsolated' : ''}" data-name="${item.name}"><span class="num" style="background-color: ${item.color}">${item.count} / ${item.total}</span> ${item.name}</div>`
				return html + itemHTML
			 }, '')
		}
	}

	toggleInList = (networkName, isVisible) => {
		document.querySelector(`.network[data-name="${networkName}"]`).classList.toggle('isVisible', isVisible)
	}

	updateCounts = (dataCounts, dataTotals) => {
		for(let item of this.list){
			if(dataCounts[item.name]){
				item.count = dataCounts[item.name]
				item.total = dataTotals[item.name]
			}
		}
		this.sort()
	}

	toggleVisibility = (networkName = null, state = false) => {
		if(!networkName){
			return
		}

		const networkItem = document.querySelector(`.network[data-name="${networkName}"]`)

		networkItem.classList.toggle('isVisible', state)
		Utils.findObjectByProperty(this.list, "name", networkName).isVisible = state
		this.options.onToggleNetwork(networkName, state)
		if(state){
			this.options.onListMouseMove(networkName)
		}else{
			this.options.onListMouseLeave()
		}
	}

	// TODO: Consider if after all this, for the isolate mode we should just hide the other networks entirely? So we can edit and iteract with the map at high speed
	isolate = (networkName = null, force = false) => {
		if(!networkName){
			return
		}

		// Make sure we have this one shown first
		this.options.onListMouseMove(networkName)

		const networkItem = document.querySelector(`.network[data-name="${networkName}"]`)

		// Hold down shift to lock the current hovered item
		const isIsolated = force ? true : !networkItem.classList.contains('isIsolated')

		networkItem.classList.toggle('isIsolated', isIsolated)
		this.options.listContainer.querySelectorAll('.isIsolated').forEach(listItem => {
			if(listItem.dataset.name != networkItem.dataset.name){
				listItem.classList.remove('isIsolated')
			}
		})

		// Set root class
		this.options.listContainer.classList.toggle('hasIsolatedNetwork', isIsolated)
		this.isIsolated = isIsolated ? networkItem.dataset.name : null

		return isIsolated
	}
}