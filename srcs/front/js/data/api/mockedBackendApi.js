export class MockedBackendApi {
    static async getUserData() {
        await new Promise(resolve => setTimeout(resolve, 100));
        return {
            username: "GuyTariste",
            avatar_url: "https://picsum.photos/200",
            friend_list: [
                {
                    username: "SophieStiqué",
                    avatar_url: "https://picsum.photos/200#1",
                    is_online: true
                },
                {
                    username: "BobIchon",
                    avatar_url: "https://picsum.photos/200#2",
                    is_online: false
                },
                {
                    username: "Fromage",
                    avatar_url: "https://picsum.photos/200#3",
                    is_online: true
                }
            ]
        };
    }

    static async getFriendList() {
        await new Promise(resolve => setTimeout(resolve, 100));
        return {
            friend_list: [
                {
                    username: "SophieStiqué",
                    avatar_url: "https://picsum.photos/200#1",
                    is_online: true
                },
                {
                    username: "BobIchon",
                    avatar_url: "https://picsum.photos/200#2",
                    is_online: false
                },
                {
                    username: "Fromage",
                    avatar_url: "https://picsum.photos/200#3",
                    is_online: true
                }
            ]
        }
    }

    static async uploadUserAvatar(image) {
        await new Promise(resolve => setTimeout(resolve, 100));
        return {
            image: "https://picsum.photos/200#4"
        };

    }

    static async setUsername(newUsername) {
        await new Promise(resolve => setTimeout(resolve, 100));
        return {
            "nickname": newUsername.charAt(0).toUpperCase() + newUsername.slice(1),
        };

    }
    

    static async getUserGameHistory() {
        await new Promise(resolve => setTimeout(resolve, 2000));

        const gameHistory = [
            {
            "PlayerA_nickname": "Alice",
            "PlayerA_score": 5,
            "PlayerA_isWinner": true,
            "PlayerB_nickname": "Bob",
            "PlayerB_score": 3,
            },
            {
            "PlayerA_nickname": "Charlie",
            "PlayerA_score": 2,
            "PlayerA_isWinner": false,
            "PlayerB_nickname": "David",
            "PlayerB_score": 6,
            },
            {
            "PlayerA_nickname": "Eve",
            "PlayerA_score": 7,
            "PlayerA_isWinner": true,
            "PlayerB_nickname": "Frank",
            "PlayerB_score": 4,
            },
            {
            "PlayerA_nickname": "Grace",
            "PlayerA_score": 3,
            "PlayerA_isWinner": true,
            "PlayerB_nickname": "Hank",
            "PlayerB_score": 1,
            },
            {
            "PlayerA_nickname": "Ivy",
            "PlayerA_score": 6,
            "PlayerA_isWinner": false,
            "PlayerB_nickname": "Jack",
            "PlayerB_score": 7,
            },
            {
            "PlayerA_nickname": "Kevin",
            "PlayerA_score": 4,
            "PlayerA_isWinner": false,
            "PlayerB_nickname": "Liam",
            "PlayerB_score": 5,
            },
            {
            "PlayerA_nickname": "Grace",
            "PlayerA_score": 3,
            "PlayerA_isWinner": true,
            "PlayerB_nickname": "Hank",
            "PlayerB_score": 1,
            },
            {
            "PlayerA_nickname": "Ivy",
            "PlayerA_score": 6,
            "PlayerA_isWinner": false,
            "PlayerB_nickname": "Jack",
            "PlayerB_score": 7,
            },
            {
            "PlayerA_nickname": "Kevin",
            "PlayerA_score": 4,
            "PlayerA_isWinner": false,
            "PlayerB_nickname": "Liam",
            "PlayerB_score": 5,
            },
        ];

        return gameHistory.sort(() => Math.random() - 0.5);
    }
}






