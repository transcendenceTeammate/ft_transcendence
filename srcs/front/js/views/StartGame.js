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
        <div id="app-child-start">` + this.navbar +
        

    `<main class="container mt-5" id="start-main">
        <div class="col-10 offset-1 d-flex flex-column  justify-content-center" id="startPageButtonDiv">
            <button class="btn btn-light btn-lg d-block my-5 py-4 startpage-btn">PLAY GAME</button>
            <button class="btn btn-light btn-lg d-block my-5 py-4 startpage-btn">PLAY TOURNAMENT</button>
        </div>
    </main>
        </div>
        `
    }

}