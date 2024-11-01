export default class{

	// Default options are below
	options = {
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
		this.element.classList.add('select-wrapper')
		this.element.innerHTML = `<label>${this.options.label}</label><select></select>`
		this.options.container.append(this.element)

		for(let option of this.options.options){
			const newOption = new Option(option.name, option.value, option.selected, option.selected)
			this.element.querySelector('select').add(newOption)
		}

		this.element.querySelector('select').addEventListener("change", (e) => {
			this.value = e.target.value
			this.options.onChange(this.value)
		})

		new Option()
	}
	
	setValue = (value = this.value) => {
		for (let i = 0; i < this.element.querySelector('select').options.length; i++) {
			if (this.element.querySelector('select').options[i].value === value) {
				this.element.querySelector('select').selectedIndex = i
				this.value = value
				return true
			}
	  }
	  return false
	}
}