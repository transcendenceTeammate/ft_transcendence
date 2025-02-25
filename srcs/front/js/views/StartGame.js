import AbstractView from "./AbstractView.js";

export default class extends AbstractView {
    constructor() {
        super();
        this.setTitle("StartGame");
    }

    async loadElements() {
        try {
           
            this.navbar = await super.getNavbar();
        } catch (e) {
            console.log(e);
        }
    }

    async handleOldUser() {
        if (AbstractView.newUser){
            return
        }
        console.log('yeah its an old user gotta know their username!')
        await AbstractView.assignUsername();
        console.log(`And that username is: ${AbstractView.username}`)
    }

    async getHtml() {
        await this.handleOldUser();
       await this.loadElements();
        console.log(`wtf is with the avatar in Abstract View? ${AbstractView.avatar}`)
       
        return `
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
                                    <button class="btn btn-lg p-3 blackie startpage-btn" type="button">CLASSIC MODE</button>

                                </div>
                            </div>
                        </div>
                        <div class="row my-3 p-4">
                            <div class="col">
                                <div class="col">
                                    <div class="d-grid gap-2">
                                        <button class="btn btn-lg p-3 blackie startpage-btn" type="button">TOURNAMENT MODE</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="row my-3 p-4">
                            <div class="col-8 offset-2">
                                <div class="d-grid gap-2">
                                    <button class="btn btn-lg p-3 rounded-pill orangie fw-bold orangie startpage-btn" type="button">PLAY</button>
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
                data-bs-target="#play_game_div">PLAY GAME</button>
            <button type="button" class="btn btn-light btn-lg d-block my-5 py-4 startpage-btn" data-bs-toggle="modal"
                data-bs-target="#create_join_div">PLAY TOURNAMENT</button>
        </div>
    </main>
        </div>
        `
    }

}