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

	setTitle(title) {
		document.title = title;
	}

	handlePlayerInput() {
		const numPlayers = document.getElementById("numPlayers").value;
		const playerContainer = document.getElementById("playerContainer");
		const playersTable = document.getElementById("playersTable");

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
	
		const numPlayers = document.getElementById("numPlayers").value;
		const playersTable = document.getElementById("playersTable");
		const errorMessage = document.getElementById("errorMessage");
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
		const numPlayers = document.getElementById("numPlayers").value;
		const startButton = document.getElementById("startTournament");

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
		document.getElementById("numPlayers").addEventListener("change", this.handlePlayerInput.bind(this));
		document.getElementById("playerForm").addEventListener("submit", this.handleFormSubmit.bind(this));
		document.getElementById("startTournament").addEventListener("click", () => alert("Tournament Started!"));

		this.handlePlayerInput();
	}

	static initialize() {
		const tournament = new Tournament();
		tournament.init();
	}
}

window.onload = () => Tournament.initialize();
