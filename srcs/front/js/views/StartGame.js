import AbstractView from "./AbstractView.js";
import User from "../user/User.js";
import { Navbar } from "../components/Navbar.js";
import { assignAvatar, assignUsername } from "../user/UserApiCalls.js";

export default class StartGame extends AbstractView {
	constructor() {
		super();
		this.setTitle("StartGame");
		this.pollingInterval = null;
	}

	async loadElements() {
		try {
			this.buttonOne = await super.loadElement('bigButton1');
			this.waitingModal = await super.loadElement('waiting_modal');
			this.classicButton = await super.loadElement("classicButton");
			this.tournamentButton = await super.loadElement("tournamentButton");

			this.createGameButton = await super.loadElement("createGameButton");
			this.joinGameButton = await super.loadElement("button-addon2");
			this.roomCodeInput = await super.loadElement("roomCodeInput");
			this.roomCodeDisplay = await super.loadElement("roomCodeDisplay");
			this.closeWaitingModal = await super.loadElement("closeWaitingModal");
		} catch (e) {
			console.error("Error loading elements:", e);
		}
	}

	async attachAllJs() {
		await this.loadElements();

		if(this.classicButton) {
			this.classicButton.addEventListener('click', (e) => {
				e.preventDefault();
				takeMeThere(location.origin + '/game');
			});
		}

		if(this.tournamentButton) {
			this.tournamentButton.addEventListener('click', (e) => {
				e.preventDefault();
				takeMeThere(location.origin + '/tournament');
			});
		}

		if(this.createGameButton) {
			this.createGameButton.addEventListener('click', async (e) => {
				e.preventDefault();

				const currentModal = bootstrap.Modal.getInstance(document.getElementById('create_join_div'));
				if (currentModal) {
					currentModal.hide();
				}

				this.createGameButton.disabled = true;
				this.createGameButton.textContent = "Creating...";

				try {
					await this.createRoom();
				} catch (error) {
					console.error("Error creating room:", error);
					alert("Failed to create room: " + error.message);

					this.createGameButton.disabled = false;
					this.createGameButton.textContent = "CREATE GAME";
				}
			});
		}

		if(this.joinGameButton) {
			this.joinGameButton.addEventListener('click', async (e) => {
				e.preventDefault();

				this.joinGameButton.disabled = true;
				this.joinGameButton.textContent = "Joining...";

				try {
					await this.joinRoom();
				} catch (error) {
					console.error("Error joining room:", error);
					alert("Failed to join room. Please check the code and try again.");

					// Reset button state
					this.joinGameButton.disabled = false;
					this.joinGameButton.textContent = "JOIN GAME";
				}
			});

			if(this.roomCodeInput) {
				this.roomCodeInput.addEventListener('keyup', (e) => {
					if (e.key === 'Enter') {
						e.preventDefault();
						this.joinGameButton.click();
					}
				});
			}
		}

		if(this.closeWaitingModal) {
			this.closeWaitingModal.addEventListener('click', () => {
				if (this.pollingInterval) {
					clearInterval(this.pollingInterval);
					this.pollingInterval = null;
				}

				console.log("Waiting modal closed by user");
			});
		}
	}

