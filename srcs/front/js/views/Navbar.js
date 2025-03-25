import AbstractView from "./AbstractView.js";
// import User from "../user/User";


export default class Navbar extends AbstractView {
    constructor(){
        super();
        
    }

	async loadElements() {
		try {
			this.username = await super.loadElement('username')
			this.logout = await super.loadElement('logout-link');
			this.avatar = await super.loadElement('nav-avatar');
		}catch (e){
			console.log(e)
		}
	}

	async logMeOut() {
		await this.loadElements();

		this.logout.addEventListener('click', (e) => {
			e.preventDefault();
			console.log('log me out function from Navbar class. is the event listener getting added?')
			AbstractView.me = null;
			document.cookie = "access_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.app.localhost";
			takeMeThere(location.origin + '/')
	  

		})
	}

	async updateUname() {
		this.username.textContent = AbstractView.me.name;
	}

	async updateAvatar() {
		this.avatar.src = AbstractView.me.userpic;
	}

    async getHtml(){
		this.logMeOut();
		//  console.log(`hello from gethtml in navbar. What's the userpic in AbstractView? ${AbstractView.me.userpic}`)
        return `
            <nav class="navbar navbar-expand-lg bg-body-tertiary">
		<div class="container-fluid">
			<a class="navbar-brand fw-bold ms-5" href="start-game" data-link><span id="st-peng" data-link>Peng</span><span id="st-pong" data-link>Pong</span></a>
			<button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarText"
				aria-controls="navbarText" aria-expanded="false" aria-label="Toggle navigation">
				<span class="navbar-toggler-icon"></span>
			</button>
			<div class="collapse navbar-collapse" id="navbarText">
				<ul class="navbar-nav me-auto mb-2 mb-lg-0"></ul>
				<ul class="navbar-nav  mb-2 mb-lg-0 me-4">
					<a href="profile" class="nav-link" data-link>
						<img src="${AbstractView.me.userpic}" alt="User's avatar" class="rounded-circle border border-black object-fit-cover" height="35" id="nav-avatar" data-link>
						<span id="username" data-link>${AbstractView.me.name}</span>
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

// <ul class="navbar-nav me-auto mb-2 mb-lg-0">
                // 	<li class="nav-item">
                // 		<a class="nav-link active" aria-current="page" href="#">My profile</a>
                // 	</li>
                // 	<li class="nav-item">
                // 		<a class="nav-link" href="#">All players</a>
                // 	</li>
                // 	<li class="nav-item">
                // 		<a class="nav-link" href="#">Smth else</a>
                // 	</li>
                // </ul>
