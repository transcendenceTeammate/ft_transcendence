import AbstractView from "./AbstractView.js";
export default class Game extends AbstractView {
    constructor() {
        super();
        this.setTitle("Avatar");
    }

    async getHtml(){
        return `
        <div id="app-child-game">
        <section id="maincontain" class="container position-relative p-0 m-0">
        <div id="ball-game" class="rounded-circle position-absolute"></div>
        <div id="row-game" class="row border border-dark border-5 m-0 p-0 row-game">
            <div id="leftfield" class="col-6 m-0 p-0">
                <div class="row justify-content-start align-items-center m-0 row-game">
                    <div id="leftracket" class="m-0"></div>
                </div>
            </div>

            <div id="rightfield" class="col-6 m-0 p-0">
                <div class="row justify-content-end align-items-center m-0 row-game">
                    <div id="rightracket" class="m-0"></div>
                </div>
            </div>
        </div>
        
    </section>
        </div>
        `
    }
}