	async createRoom() {
        try {
            console.log("Creating room...");

            this.createGameButton.disabled = true;
            this.createGameButton.textContent = "Creating...";

            const authToken = this.getAuthToken();

            const headers = {
                'Content-Type': 'application/json',
            };

            if (authToken) {
                headers['Authorization'] = `Bearer ${authToken}`;
            }

            const response = await fetch("https://api.app.10.24.102.1.nip.io:8443/api/room/create/", {
                method: 'POST',
                headers: headers,
                credentials: 'include',
                mode: 'cors'
            });

            console.log("Response status:", response.status);

            if (!response.ok) {
                console.error("Error response:", response.status, response.statusText);

                let errorDetails = "";
                try {
                    const errorData = await response.text();
                    errorDetails = errorData;
                    console.error("Error details:", errorDetails);
                } catch (e) {
                    console.error("Could not parse error details");
                }

                throw new Error(`HTTP error ${response.status}: ${errorDetails}`);
            }

            const data = await response.json();
            console.log("Room created successfully:", data);

            if(data.success) {
                if (!data.room_code) {
                    throw new Error("Server response missing room code");
                }

                console.log(`Room code created: ${data.room_code}`);

                localStorage.setItem('current_player_number', '1');
                localStorage.setItem('current_room_code', data.room_code);

                if (data.player_id) {
                    localStorage.setItem('current_player_id', data.player_id);
                }
                if (data.username) {
                    localStorage.setItem('current_username', data.username);
                }

                const waitingModal = new bootstrap.Modal(document.getElementById('waiting_modal'));
                waitingModal.show();

                const roomCodeValue = document.querySelector('#roomCodeDisplay .room-code-value');
                if (roomCodeValue) {
                    roomCodeValue.textContent = data.room_code;
                }

                const copyButton = document.getElementById('copyRoomCode');
                if (copyButton) {
                    copyButton.onclick = () => {
                        navigator.clipboard.writeText(data.room_code)
                            .then(() => {
                                copyButton.innerHTML = '<i class="bi bi-check"></i> Copied!';
                                setTimeout(() => {
                                    copyButton.innerHTML = '<i class="bi bi-clipboard"></i> Copy Room Code';
                                }, 2000);
                            })
                            .catch(err => {
                                console.error("Error copying room code: ", err);
                                const tempInput = document.createElement('input');
                                tempInput.value = data.room_code;
                                document.body.appendChild(tempInput);
                                tempInput.select();
                                document.execCommand('copy');
                                document.body.removeChild(tempInput);
                                copyButton.innerHTML = '<i class="bi bi-check"></i> Copied!';
                                setTimeout(() => {
                                    copyButton.innerHTML = '<i class="bi bi-clipboard"></i> Copy Room Code';
                                }, 2000);
                            });
                    };
                }

                const modalSubtext = document.querySelector('#waiting_modal .text-muted');
                if (modalSubtext) {
                    modalSubtext.innerHTML = `Share this code with your opponent: <strong>${data.room_code}</strong>`;
                }

                this.pollForSecondPlayer(data.room_code);
            } else {
                console.error("Error creating room:", data.error);
                alert(`Error creating room: ${data.error}`);

                if (this.createGameButton) {
                    this.createGameButton.disabled = false;
                    this.createGameButton.textContent = "CREATE GAME";
                }
            }
        } catch (error) {
            console.error("Error creating room:", error);

            alert(`Failed to create game room. Please try again. (${error.message})`);

            if (this.createGameButton) {
                this.createGameButton.disabled = false;
                this.createGameButton.textContent = "CREATE GAME";
            }
        }
    }

