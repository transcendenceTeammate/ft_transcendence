import { Component } from "../core/Component.js";
import { GameHistoryProvider } from "../data/providers/GameHistoryProvider.js";
import { MyProfileProvider } from "../data/providers/MyProfileProvider.js";


export class GameStatsComponent extends Component {
    constructor() {
        super();

      this.win_count = 0;
      this.lose_count = 0;
    }

      static async create() {
           let gameStatsComponent = new GameStatsComponent();
           await gameStatsComponent.init();
           return gameStatsComponent;
       }
   
       async init() {
   
       }
   
       _onLoaded()
       {
        //    let gameHistoryProvider = GameHistoryProvider.getInstance();
   
        //    gameHistoryProvider.historyStream.listen((history) => {
        //        this.gameHistory = history;
        //        this.updateComponent();
        //    });
        //    gameHistoryProvider.updateHistory();
    }

    _getComponentHtml() {
        return `
            <div class="stats-box">
                <h3>Stats</h3>
                <p><strong>Wins:</strong> ${this.win_count}</p>
                <p><strong>Losses:</strong> ${this.lose_count}</p>
            </div>
        `;
    }
}