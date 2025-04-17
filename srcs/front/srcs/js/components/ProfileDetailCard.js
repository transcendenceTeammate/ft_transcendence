
import { Component } from "../core/Component.js";
import { MyProfileProvider } from "../data/providers/MyProfileProvider.js";

import { showToast } from "../core/toast.js";



export class ProfileDetailCard extends Component {
	constructor() {
		super();
		this.avatarUrl = "";
		this.username = "";
	}

	static async create() {
		let profileDetailCard = new ProfileDetailCard();
		return profileDetailCard;
	}

	_bindEventListeners() {
		const pencil = document.getElementById('editNamePencil');
		const usernameForm = document.getElementById('usernameForm');
		const usernameHeading = document.getElementById('usernameHeading');
		const usernameButton = document.getElementById('usernameButton');
		const unameInput = document.getElementById('unameInput');
		const uname = document.getElementById('uname');
		const upload = document.getElementById('upload');
		const changeAvatarModal = document.getElementById('change_avatar_div');
	
		pencil?.removeEventListener('click', this._pencilClickHandler);
		this._pencilClickHandler = (e) => {
			e.preventDefault();
			usernameHeading.classList.add('d-none');
			usernameForm.classList.remove('d-none');
		};
		pencil?.addEventListener('click', this._pencilClickHandler);

		usernameButton?.removeEventListener('click', this._usernameButtonClickHandler);
		this._usernameButtonClickHandler = (e) => {
			e.preventDefault();
			const myProfileProvider = MyProfileProvider.getInstance();
			uname.textContent = unameInput.value;
			myProfileProvider.setUsername(unameInput.value).catch((error) => {
				console.error("Failed to update username:", error);
				uname.textContent = this.username;
				unameInput.value = this.username;
				showToast({
					title: "Failed to update username",
					message: `${error}`,
					type: "error",
					duration: 4000
				});
			});
			usernameForm.classList.add('d-none');
			usernameHeading.classList.remove('d-none');
		};
		usernameButton?.addEventListener('click', this._usernameButtonClickHandler);

		upload?.removeEventListener('change', this._uploadChangeHandler);
		this._uploadChangeHandler = (e) => {
			e.preventDefault();
			const file = e.target.files[0];
			if (!file) return;

			const myProfileProvider = MyProfileProvider.getInstance();
			myProfileProvider.setAvatar(file);

			const modal = bootstrap.Modal.getOrCreateInstance(changeAvatarModal);
			modal.hide();
		};
		upload?.addEventListener('change', this._uploadChangeHandler);
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
		this._bindEventListeners();
	}

	_getComponentHtml() {

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
				<img src="${this.avatarUrl}" class="card-img-top" alt="..." id="userpic" style="width: 300px; height: 300px; object-fit: cover;">
			</div>
			<div class="card-body">
				<div class="d-none" id="usernameForm">
					<div class="input-group mb-1">
						<input type="text" class="form-control" value='${this.username}' id='unameInput' required>
						<button class="btn btn-outline-secondary" type="button" id="usernameButton">Submit</button>
					</div>
				</div>
				<div id="usernameHeading">
					<h5 class="card-title"><span id="uname">${this.username}</span>
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
	`
	}
}