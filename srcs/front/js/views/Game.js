import AbstractView from "./AbstractView.js";
export default class Game extends AbstractView {
    constructor() {
        super();
        this.setTitle("Avatar");
    }

    async getHtml(){
        return ``
    }
}