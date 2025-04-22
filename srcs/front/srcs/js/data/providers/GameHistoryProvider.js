import { Stream } from "../../core/Stream.js";
import { BackendApi } from "../api/backendApi.js";
import { MockedBackendApi } from "../api/mockedBackendApi.js";

function createHistoryRecord({ date = "", player1 = "", score1 = 0, player2 = "", score2 = 0, result = false } = {}) {
    return {
        date,
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

        let gameHistory = rawHistoryData.games.map((game) => {
            const formattedDate = new Date(game.game_date).toLocaleString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });

            return createHistoryRecord({
                date: formattedDate,
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
