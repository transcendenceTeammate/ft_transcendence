import Accueil from "./views/Accueil.js";
import Login from "./views/Login.js";
import Signup from "./views/Signup.js";
import Success from "./views/Success.js";
import NotFound from "./views/NotFound.js";
// import Avatar from "./views/Avatar.js";
import StartGame from "./views/StartGame.js";
import Profile from "./views/Profile.js";
import AbstractView from "./views/AbstractView.js";
import Game from "./views/Game.js";
import Tournament from "./views/Tournament.js";
import TournamentGame from "./views/TournamentGame.js";

window.takeMeThere = function (url) {
	history.pushState(null, null, url);
	router();
}

const router = async () => {
	const routes = [
		{ path: '/', view: Accueil },
		{ path: '/login', view: Login },
		{ path: '/signup', view: Signup },
		// { path: '/success', view: Success },
		{ path: '/notfound', view: NotFound },
		{ path: '/start-game', view: StartGame },
		{ path: '/profile', view: Profile },
		{ path: '/game', view: Game },
		{ path: '/tournament', view: Tournament },
		{ path: '/tournament-game', view: TournamentGame }

	];

	const match = routes.find(route => location.pathname === route.path)

	if (!match) {
		console.log('no match!');
		match = routes[4];
	}

	const view = new match.view();

	const accessibleToAll = match.path === '/' || match.path === '/login' || match.path === '/signup' || match.path === '/notfound'
	if (accessibleToAll) {
		document.querySelector("#app").innerHTML = await view.getHtml();
		Accueil.accessDenied = false;
		view.onLoaded();
		return;
	}

	const isAuthenticated = await AbstractView.isAuthenticated();
	if (!isAuthenticated) {
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
