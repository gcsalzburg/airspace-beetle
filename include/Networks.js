import List from './List.js'
import * as Utils from './Utils.js'

export default class extends List{

	constructor(options){

		super(options)

		if(this.options.listContainer){

			// Add hover effects to list of networks on side
			this.options.listContainer.addEventListener('mousemove', (e) => {
				const network = e.target.closest('.network')
				if(network){
					if(network.classList.contains('isVisible')){
						this.options.onListMouseMove(network.dataset.name)
					}else{
						this.options.onListMouseLeave()
					}
				}
			})
			this.options.listContainer.addEventListener('click', (e) => {
				const network = e.target.closest('.network')
				if(network){
					const isVisible = !network.classList.contains('isVisible')
					network.classList.toggle('isVisible', isVisible)
					Utils.findObjectByProperty(this.list, "name", network.dataset.name).isVisible = isVisible
					this.options.onToggleNetwork(network.dataset.name, isVisible)

					if(isVisible){
						this.options.onListMouseMove(network.dataset.name)
					}else{
						this.options.onListMouseLeave()
					}
				}
			})
			this.options.listContainer.addEventListener('mouseleave', (e) => {
				this.options.onListMouseLeave()
			})
		}
	}

	renderDOMList = () => {
		if(this.options.listContainer){
			 // Update the list
			 this.options.listContainer.innerHTML = this.list.reduce((html, item) => {
				const itemHTML = `<div class="network isVisible" data-name="${item.name}"><span class="num" style="background-color: ${item.color}">${item.count} / ${item.total}</span> ${item.name}</div>`
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
}