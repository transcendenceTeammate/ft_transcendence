import Accueil from "./views/Accueil.js";
import Login from "./views/Login.js";
import Signup from "./views/Signup.js";
import NotFound from "./views/NotFound.js";
import StartGame from "./views/StartGame.js";
import Profile from "./views/Profile.js";

import Game from "./views/Game.js";
import { isAuthenticated } from "./user/UserApiCalls.js";

window.takeMeThere = function (url) {
	history.pushState(null, null, url);
	router();
}

const router = async () => {
	const routes = [
		{ path: '/', view: Accueil },
		{ path: '/login', view: Login },
		{ path: '/signup', view: Signup },
		{ path: '/notfound', view: NotFound },
		{ path: '/start-game', view: StartGame },
		{ path: '/profile', view: Profile },
		{ path: '/game', view: Game }

	];

	const match = routes.find(route => location.pathname === route.path)

	if (!match) {
		console.log('no match!');
		match = routes[3];
	}

	const view = new match.view();

	const accessibleToAll = match.path === '/' || match.path === '/login' || match.path === '/signup' || match.path === '/notfound'
	if (accessibleToAll) {
		document.querySelector("#app").innerHTML = await view.getHtml();
		Accueil.accessDenied = false;
		view.onLoaded();
		return;
	}

	const userAuthenticated = await isAuthenticated();
	if (!userAuthenticated) {
		Accueil.accessDenied = true;
		return takeMeThere(location.origin + '/')

	} else Accueil.accessDenied = false;



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
			if (!e.target.matches('[href]')) takeMeThere(e.target.parentElement.href)
			else takeMeThere(e.target.href)
		
		}
	})
	router();
});
