import AbstractView from "./AbstractView.js";
export default class extends AbstractView {
    constructor() {
        super();
        this.setTitle("404");
    }

    async getHtml() {
        return `
        <div id="app-child-404">
            <h1 id="nf-h" class="p-5 m-3 display-3 fw-bold"> 404 PAGE NOT FOUND</h1>
            <div id="pesets">
                <img src="../public/pesets.jpg" alt="pesets">
            </div>
        </div>
        `

    }
}