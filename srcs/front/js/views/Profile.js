import { FriendsList } from "../components/FriendList.js";
import AbstractView from "./AbstractView.js";
import Navbar from "./Navbar.js";

export default class extends AbstractView {
	constructor() {
		super();
		this.setTitle("Profile");

		this.gameHistory = [
			{ player1: "Alice", score1: 5, player2: "Bob", score2: 3, result: "Win" },
			{ player1: "Charlie", score1: 2, player2: "David", score2: 6, result: "Lose" },
			{ player1: "Eve", score1: 7, player2: "Frank", score2: 4, result: "Win" },
			{ player1: "Grace", score1: 3, player2: "Hank", score2: 1, result: "Win" },
			{ player1: "Ivy", score1: 6, player2: "Jack", score2: 7, result: "Lose" },
			{ player1: "Kevin", score1: 4, player2: "Liam", score2: 5, result: "Lose" },
			{ player1: "Grace", score1: 3, player2: "Hank", score2: 1, result: "Win" },
			{ player1: "Ivy", score1: 6, player2: "Jack", score2: 7, result: "Lose" },
			{ player1: "Kevin", score1: 4, player2: "Liam", score2: 5, result: "Lose" },
		];
	}

	async loadElements() {
		try {
			this.pencil = await super.loadElement("editNamePencil");
			this.usernameForm = await super.loadElement("usernameForm");
			this.usernameHeading = await super.loadElement("usernameHeading");
			this.usernameButton = await super.loadElement("usernameButton");
			this.unameInput = await super.loadElement("unameInput");
			this.uname = await super.loadElement("uname");
			this.upload = await super.loadElement("upload");
			this.userpic = await super.loadElement("userpic");
			this.change_avatar_modal = await super.loadElement("change_avatar_div");
		} catch (e) {
			console.log(e);
		}
	}

	async attachAllJs() {
		await this.loadElements();
		
		this.pencil.addEventListener("click", (e) => {
			e.preventDefault();
			this.usernameHeading.classList.add("d-none");
			this.usernameForm.classList.remove("d-none");
		});

		this.usernameButton.addEventListener("click", (e) => {
			e.preventDefault();
			this.uname.textContent = this.unameInput.value;
			this.usernameForm.classList.add("d-none");
			this.usernameHeading.classList.remove("d-none");
		});

		this.upload.addEventListener("change", (event) => {
			event.preventDefault();
			const file = event.target.files[0];
			if (file) {
				if (file.type.startsWith("image/")) {
					const reader = new FileReader();
					reader.onload = (e) => {
						this.userpic.src = e.target.result;
						document.activeElement.blur();
						const modalInstance = bootstrap.Modal.getOrCreateInstance(this.change_avatar_modal);
						modalInstance.hide();
		
						AbstractView.me.userpic = e.target.result;
					};
					reader.readAsDataURL(file);
				} else {
					alert("Please upload a valid image file.");
				}
			}
		});        
	}

	async getHtml() {
		this.navbar = await new Navbar().getHtml();
		this.friendsComponent = await FriendsList.create();
		this.attachAllJs();

		return `
		<div class="modal" tabindex="-1" id="change_avatar_div">
			<div class="modal-dialog modal-dialog-centered">
				<div class="modal-content">
					<div class="modal-header">
						<h5 class="modal-title fw-bold">Upload new avatar</h5>
						<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
					</div>
					<div class="modal-body">
						<div>
							<input class="form-control form-control-lg" id="upload" type="file">
						</div>
					</div>
				</div>
			</div>
		</div>
		<div id="app-child-profile">
			${this.navbar}

			<main class="container mt-5">
				<div class="row">
					<div class="col-6 offset-2 mt-3">
						<div class="card" style="width: 30rem;">
							<div class="position-relative text-center">
								<span class="position-absolute bottom-0 end-0 p-2 bg-light border border-light rounded-pill"
									id="editPhotoSpan">
									<a class="icon-link link-dark px-1" role="button" data-bs-toggle="modal"
										data-bs-target="#change_avatar_div" data-bs-title="Edit profile pic">
										<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor"
											class="bi bi-camera" viewBox="0 0 16 16">
											<path
												d="M15 12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h1.172a3 3 0 0 0 2.12-.879l.83-.828A1 1 0 0 1 6.827 3h2.344a1 1 0 0 1 .707.293l.828.828A3 3 0 0 0 12.828 5H14a1 1 0 0 1 1 1zM2 4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-1.172a2 2 0 0 1-1.414-.586l-.828-.828A2 2 0 0 0 9.172 2H6.828a2 2 0 0 0-1.414.586l-.828.828A2 2 0 0 1 3.172 4z" />
											<path
												d="M8 11a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5m0 1a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M3 6.5a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0" />
										</svg>
									</a>
								</span>
								<img src=".${AbstractView.me.userpic}" class="card-img-top" alt="..."
									id="userpic">
							</div>
							<div class="card-body">
								<div class="d-none" id="usernameForm">
									<div class="input-group mb-1">
										<input type="text" class="form-control" value='${AbstractView.me.name}' id='unameInput' required>
										<button class="btn btn-outline-secondary" type="button" id="usernameButton">Submit</button>
									</div>
								</div>
								<div id="usernameHeading">
									<h5 class="card-title"><span id="uname">${AbstractView.me.name}</span>
										<a href="#" role="button" class="link-dark" id="editNamePencil">
											<span class="px-3">
												<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor"
													class="bi bi-pencil" viewBox="0 0 16 16">
													<path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293z"/>
												</svg>
											</span>
										</a>
									</h5>
								</div>
							</div>
						</div>
					</div>

					${this.friendsComponent.render()}

					<div class="col-6 offset-2 mt-5">
						<h3 class="text-center">Game History</h3>
						<div class="table-responsive">
							<table class="table table-striped">
								<thead>
									<tr>
										<th>Player 1</th>
										<th>Score</th>
										<th>Player 2</th>
										<th>Score</th>
										<th>Result</th>
									</tr>
								</thead>
								<tbody>
									${this.gameHistory.map(game => `
										<tr>
											<td>${game.player1}</td>
											<td>${game.score1}</td>
											<td>${game.player2}</td>
											<td>${game.score2}</td>
											<td class="result-column">
												<span class="badge ${game.result.toLowerCase()}">${game.result}</span>
											</td>
										</tr>
									`).join('')}
								</tbody>
							</table>
						</div>
					</div>
				</div>
			</main>
		</div>
		`;
	}
}