	async joinRoom() {
        if(!this.roomCodeInput) {
            console.error("Room code input not found");
            return;
        }

        let roomCode = this.roomCodeInput.value.trim().toUpperCase();

        if(!roomCode) {
            alert("Please enter a room code");

            if (this.joinGameButton) {
                this.joinGameButton.disabled = false;
                this.joinGameButton.textContent = "JOIN GAME";
            }

            this.roomCodeInput.focus();
            return;
        }

        const roomCodeRegex = /^[A-Z0-9]{6}$/;
        if (!roomCodeRegex.test(roomCode)) {
            alert("Invalid room code format. Room codes should be 6 alphanumeric characters.");

            if (this.joinGameButton) {
                this.joinGameButton.disabled = false;
                this.joinGameButton.textContent = "JOIN GAME";
            }

            this.roomCodeInput.focus();
            this.roomCodeInput.select();
            return;
        }

        try {
            this.joinGameButton.disabled = true;
            this.joinGameButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Joining...';

            const authToken = this.getAuthToken();

            const headers = {
                'Content-Type': 'application/json'
            };

            if (authToken) {
                headers['Authorization'] = `Bearer ${authToken}`;
            }

            try {
                const checkResponse = await fetch(`https://api.app.10.24.102.1.nip.io:8443/api/room/check/${roomCode}/`, {
                    method: 'GET',
                    headers: headers,
                    credentials: 'include'
                });

                const checkData = await checkResponse.json();

                if (!checkResponse.ok || !checkData.success) {
                    throw new Error(checkData.error || "Room not found");
                }

                if (checkData.player_count >= 2 && checkData.status !== 'WAITING') {
                    throw new Error("Room is full or game already started");
                }

                if (checkData.status === 'FINISHED') {
                    throw new Error("This game has already ended");
                }
            } catch (error) {
                console.error("Error checking room:", error);
                alert(`Error checking room: ${error.message}`);

                if (this.joinGameButton) {
                    this.joinGameButton.disabled = false;
                    this.joinGameButton.textContent = "JOIN GAME";
                }
                return;
            }

            const response = await fetch("https://api.app.10.24.102.1.nip.io:8443/api/room/join/", {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({ room_code: roomCode }),
                credentials: 'include'
            });

            const data = await response.json();

            if(data.success) {
                const joinModal = document.createElement('div');
                joinModal.className = 'modal fade';
                joinModal.id = 'joiningModal';
                joinModal.innerHTML = `
                    <div class="modal-dialog modal-dialog-centered">
                        <div class="modal-content">
                            <div class="modal-body text-center p-5">
                                <h4>Joining Game</h4>
                                <div class="spinner-border text-primary my-4" role="status">
                                    <span class="visually-hidden">Loading...</span>
                                </div>
                                <p>Connecting to room ${roomCode}...</p>
                            </div>
                        </div>
                    </div>
                `;
                document.body.appendChild(joinModal);

                const bsJoinModal = new bootstrap.Modal(joinModal);
                bsJoinModal.show();

                localStorage.setItem('current_room_code', data.room_code);
                localStorage.setItem('current_player_number', data.player_number.toString());

                if (data.player_id) {
                    localStorage.setItem('current_player_id', data.player_id);
                }
                if (data.username) {
                    localStorage.setItem('current_username', data.username);
                }

                setTimeout(() => {
                    this.cleanupModalsBeforeNavigation();

                    console.log("Joining room successful, navigating to game");

                    takeMeThere(location.origin + '/online-game?room=' + roomCode);
                }, 1000);
            } else {
                alert(`Error joining room: ${data.error || "Unknown error"}`);

                if (this.joinGameButton) {
                    this.joinGameButton.disabled = false;
                    this.joinGameButton.textContent = "JOIN GAME";
                }
            }
        } catch (error) {
            console.error("Error joining room:", error);
            alert(`Failed to join room: ${error.message}`);

            if (this.joinGameButton) {
                this.joinGameButton.disabled = false;
                this.joinGameButton.textContent = "JOIN GAME";
            }

            throw error;
        }
    }

