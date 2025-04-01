import { Component } from "../core/Component.js";
import { MyProfileProvider } from "../data/providers/MyProfileProvider.js";
import { showToast } from "../core/toast.js";


export class FriendListItem extends Component {
	constructor(username, avatarUrl, isConnected) {
		super();
		this.username = username;
		this.avatarUrl = avatarUrl;
		this.isConnected = isConnected;
	}

	_getComponentHtml() {
		const borderClass = this.isConnected ? "online" : "offline";

		return `
			<a href="#" class="text-decoration-none d-flex flex-column align-items-center link-dark">
				<div class="avatar-item ${borderClass}">
					<img src="${this.avatarUrl}" alt="Avatar">
				</div>
				${this.username}
			</a>
		`;
	}
}


export class FriendsList extends Component {
	constructor() {
		super();

	}

	static async create() {
		let friendList = new FriendsList();
		await friendList.init();
		return friendList;
	}

	async init() {

	}


	_onLoaded()
	{
		let myProfileProvider = MyProfileProvider.getInstance();
		
		myProfileProvider.friendListStream.listen((friendList) => {
			
			this.friendListItems = friendList.map((element) => {
				return new FriendListItem(element.username, element.avatarUrl, element.isConnected).render();
			}).join('');
			this.updateComponent();
		});
		myProfileProvider.updateProfile();
	}

	_onRefresh()
	{
		const addFriendButton = document.getElementById('addFriendButton');
		const deleteFriendButton = document.getElementById('deleteFriendButton');
		
		addFriendButton.removeEventListener('click', this._addFriendHandler);
		this._addFriendHandler = () => {
			const friendName = document.getElementById('friendNameInput').value;
			if (friendName) {
				console.log('Add friend:', friendName);
				const myProfileProvider = MyProfileProvider.getInstance();

				myProfileProvider.addFriend(friendName).catch((error) => {
					console.error("Failed to add friend:", error);
					showToast({
						title: "Failed to add friend",
						message: `${error}`,
						type: "error",
						duration: 4000
					});
				});
			}
		};
		addFriendButton.addEventListener('click', this._addFriendHandler);

		deleteFriendButton.removeEventListener('click', this._removeFriendHandler);
		this._removeFriendHandler = () => {
			const friendName = document.getElementById('friendNameInput').value;
			if (friendName) {
				console.log('Remove friend:', friendName);
				const myProfileProvider = MyProfileProvider.getInstance();

				myProfileProvider.removeFriend(friendName).catch((error) => {
					console.error("Failed to remove friend:", error);
					uname.textContent = this.username;
					showToast({
						title: "Failed to remove friend",
						message: `${error}`,
						type: "error",
						duration: 4000
					});
				});
			}
		};
		deleteFriendButton.addEventListener('click', this._removeFriendHandler);
	}


	_getComponentHtml() {
		return `
			<div id="myfriends">
				<h3 class="m-4 display-8 fw-bold">My friends</h3>
				<div class="mb-3">
					<div id="friendListContainer">
						<div class="avatar-gallery py-4">
						${this.friendListItems || ''}
						</div>
					</div>
				</div>
					<input type="text" id="friendNameInput" class="form-control" placeholder="Friend's name" aria-label="Friend's name" aria-describedby="basic-addon2">
					<div class="input-group-append mt-2">
						<button id="addFriendButton" class="btn btn-outline-secondary" type="button">Add Friend</button>
						<button id="deleteFriendButton" class="btn btn-outline-secondary" type="button">Remove Friend</button>
					</div>
			</div>
		`;
	}	
}