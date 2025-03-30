import AbstractView from "./AbstractView.js";
import { FriendsList } from "../components/FriendList.js";
import { Navbar } from "../components/Navbar.js";
import { ProfileDetailCard } from "../components/ProfileDetailCard.js";

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


	async getHtml() {
		this.navbar = await Navbar.create();
		this.friendsComponent = await FriendsList.create();
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

			</main>
		</div>
		`;
	}
}

