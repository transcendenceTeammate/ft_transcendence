import AbstractView from "./AbstractView.js";
// import User from "../user/User";


export default class Navbar extends AbstractView {
    constructor(){
        super();
        
    }

	async logMeOut() {
		const logout = await super.loadElement('logout-link');

		logout.addEventListener('click', (e) => {
			e.preventDefault();
			console.log('log me out function from Navbar class. is the event listener getting added?')
			AbstractView.user = null;
			document.cookie = "access_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.app.localhost";
			takeMeThere(location.origin + '/')
	  

		})
	}

    async getHtml(){
		this.logMeOut();
        return `
            <nav class="navbar navbar-expand-lg bg-body-tertiary">
		<div class="container-fluid">
			<a class="navbar-brand" href="start-game" data-link><span id="st-peng" data-link>Peng</span><span id="st-pong" data-link>Pong</span></a>
			<button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarText"
				aria-controls="navbarText" aria-expanded="false" aria-label="Toggle navigation">
				<span class="navbar-toggler-icon"></span>
			</button>
			<div class="collapse navbar-collapse" id="navbarText">
				<ul class="navbar-nav me-auto mb-2 mb-lg-0">
					<li class="nav-item">
						<a class="nav-link active" aria-current="page" href="#">My profile</a>
					</li>
					<li class="nav-item">
						<a class="nav-link" href="#">All players</a>
					</li>
					<li class="nav-item">
						<a class="nav-link" href="#">Smth else</a>
					</li>
				</ul>
				<ul class="navbar-nav  mb-2 mb-lg-0">
					<a href="profile" class="nav-link" data-link>
						<img src="${AbstractView.user.userpic}" alt="User's avatar" class="rounded-circle border border-black object-fit-cover" height="35" id="nav-avatar" data-link>
						<span data-link>${AbstractView.user.name}</span>
					</a>
					<div class="d-flex align-items-center">
						<a href='#' class='nav-link pt-0 text-danger' id="logout-link">Log out</a>
					</div>
				</ul>

			</div>
		</div>
	</nav>
        `
    }
}
