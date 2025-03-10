import Accueil from "./views/Accueil.js";
import Login from "./views/Login.js";
import Signup from "./views/Signup.js";
import Success from "./views/Success.js";
import NotFound from "./views/NotFound.js";
import Avatar from "./views/Avatar.js";
import StartGame from "./views/StartGame.js";
import Profile from "./views/Profile.js";
import AbstractView from "./views/AbstractView.js";
import Game from "./views/Game.js"

// const navigateTo = url => {
//     history.pushState(null, null, url);
//     console.log(`location pathname: ${location.pathname}`)
//     console.log(`url: ${url}`)
//     router();
// }

window.takeMeThere = function (url) {
	history.pushState(null, null, url);
	router();
}

const router = async () => {

	const routes = [
		{ path: '/', view: Accueil },
		{ path: '/login', view: Login },
		{ path: '/signup', view: Signup },
		{ path: '/success', view: Success },
		{ path: '/notfound', view: NotFound },
		{ path: '/start_game', view: StartGame },
		{ path: '/profile', view: Profile },
		{ path: '/game', view: Game}

	];

	let match = routes.find(route => location.pathname === route.path )
	console.log('hello from router!! Match is:')
	console.dir(match)

	if (!match) {
		console.log('no match!');
		match = {
			route: routes[4],
			isMatch: true
		};
	}
	const view = new match.view();

	document.querySelector("#app").innerHTML = await view.getHtml();

	view.onLoaded();
	
}

window.addEventListener("popstate", () => {
	router();
});


document.addEventListener("DOMContentLoaded", () => {

	document.body.addEventListener("click", e => {

		if (e.target.matches("[data-link]")) {


			e.preventDefault();
			console.log(`does e.target match href? ${e.target.matches('[href]')}`)
			// console.log(`does e.target match datalink? ${e.target.matches('data-link')}`)
			if (!e.target.matches('[href]')) takeMeThere(e.target.parentElement.href)
			else takeMeThere(e.target.href)
			// navigateTo(e.target.href);
		}
	})
	// console.log('hello from DOMcontentloaded just before calling the router!!!!')
	router();
});
