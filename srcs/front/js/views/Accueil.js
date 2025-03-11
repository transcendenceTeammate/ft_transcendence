import CONFIG from "../config.js";

import AbstractView from "./AbstractView.js";
export default class Accueil extends AbstractView {
	static accessDenied = false;
	constructor() {
		super();
		this.setTitle("Accueil");
		
	}

	async pengCursor() {
		this.pageDiv = await super.loadElement('app-child-accueil');
		this.pageDiv.classList.toggle('penguin-cursor')
	}

	async alertDiv(){ 
	  
		if (Accueil.accessDenied){
			console.log('ACCESS DENIED hello from accueil');
			this.alertDiv = await super.loadElement('alertDiv');
			this.alertDiv.classList.remove('d-none')
		}
	  
			
		   
		

		this.alertDiv = await super.loadElement('alertDiv');

	}

	async auth42() {
		try {
			this.auth42_btn = await super.loadElement('auth42_btn');
			this.auth42_btn.addEventListener('click', async () => {
				window.location.href = `${CONFIG.API_URL}/api/oauth/get-authorization-uri/`;
			});
		} catch (e) {
			console.log('Error in auth42:', e);
		}
	}

	async getHtml() {
		this.auth42();
		this.pengCursor();
		this.alertDiv();
		return `
		<div id="app-child-accueil">
		<div class="alert alert-danger alert-dismissible fade show d-none" role="alert" id="alertDiv">
  You're not authorized. Log in or sign up first
  <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
</div>
		<div id="container-accueil">
		<div id="login">
			<div>
				<button id="auth42_btn"><span>Log in with </span>
					<img src="../public/logo_42-_svg.svg" alt="oops no logo" id="logo">
				</button>
			</div>
			<div style="margin-top: 0.3em">
				<a href="login" class="nav__link" data-link>Log in</a> |
				<a href="signup" class="nav__link" data-link>Sign up</a>
			</div>
		</div>

		<div id="penguins">
			<div class="pengdiv">
				<img src="../public/penguin-left-cut-radically.png" alt="oops" id="penguinleft" class="penguin animated">
			</div>
			<div id='ballcontainer'>
				<div id="ball" class="rounded-circle animated"></div>
			</div>
			<div class="pengdiv">
				<img src="../public/penguin-right-cut-radically.png" alt="no penguin" id="penguinright"
					class="penguin animated">
			</div>
		</div>
		<div id="welcome">
			<h1 id="welcomeheading">Welcome to <span id="pengpong">
					<span id="pengemoji" class="emojis">🐧</span>
					<span id="peng" class="pengpong">Peng</span><span id="pong" class="pengpong">Pong</span>
					<span id="pongemoji" class="emojis">🏓</span>
				</span> Game
			</h1>
		</div>
	</div>
	</div>
		`;
	}
}