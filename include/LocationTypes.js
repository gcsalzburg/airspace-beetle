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

	sort = () => {
		// Sort list of types alphabetically
		this.list.sort((a,b) => a.name - b.name)
	}

	renderDOMList = () => {
		if(this.options.listContainer){
			 // Update the list

			 this.options.listContainer.innerHTML = ""

			 for(let type of this.list){
				 const safeName = type.name.replace(/\s/g, "")
				 const sliderHTML = `<div class="slider-wrapper ${safeName}-weight-wrapper">
										 <label for="${safeName}-weight">${type.name}:</label>
										 <span class="slider">
											 <input type="range" class="${safeName}-weight" id="${safeName}-weight" name="${safeName}-weight" min="1" max="100" step="1" value="1" />
										 </span>
										 <span class="value">1</span>
									 </div>`
				 this.options.listContainer.insertAdjacentHTML('beforeend',sliderHTML)
	 
				 document.querySelector(`.${safeName}-weight-wrapper input[type="range"]`).addEventListener("input", (e) => {
					 document.querySelector(`.${safeName}-weight-wrapper .value`).textContent = `${e.target.value}`
					 this.options.onSliderChange(type.name,e.target.value)
				 })
			 }
		}
	}
}