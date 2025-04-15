import { Component } from "../core/Component.js";
import { GameHistoryProvider } from "../data/providers/GameHistoryProvider.js";
import { MyProfileProvider } from "../data/providers/MyProfileProvider.js";


export class GameHistoryComponent extends Component {
    constructor() {
        super();

        this.gameHistory = [];
    }

    static async create() {
        let gameHistoryComponent = new GameHistoryComponent();
        await gameHistoryComponent.init();
        return gameHistoryComponent;
    }

    async init() {

    }

    _onLoaded()
    {
        let gameHistoryProvider = GameHistoryProvider.getInstance();

        gameHistoryProvider.historyStream.listen((history) => {
            this.gameHistory = history;
            this.updateComponent();
        });
        gameHistoryProvider.updateHistory();
    }

    _getComponentHtml() {
        return `
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
										<span class="badge ${game.result ? "win" : "lose"}">${game.result  ? "Win" : "Lose"}</span>
									</td>
								</tr>
							`).join('')}
						</tbody>
					</table>
				</div>
        `
    }
}