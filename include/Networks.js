import List from './List.js'

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
				e.preventDefault()
				const network = e.target.closest('.network')

				if(network){
					if(e.shiftKey){
						// Hold down shift to show only this network
						this._isolateVisibility(network)
					}else{
						// Otherwise just toggle the network visibility
						this._toggleVisibility(network, !network.classList.contains('isVisible'))
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

			// Add show and hide all buttons
			this.options.listContainer.insertAdjacentHTML('afterBegin', `<div class="show-hide-all-buttons"><a href="#show-all">Show all</a> <a href="#hide-all">Hide all</a></div>`)
			this.options.listContainer.querySelector('a[href="#show-all"]').addEventListener('mousemove', () => {
				this.options.onListMouseLeave()
			})
			this.options.listContainer.querySelector('a[href="#hide-all"]').addEventListener('mousemove', () => {
				this.options.onListMouseLeave()
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

	toggleInList = (networkName, isVisible) => {
		document.querySelector(`.network[data-name="${networkName}"]`).classList.toggle('isVisible', isVisible)
	}

	updateCounts = (dataCounts, dataTotals) => {
		for(let item of this.list){
			if(dataCounts[item.name]){
				item.count = dataCounts[item.name]
				item.total = dataTotals[item.name]
			}else{
				item.count = 0
			}
		}
		this.sort()
	}

	_toggleVisibility = async (networkItem = null, state = false) => {

		if(!networkItem){
			return
		}

		const networkName = networkItem.dataset.name

		networkItem.classList.toggle('isVisible', state)
		this.list.find(item => item.name == networkName).isVisible = state
		await this.options.onToggleNetworks([networkName], state)

		if(state){
			this.options.onListMouseMove(networkName)
		}else{
			this.options.onListMouseLeave()
		}
	}

	// Shortcut to hide all others and show just this one
	_isolateVisibility = async (networkItem = null, force = false) => {
		if(!networkItem){
			return
		}

		const networkName = networkItem.dataset.name

		// First call this, to reset the view
		this.options.onListMouseLeave()

		// Hide all others
		document.querySelectorAll(`.network:not([data-name="${networkName}"])`).forEach(networkElm => {
			networkElm.classList.remove('isVisible')
		})
		this.list.filter(item => item.name != networkName).forEach(network => {
			network.isVisible = false
		})
		await this.options.onToggleNetworks(this.list.filter(item => item.name != networkName).map(network => network.name), false)

		// Show this one
		networkItem.classList.add('isVisible')
		this.list.find(item => item.name == networkName).isVisible = true
		await this.options.onToggleNetworks([networkName], true)

		// Trigger this, just in case it was hidden previously
		this.options.onListMouseMove(networkName)
	}

	_showAll = async () => {
		document.querySelectorAll(`.network`).forEach(networkElm => {
			networkElm.classList.add('isVisible')
		})
		await this.options.onToggleNetworks(this.list.map(network => network.name), true)
	}
	_hideAll = async () => {
		document.querySelectorAll(`.network`).forEach(networkElm => {
			networkElm.classList.remove('isVisible')
		})
		await this.options.onToggleNetworks(this.list.map(network => network.name), false)
	}
}