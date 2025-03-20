import CONFIG from "../config.js";

export default class AbstractView {
	static me = null;
	constructor() {
	}

	setTitle(title) {
		document.title = title;
	}

	async loadElement(selector) {
		return new Promise((resolve, reject) => {
			const checkExist = setInterval(() => {
				let elem = document.getElementById(selector);
				if (elem) {
					console.log('element loaded!!!')
					console.dir(elem)
					clearInterval(checkExist);
					resolve(elem);
				}
			}, 100);

			setTimeout(() => {
				clearInterval(checkExist);
				reject(new Error(`Element not found: ${selector}`));
			}, 5000);
		});
	}

	async loadAllElements(classSelector) {
		return new Promise((resolve, reject) => {
			const checkExist = setInterval(() => {
				let elems = document.querySelectorAll(classSelector);
				if (elems.length > 0) {
					clearInterval(checkExist);
					console.dir(elems);
					resolve(elems);
				}
				console.log("Didn't load elems yet...")
			}, 200);

			setTimeout(() => {
				clearInterval(checkExist);
				reject(new Error(`Elements not found: ${classSelector}`));
			}, 5000);
		});
	}

	async getHtml() {
		return "";
	}

	async onLoaded() {
		return "";
	}

}