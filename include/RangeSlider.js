export default class{

	// Default options are below
	options = {
		container: null,
		label: 'Distance:',
		min: 0,
		max: 100,
		step: 1,
		value: 50,
		valueSuffix: 'km'
	}


	// **********************************************************
	// Constructor, to merge in options

	constructor(options){
		this.options = {...this.options, ...options}
		this.value = this.options.value

		this.render()
	}

	render(){
		this.element = document.createElement('div')
		this.element.classList.add('slider-wrapper')
		this.element.classList.add(`${this.options.name}-range-wrapper`)
		this.element.innerHTML = `<label for="${this.options.name}-range">${this.options.label}</label>
										<span class="slider">
											<input type="range" class="${this.options.name}-range" id="${this.options.name}-range" name="${this.options.name}-range" min="${this.options.min}" max="${this.options.max}" step="${this.options.step}" value="${this.options.value}" />
										</span>
										<span class="value">${this.options.value}${this.options.valueSuffix ? ' '+this.options.valueSuffix : ''}</span>`
		this.options.container.append(this.element)


		this.element.querySelector('input[type="range"]').addEventListener("input", (e) => {
			this.value = e.target.value
			this.element.querySelector('.value').textContent = `${this.value}${this.options.valueSuffix ? ' '+this.options.valueSuffix : ''}`
			this.options.onInput(this.value)
		})
	}

	setValue = (value = this.value) => {
		this.value = value
		this.element.querySelector('input[type="range"]').setAttribute('value', this.value)
		this.element.querySelector('.value').textContent = `${this.value}${this.options.valueSuffix ? ' '+this.options.valueSuffix : ''}`
	}

	setLimits = (opts = {}) => {
		if(opts.min && opts.min < Infinity){
			this.options.min = opts.min
			this.element.querySelector('input[type="range"]').setAttribute('min', opts.min)
			if(this.value < opts.min){
				this.value = opts.min
				this.setValue()
			}
		}
		if(opts.max && opts.max > -Infinity){
			this.options.max = opts.max
			this.element.querySelector('input[type="range"]').setAttribute('max', opts.max)
			if(this.value > opts.max){
				this.value = opts.max
				this.setValue()
			}
		}
	}
}