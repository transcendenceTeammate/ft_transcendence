import AbstractView from "./AbstractView.js";

export default class extends AbstractView {
    constructor() {
        super();
        this.setTitle("StartGame");
    }

    async loadElements() {
        try {
            // this.avatars = await super.loadAllElements('.avatar-item');
            // this.dropZone = await super.loadElement('circle');
            // this.upload = await super.loadElement('upload');
            // this.usernameHeading = await super.loadElement('username-h')
        } catch (e) {
            console.log(e);
        }
    }

    async getHtml() {
        return `
        <div id="app-child-start">
        <nav class="navbar navbar-expand-lg bg-body-tertiary">
        <div class="container-fluid">
            <a class="navbar-brand" href="#"><span id="st-peng">Peng</span><span id="st-pong">Pong</span></a>
            <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarText"
                aria-controls="navbarText" aria-expanded="false" aria-label="Toggle navigation">
                <span class="navbar-toggler-icon"></span>
            </button>
            <div class="collapse navbar-collapse" id="navbarText">
                <ul class="navbar-nav me-auto mb-2 mb-lg-0">
                    <li class="nav-item">
                        <a class="nav-link active" aria-current="page" href="#">My profile</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="#">All players</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="#">Smth else</a>
                    </li>
                </ul>
                <a href="profile.html" class="nav-link">
                    <img src="../public/avatars/default/peng_head_def.png" alt="default penguin"
                        class="rounded-circle border border-black" height="35" id="nav-avatar">
                    <span>${AbstractView.username}</span>
                </a>

            </div>
        </div>
    </nav>

    <main class="container mt-5" id="start-main">
        <div class="col-10 offset-1 d-flex flex-column  justify-content-center" id="startPageButtonDiv">
            <button class="btn btn-light btn-lg d-block my-5 py-4 startpage-btn">PLAY GAME</button>
            <button class="btn btn-light btn-lg d-block my-5 py-4 startpage-btn">PLAY TOURNAMENT</button>
        </div>
    </main>
        </div>
        `
    }

}