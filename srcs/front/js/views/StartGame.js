import AbstractView from "./AbstractView.js";
import User from "../user/User.js";
import Navbar from "./Navbar.js";
import { assignAvatar, assignUsername } from "../user/UserApiCalls.js";
import User from "../user/User.js";
import Navbar from "./Navbar.js";
import { assignAvatar, assignUsername } from "../user/UserApiCalls.js";

export default class StartGame extends AbstractView {
	constructor() {
		super();
		this.setTitle("StartGame");
	}

	async loadElements() {
		try {
			this.buttonOne = await super.loadElement('bigButton1')
			this.waitingModal = await super.loadElement('waiting_modal')
			this.classicButton = await super.loadElement("classicButton");
			this.tournamentButton = await super.loadElement("tournamentButton");

		} catch (e) {
			console.log(e);
		}
	}

    async createNavbar() {
        if (AbstractView.me === null)
        {
            const username = await assignUsername();
            const avatar = assignAvatar();
            AbstractView.me = new User(username, avatar, null, true)
        }
            this.navbar = await new Navbar().getHtml();
    }

	async attachAllJs() {
		
		await this.loadElements();
		this.classicButton.addEventListener('click', (e) => {
			e.preventDefault();
			takeMeThere(location.origin + '/game')
		})

		this.tournamentButton.addEventListener('click', (e) => {
			e.preventDefault();
			takeMeThere(location.origin + '/tournament')
		})
	}

    async getHtml() {
       await this.createNavbar();
       await this.createNavbar();
       
        this.attachAllJs();

        return   `
        <div id="app-child-start">` +
       
       
            `<div class="modal" tabindex="-1" id="waiting_modal">
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content border border-black border-5 rounded-0" >
                <div class="modal-header">
                    <div class="container">
                        <div class="row">
                            <div class="col-5 offset-6">
                                <p class="text-center" style="background-color: #e5e5e5;">Room code: 12345</p>
                            </div>
                            <div class="col-1">
                                <button type="button" class="btn-close" data-bs-dismiss="modal"
                                    aria-label="Close"></button>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-body">
                    <div class="container-fluid">
                        <div class="row my-3">
                            <div class="col">
                                <div class="d-flex justify-content-center">
                                    <h1 class="fw-bold">Waiting...</h1>
                                </div>
                            </div>
                        </div>
                        <div class="row my-3 py-3">
                            <div class="col-6 d-flex justify-content-center">
                                <button class="btn   btn-lg py-3 px-5 blackie startpage-btn" type="button" >PLAYER 1</button>
                            </div>
                            <div class="col-6 d-flex justify-content-center">
                                <button class="btn btn-lg py-3 px-5 blackie startpage-btn" type="button" >.................</button>
                            </div>
                        </div>
                        <div class="row my-3 p-4">
                            <div class="col-8 offset-2">
                                <div class="d-grid gap-2">
                                    <button class="btn btn-lg p-3 rounded-pill fw-bold orangie startpage-btn"  type="button">PLAY</button>
                                </div>
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
									<button class="btn btn-lg p-3 blackie startpage-btn" type="button" data-bs-toggle="modal"
										data-bs-target="#waiting_modal" data-bs-toggle="modal">CREATE GAME</button>

								</div>
							</div>
						</div>
						<div class="row my-3 p-4">
							<div class="col">
								<div class="input-group mb-3">
									<input type="text" class="form-control" placeholder="Game code"
										aria-label="Game code" aria-describedby="button-addon2">
									<button class="btn  p-3 fw-bold blackie" type="button" id="button-addon2"
										data-bs-target="#waiting_modal" data-bs-toggle="modal">JOIN GAME</button>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
		` +

        this.navbar +


			`<main class="container mt-5" id="start-main">
		<div class="col-10 offset-1 d-flex flex-column  justify-content-center" id="startPageButtonDiv">
			<button class="btn btn-light btn-lg d-block my-5 py-4 startpage-btn" data-bs-toggle="modal"
				data-bs-target="#play_game_div" id='bigButton1'>PLAY LOCAL</button>
			<button type="button" class="btn btn-light btn-lg d-block my-5 py-4 startpage-btn" data-bs-toggle="modal"
				data-bs-target="#create_join_div">PLAY ONLINE</button>
		</div>
	</main>
		</div>
		`
	}

}