	cleanupModalsBeforeNavigation() {
		document.querySelectorAll('.modal').forEach(modal => {
			try {
				const modalInstance = bootstrap.Modal.getInstance(modal);
				if (modalInstance) {
					modalInstance.hide();
				}
			} catch (e) {
				console.error("Error closing modal via Bootstrap API:", e);
			}
		});

		document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
			if (backdrop.parentNode) {
				backdrop.parentNode.removeChild(backdrop);
			}
		});

		document.body.classList.remove('modal-open');
		document.body.style.overflow = '';
		document.body.style.paddingRight = '';
	}

	pollForSecondPlayer(roomCode) {
        console.log("Starting to poll for second player for room:", roomCode);

        if(this.pollingInterval) {
            clearInterval(this.pollingInterval);
        }

        let pollCount = 0;
        let lastPlayerCount = 1;

        const authToken = this.getAuthToken();

        let errorCount = 0;
        let pollInterval = 2000;

        const updateWaitingText = (seconds) => {
            const waitingText = document.querySelector('#waiting_modal .fw-bold:not(.modal-title)');
            if (waitingText) {
                const timeDisplay = seconds > 60
                    ? `${Math.floor(seconds / 60)}m ${seconds % 60}s`
                    : `${seconds}s`;
                waitingText.textContent = `Waiting for opponent... (${timeDisplay})`;
            }
        };

        let waitingSeconds = 0;
        updateWaitingText(waitingSeconds);

        const waitingTimer = setInterval(() => {
            waitingSeconds++;
            updateWaitingText(waitingSeconds);
        }, 1000);

        this.pollingInterval = setInterval(async () => {
            try {
                pollCount++;

                const headers = {};
                if (authToken) {
                    headers['Authorization'] = `Bearer ${authToken}`;
                }

                const response = await fetch(`https://api.app.10.24.102.1.nip.io:8443/api/room/check/${roomCode}/`, {
                    method: 'GET',
                    headers: headers,
                    credentials: 'include',
                    mode: 'cors'
                });

                if (!response.ok) {
                    throw new Error(`HTTP error ${response.status}`);
                }

                const data = await response.json();

                if(data.success) {
                    errorCount = 0;

                    if (data.player_count > lastPlayerCount) {
                        const waitingText = document.querySelector('#waiting_modal .fw-bold:not(.modal-title)');
                        if (waitingText) {
                            waitingText.innerHTML = '<i class="bi bi-person-check"></i> Player found! Starting game...';
                        }

                        const spinner = document.querySelector('#waiting_modal .spinner-border');
                        if (spinner) {
                            spinner.className = 'text-success';
                            spinner.innerHTML = '<i class="bi bi-check-circle" style="font-size: 3rem;"></i>';
                        }
                    }

                    lastPlayerCount = data.player_count;

                    if(data.player_2_id) {
                        clearInterval(this.pollingInterval);
                        clearInterval(waitingTimer);
                        this.pollingInterval = null;

                        console.log("🎮 Player 2 has joined! Player IDs:", data.player_1_id, data.player_2_id);

                        const waitingText = document.querySelector('#waiting_modal .fw-bold:not(.modal-title)');
                        if (waitingText) {
                            waitingText.innerHTML = '<i class="bi bi-controller"></i> Player found! Starting game...';
                        }

                        const roomCodeDisplay = document.querySelector('#roomCodeDisplay');
                        if (roomCodeDisplay) {
                            roomCodeDisplay.classList.add('bg-success', 'text-white');
                            setTimeout(() => {
                                roomCodeDisplay.classList.remove('bg-success', 'text-white');
                            }, 500);
                        }

                        setTimeout(() => {
                            console.log("Redirecting to game room:", roomCode);

                            this.cleanupModalsBeforeNavigation();

                            window.location.href = location.origin + '/online-game?room=' + roomCode;
                        }, 800);
                    }
                } else {
                    console.error("Error checking room status:", data.error);

                    if (data.error && data.error.includes("not found")) {
                        clearInterval(this.pollingInterval);
                        clearInterval(waitingTimer);
                        this.pollingInterval = null;

                        alert("Room no longer exists. Please create a new room.");

                        try {
                            const modalInstance = bootstrap.Modal.getInstance(document.getElementById('waiting_modal'));
                            if (modalInstance) {
                                modalInstance.hide();
                            }
                        } catch (e) {
                            console.error("Error closing modal:", e);
                        }
                    }
                }
            } catch (error) {
                console.error("Error polling for second player:", error);
                errorCount++;

                if (errorCount > 3) {
                    console.log("Multiple errors detected, slowing down polling");
                    clearInterval(this.pollingInterval);
                    pollInterval = 5000;

                    this.pollingInterval = setInterval(() => {
                        this.pollForSecondPlayer(roomCode);
                    }, pollInterval);

                    const waitingText = document.querySelector('#waiting_modal .fw-bold:not(.modal-title)');
                    if (waitingText) {
                        waitingText.innerHTML = '<i class="bi bi-exclamation-triangle"></i> Connection issues. Still waiting...';
                    }
                }
            }
        }, pollInterval);
    }

	getAuthToken() {
		function getCookie(name) {
			let cookieValue = null;
			if (document.cookie && document.cookie !== '') {
				const cookies = document.cookie.split(';');
				for (let i = 0; i < cookies.length; i++) {
					const cookie = cookies[i].trim();
					if (cookie.substring(0, name.length + 1) === (name + '=')) {
						cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
						break;
					}
				}
			}
			return cookieValue;
		}

		const cookieToken = getCookie('access_token');
		const accessToken = localStorage.getItem('access_token');

		return cookieToken || accessToken || null;
	}

    async getHtml() {
	   this.navbar = await Navbar.create();


        this.attachAllJs();

        return   `
        <div id="app-child-start">

            <div class="modal" tabindex="-1" id="waiting_modal">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content border border-black border-5 rounded-0">
                        <div class="modal-header">
                            <h5 class="modal-title text-center w-100 fw-bold">Waiting for Opponent</h5>
                            <button type="button" id="closeWaitingModal" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>

                        <!-- Room code display area -->
                        <div class="room-code-container p-3 mb-3 text-center">
                            <div id="roomCodeDisplay" class="py-3 px-2 mx-auto" style="max-width: 300px; background-color: #f8f9fa; border-radius: 6px;">
                                Room code: <span class="room-code-value" style="font-size: 28px; font-weight: bold; letter-spacing: 2px;">--</span>
                            </div>
                            <button id="copyRoomCode" class="btn btn-sm btn-outline-secondary mt-2">
                                <i class="bi bi-clipboard"></i> Copy Room Code
                            </button>
                        </div>

                        <div class="modal-body">
                            <div class="container-fluid">
                                <div class="row my-3">
                                    <div class="col text-center">
                                        <div class="spinner-border text-primary" role="status" style="width: 3rem; height: 3rem;">
                                            <span class="visually-hidden">Loading...</span>
                                        </div>
                                    </div>
                                </div>
                                <div class="row my-3">
                                    <div class="col">
                                        <h4 class="fw-bold text-center">Waiting for opponent...</h4>
                                    </div>
                                </div>
                                <div class="row my-2">
                                    <div class="col text-center">
                                        <p class="text-muted">Share this code with your opponent</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal" tabindex="-1" id="play_game_div">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content border border-black border-5 rounded-0">
                        <div class="modal-header">
                            <div class="container">
                                <div class="row">
                                    <div class="col-4 offset-4">
                                        <h2 class="modal-title fw-bold text-center">MODE</h2>
                                    </div>
                                    <div class="col-1 ms-auto border-start">
                                        <button type="button" class="btn-close" data-bs-dismiss="modal"
                                            aria-label="Close"></button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="modal-body">
                            <div class="container-fluid">
                                <div class="row my-3 p-4">
                                    <div class="col">
                                        <div class="d-grid gap-2">
                                            <button class="btn btn-lg p-3 blackie startpage-btn" type="button" id="classicButton" data-bs-dismiss="modal">CLASSIC MODE</button>

                                        </div>
                                    </div>
                                </div>
                                <div class="row my-3 p-4">
                                    <div class="col">
                                        <div class="col">
                                            <div class="d-grid gap-2">
                                                <button class="btn btn-lg p-3 blackie startpage-btn" type="button" id="tournamentButton" data-bs-dismiss="modal">TOURNAMENT MODE</button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal" tabindex="-1" id="create_join_div">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content border border-dark border-5 rounded-0">
                        <div class="modal-header">
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body m-3">
                            <div class="container-fluid">
                                <div class="row my-3 p-4">
                                    <div class="col">
                                        <div class="d-grid gap-2">
                                            <button id="createGameButton" class="btn btn-lg p-3 blackie startpage-btn" type="button">CREATE GAME</button>
                                        </div>
                                    </div>
                                </div>
                                <div class="row my-3 p-4">
                                    <div class="col">
                                        <div class="input-group mb-3">
                                            <input id="roomCodeInput" type="text" class="form-control" placeholder="Game code"
                                                aria-label="Game code" aria-describedby="button-addon2">
                                            <button class="btn p-3 fw-bold blackie" type="button" id="button-addon2">JOIN GAME</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            ${this.navbar.render()}

            <main class="container mt-5" id="start-main">
                <div class="col-10 offset-1 d-flex flex-column  justify-content-center" id="startPageButtonDiv">
                    <button class="btn btn-light btn-lg d-block my-5 py-4 startpage-btn" data-bs-toggle="modal"
                        data-bs-target="#play_game_div" id='bigButton1'>PLAY LOCAL</button>
                    <button type="button" class="btn btn-light btn-lg d-block my-5 py-4 startpage-btn" data-bs-toggle="modal"
                        data-bs-target="#create_join_div">PLAY ONLINE</button>
                </div>
            </main>
        </div>
        `;
	}

	async onLoaded() {
		super.onLoaded && super.onLoaded();

		this.attachAllJs();
	}
}