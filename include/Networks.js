import List from './List.js'

export default class extends List{

	constructor(options){

		super(options)

		if(this.options.listContainer){

			// Add hover effects to list of locations on side
			this.options.listContainer.addEventListener('mousemove', (e) => {
				const location = e.target.closest('.location')
				if(location){
					this.options.onListMouseMove(location)
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
				const itemHTML = `<div class="location" data-name="${item.name}"><span class="num" style="background-color: ${item.color}">${item.count}</span> ${item.name}</div>`
				return html + itemHTML
			 }, '')
		}
	}
}