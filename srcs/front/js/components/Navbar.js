import { Component } from "../core/Component.js";
import { MyProfileProvider } from "../data/providers/MyProfileProvider.js";

export class Navbar extends Component {
	constructor() {
		super();
		this.avatarUrl = null;
		this.username = null;
	}

	static async create() {
		let navbar = new Navbar();
		await navbar.init();
		return navbar;
	}

	async init() {

	}

	async registerLogOut() {
		const logout = document.getElementById("logout-link");

		logout.addEventListener('click', (e) => {
				e.preventDefault();
				document.cookie = "access_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.app.localhost"; //TODO Remove hardcoded domain
				takeMeThere(location.origin + '/')
		})
	}

	_onLoaded()
	{
		let myProfileProvider = MyProfileProvider.getInstance();

		myProfileProvider.usernameStream.listen((username) => {
			this.username = username;
			this.updateComponent();
		});

		myProfileProvider.userAvatarStream.listen((userAvatar) => {
			this.avatarUrl = userAvatar;
			this.updateComponent();
		});

		myProfileProvider.updateProfile();

	}

	_onRefresh()
	{
		this.registerLogOut();
	}

	_getComponentHtml() {

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
							<img src="${this.avatarUrl}" alt="User's avatar" class="rounded-circle border border-black object-fit-cover" height="35" id="nav-avatar" data-link>
							<span data-link>${this.username}</span>
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