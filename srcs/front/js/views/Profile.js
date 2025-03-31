import AbstractView from "./AbstractView.js";
import { FriendsList } from "../components/FriendList.js";
import { Navbar } from "../components/Navbar.js";
import { ProfileDetailCard } from "../components/ProfileDetailCard.js";
import { GameHistoryComponent } from "../components/GameHistory.js";

export default class extends AbstractView {
	constructor() {
		super();
		this.setTitle("Profile");


	}


	async getHtml() {
		this.navbar = await Navbar.create();
		this.friendsComponent = await FriendsList.create();
		this.gameHistoryComponent = await GameHistoryComponent.create();
		this.profileDetailCard = await ProfileDetailCard.create();

		return `

	<div id="app-child-profile">
		
		${this.navbar.render()}
		<main class="container mt-5">
			<div class="row">
		
			<div class="col-6 offset-2 mt-3">
				${this.profileDetailCard.render()}
			</div>
			<div class="col-3 offset-1 mt-3">
      			${this.friendsComponent.render()}
    		</div>

			<div class="col-6 offset-2 mt-5">
				${this.gameHistoryComponent.render()}
			</div>
		</main>
	</div>
		`;
	}
}

