import CONFIG from "../config.js";
// import User from "../user/User.js";

export default class AbstractView {
	static user = null;
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

	// static async isAuthenticated() {
	// 	const accessToken = this.getCookie('access_token');
	// 	if (!accessToken) {
	// 		console.log("No access token found");
	// 		return false;
	// 	}
	// 	console.log("Access token found:", accessToken);
	// 	try {
	// 		const response = await fetch(`${CONFIG.API_URL}/api/token/verify/`, {
	// 			method: "POST",
	// 			headers: {
	// 				"Content-Type": "application/json",
	// 				"Authorization": `Bearer ${accessToken}`
	// 			},
	// 			body: JSON.stringify({ token: accessToken })
	// 		});
	// 		if (response.ok) {
	// 			return true;
	// 		} else {
	// 			return false;
	// 		}
	// 	} catch (error) {
	// 		console.error("Token verification failed:", error);
	// 		return false;
	// 	}
	// }

	// static async assignUsername() {
	// 	const accessToken = this.getCookie('access_token');

	// 	try {
	// 		const response = await fetch(`${CONFIG.API_URL}/api/users/me/`, {
	// 			method: "GET",
	// 			headers: {
	// 				"Authorization": `Bearer ${accessToken}`,
	// 				"Content-Type": "application/json",
	// 			},
	// 			credentials: 'include'
	// 		});

	// 		if (response.ok) {
	// 			const data = await response.json();
	// 			this.user = new User(data.username, null, null, true)
				
	// 		} else {
	// 			console.error("Failed to fetch username");
	// 			this.User = null
	// 		}
	// 	} catch (error) {
	// 		console.error("Error fetching username:", error);
	// 		this.User = null;
	// 	}
	// }

	// static getCookie(name) {
	// 	let cookieValue = null;
	// 	if (document.cookie && document.cookie !== '') {
	// 		const cookies = document.cookie.split(';');
	// 		for (let i = 0; i < cookies.length; i++) {
	// 			const cookie = cookies[i].trim();
	// 			if (cookie.substring(0, name.length + 1) === (name + '=')) {
	// 				cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
	// 				break;
	// 			}
	// 		}
	// 	}
	// 	return cookieValue;
	// }

	async getHtml() {
		return "";
	}

	async onLoaded() {
		return "";
	}

	// async logMeOut() {
	// 	const logout = await this.loadElement('logout-link');

	// 	logout.addEventListener('click', (e) => {
	// 		e.preventDefault();
	// 		AbstractView.user = null;
	// 		document.cookie = "access_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.app.localhost";
	// 		takeMeThere(location.origin + '/')
	  

	// 	})
	// }

	// async getNavbar() {
	// 	if (AbstractView.User === null)
	// 		await AbstractView.assignUsername();
	// 	this.logMeOut();

	// 	return `
	// 	<nav class="navbar navbar-expand-lg bg-body-tertiary">
	// 	<div class="container-fluid">
	// 		<a class="navbar-brand" href="start-game" data-link><span id="st-peng" data-link>Peng</span><span id="st-pong" data-link>Pong</span></a>
	// 		<button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarText"
	// 			aria-controls="navbarText" aria-expanded="false" aria-label="Toggle navigation">
	// 			<span class="navbar-toggler-icon"></span>
	// 		</button>
	// 		<div class="collapse navbar-collapse" id="navbarText">
	// 			<ul class="navbar-nav me-auto mb-2 mb-lg-0">
	// 				<li class="nav-item">
	// 					<a class="nav-link active" aria-current="page" href="#">My profile</a>
	// 				</li>
	// 				<li class="nav-item">
	// 					<a class="nav-link" href="#">All players</a>
	// 				</li>
	// 				<li class="nav-item">
	// 					<a class="nav-link" href="#">Smth else</a>
	// 				</li>
	// 			</ul>
	// 			<ul class="navbar-nav  mb-2 mb-lg-0">
	// 				<a href="profile" class="nav-link" data-link>
	// 					<img src="${AbstractView.User.userpic}" alt="User's avatar" class="rounded-circle border border-black object-fit-cover" height="35" id="nav-avatar" data-link>
	// 					<span data-link>${AbstractView.User.name}</span>
	// 				</a>
	// 				<div class="d-flex align-items-center">
	// 					<a href='#' class='nav-link pt-0 text-danger' id="logout-link">Log out</a>
	// 				</div>
	// 			</ul>

	// 		</div>
	// 	</div>
	// </nav>
	// 	`
	// }
}