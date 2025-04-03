import Accueil from "./views/Accueil.js";
import Login from "./views/Login.js";
import Signup from "./views/Signup.js";
import NotFound from "./views/NotFound.js";
import StartGame from "./views/StartGame.js";
import Profile from "./views/Profile.js";
import OnlineGame from "./views/OnlineGame.js";

import Game from "./views/Game.js";
import Tournament from "./views/Tournament.js";
import TournamentGame from "./views/TournamentGame.js";
import { isAuthenticated } from "./user/UserApiCalls.js";

window.takeMeThere = function (url) {
	// Clean up any bootstrap modals before navigation
	cleanupModals();
	
	// Proceed with navigation
	history.pushState(null, null, url);
	router();
}

// Helper function to clean up bootstrap modals
function cleanupModals() {
	// Close any open Bootstrap modals
	if (typeof bootstrap !== 'undefined') {
		document.querySelectorAll('.modal').forEach(modal => {
			try {
				const modalInstance = bootstrap.Modal.getInstance(modal);
				if (modalInstance) {
					modalInstance.hide();
				}
			} catch (e) {
				console.error("Error closing modal via Bootstrap API:", e);
			}
		});
	}
	
	// Manually remove backdrop elements
	document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
		if (backdrop.parentNode) {
			backdrop.parentNode.removeChild(backdrop);
		}
	});
	
	// Reset body styles
	document.body.classList.remove('modal-open');
	document.body.style.overflow = '';
	document.body.style.paddingRight = '';
}

const router = async () => {
	const routes = [
		{ path: '/', view: Accueil },
		{ path: '/login', view: Login },
		{ path: '/signup', view: Signup },
		{ path: '/notfound', view: NotFound },
		{ path: '/start-game', view: StartGame },
		{ path: '/profile', view: Profile },
		{ path: '/game', view: Game },
		{ path: '/tournament', view: Tournament },
		{ path: '/tournament-game', view: TournamentGame },
		{ path: '/online-game', view: OnlineGame },
	];

	const match = routes.find(route => location.pathname === route.path) || routes[3];

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
