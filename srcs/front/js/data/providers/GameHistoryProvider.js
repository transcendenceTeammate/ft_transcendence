import { Stream } from "../../core/Stream.js";
import { BackendApi } from "../api/backendApi.js";
import { MockedBackendApi } from "../api/mockedBackendApi.js";

function createHistoryRecord({ player1 = "", score1 = 0, player2 = "", score2 = 0, result = false } = {}) {
    return {
        player1,
        score1,
        player2,
        score2,
        result,
    };
}

export class GameHistoryProvider {
    static _instance = null;
    
    constructor() {
        this._backend = new BackendApi();
        this._history = Stream.withDefault([]);
    }

    async init() {
        this.updateProfile();
    }

    get historyStream() {
        return this._history;
    }

    async updateHistory() {
        let rawHistoryData = await this._backend.getUserGameHistory();

        let gameHistory = rawHistoryData.map((game) => {
            return createHistoryRecord({
            player1: game.PlayerA_nickname,
            score1: game.PlayerA_score,
            player2: game.PlayerB_nickname,
            score2: game.PlayerB_score,
            result: game.PlayerA_isWinner
            });
        });

        this._history.value = gameHistory;

        return this._history.value;
    }

    static getInstance() {
        if (GameHistoryProvider._instance == null) {
            GameHistoryProvider._instance = new GameHistoryProvider();
        }
        return GameHistoryProvider._instance;
    }
}
