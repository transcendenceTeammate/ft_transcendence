import { Component } from "../core/Component.js";
import { MyProfileProvider } from "../data/providers/MyProfileProvider.js";


export class FriendListItem extends Component {
	constructor(username, avatarUrl, isConnected) {
		super();

		this.username = username;
		this.avatarUrl = avatarUrl;
		this.isConnected = isConnected;
	}
	_getComponentHtml() {

		if (this.isConnected) {
			return `
				<a href="#" class="text-decoration-none d-flex flex-column align-items-center link-dark">
					<div class="avatar-item">
						<img src="${this.avatarUrl}" alt="Avatar">
					</div>
					${this.username}
				</a>
				`
		}
		return `
				<a href="#" class="text-decoration-none d-flex flex-column align-items-center link-dark">
					<div class="avatar-item border border-success border-4">
						<img src="${this.avatarUrl}" alt="Avatar">
					</div>
					${this.username}
				</a>
				`
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
			})
			this.updateComponent();
		});
		myProfileProvider.updateProfile();
	}



	_getComponentHtml() {
		return `
		
		<div class="text-center rounded-2" id="myfriends">
				<h3 class="m-4 display-5 fw-bold">My friends</h3>
				<div class="avatar-gallery py-4">
					${this.friendListItems}
				</div>
		</div>
		`
	}
}