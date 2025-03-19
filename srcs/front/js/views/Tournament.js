import AbstractView from "./AbstractView.js";

export default class Tournament extends AbstractView {
	constructor() {
		super();
		this.setTitle("Tournament");
		this.players = [];
	}

	async getHtml() {
		const response = await fetch('/htmls/tournament.html');
		if (!response.ok) {
			return '<h1>Failed to load the Tournament HTML</h1>';
		}
		return await response.text();
	}

	handlePlayerInput() {
		const numPlayersElement = document.getElementById("numPlayers");
		const playerContainer = document.getElementById("playerContainer");
		const playersTable = document.getElementById("playersTable");

		console.log("numPlayersElement:", numPlayersElement);
		console.log("playerContainer:", playerContainer);
		console.log("playersTable:", playersTable);

		if (!numPlayersElement || !playerContainer || !playersTable) {
			console.error('Required elements not found');
			return;
		}

		const numPlayers = numPlayersElement.value;
		playerContainer.innerHTML = '';
		playersTable.innerHTML = '';

		for (let i = 0; i < numPlayers; i++) {
			const div = document.createElement("div");
			div.classList.add("player-input");
			const input = document.createElement("input");
			input.type = "text";
			input.placeholder = `Player ${i + 1} Name`;
			input.id = `player${i + 1}`;
			input.addEventListener("input", this.updateStartButton.bind(this));
			div.appendChild(input);
			playerContainer.appendChild(div);
		}

		this.updateStartButton();
	}

	handleFormSubmit(event) {
		event.preventDefault();

		const numPlayersElement = document.getElementById("numPlayers");
		const playersTable = document.getElementById("playersTable");
		const errorMessage = document.getElementById("errorMessage");

		console.log("numPlayersElement:", numPlayersElement);
		console.log("playersTable:", playersTable);
		console.log("errorMessage:", errorMessage);

		if (!numPlayersElement || !playersTable || !errorMessage) {
			console.error('Required elements not found');
			return;
		}

		const numPlayers = numPlayersElement.value;
		this.players = [];

		errorMessage.style.display = 'none';
		playersTable.innerHTML = '';

		for (let i = 0; i < numPlayers; i++) {
			const playerName = document.getElementById(`player${i + 1}`).value.trim();
			if (playerName) {
				this.players.push(playerName);
			}
		}

		if (this.players.length !== parseInt(numPlayers)) {
			errorMessage.textContent = "Please enter all player names.";
			errorMessage.style.display = 'block';
			return;
		}

		this.players.forEach((player, index) => {
			const row = document.createElement("tr");
			const cell1 = document.createElement("td");
			const cell2 = document.createElement("td");

			cell1.textContent = index + 1;
			cell2.textContent = player;

			row.appendChild(cell1);
			row.appendChild(cell2);
			playersTable.appendChild(row);
		});

		this.updateStartButton();
	}

	updateStartButton() {
		const numPlayersElement = document.getElementById("numPlayers");
		const startButton = document.getElementById("startTournament");

		console.log("numPlayersElement:", numPlayersElement);
		console.log("startButton:", startButton);

		if (!numPlayersElement || !startButton) {
			console.error('Required elements not found');
			return;
		}

		const numPlayers = numPlayersElement.value;
		let allFilled = true;

		for (let i = 0; i < numPlayers; i++) {
			const playerName = document.getElementById(`player${i + 1}`)?.value.trim();
			if (!playerName) {
				allFilled = false;
				break;
			}
		}

		startButton.disabled = !allFilled;
	}

	init() {
		const numPlayersElement = document.getElementById("numPlayers");
		const playerFormElement = document.getElementById("playerForm");
		const startButtonElement = document.getElementById("startTournament");

		console.log("numPlayersElement:", numPlayersElement);
		console.log("playerFormElement:", playerFormElement);
		console.log("startButtonElement:", startButtonElement);

		if (!numPlayersElement || !playerFormElement || !startButtonElement) {
			console.error('Required elements not found');
			return;
		}

		numPlayersElement.addEventListener("change", this.handlePlayerInput.bind(this));
		playerFormElement.addEventListener("submit", this.handleFormSubmit.bind(this));
		startButtonElement.addEventListener("click", () => {
			localStorage.setItem('players', JSON.stringify(this.players));
			window.location.href = '/tournament-game';
		});

		this.handlePlayerInput();
	}

	onLoaded() {
		this.init();
	}

}

