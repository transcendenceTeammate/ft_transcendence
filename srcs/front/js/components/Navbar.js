import { Component } from "../core/Component.js";
import { UserRepository } from "../data/repositories/UserRepository.js";

export class Navbar extends Component
{
	constructor() {
		super();
		this.avatarUrl = null;
		this.username = null;		
	}

	static async create()
	{
		let navbar = new Navbar();
		await navbar.init();
		return navbar;
	}

	async init() {
		let userRepository = UserRepository.getInstance();
		
		userRepository.getUserData().then(
			(userData) => {
				console.log(userData);
		
				this.avatarUrl = userData.avatarUrl;
				this.username = userData.username;
				this.updateComponent();
			}
		);
	}
    

	_getComponentHtml() {
		return `
		<nav class="navbar navbar-expand-lg bg-body-tertiary">
		<div class="container-fluid">
			<a class="navbar-brand" href="start_game" data-link><span id="st-peng" data-link>Peng</span><span id="st-pong" data-link>Pong</span></a>
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
						<img src="${this.avatarUrl}" alt="User's avatar" class="rounded-circle border border-black object-fit-cover" height="35" id="nav-avatar" data-link>
						<span data-link>${this.username}</span>
					</a>
					<div class="d-flex align-items-center">
						<a href='#' class='nav-link pt-0 text-danger'>Log out</a>
					</div>
				</ul>

			</div>
		</div>
	</nav>
		`
	}
}