export class MockedBackendApi {

    constructor() {

    }

    async getUserData() {
        await new Promise(resolve => setTimeout(resolve, 100));
        return {
            nickname: "GuyTariste",
            avatar_url: "https://picsum.photos/200",
        };
    }

    async getFriendList() {
        await new Promise(resolve => setTimeout(resolve, 100));
        return {
            friends: [
                {
                    nickname: "SophieStiqué",
                    avatar_url: "https://picsum.photos/200#1",
                    is_online: true
                },
                {
                    nickname: "BobIchon",
                    avatar_url: "https://picsum.photos/200#2",
                    is_online: false
                },
                {
                    nickname: "SarahClure",
                    avatar_url: "https://picsum.photos/200#3",
                    is_online: true
                },
                {
                    nickname: "MarieHônnete",
                    avatar_url: "https://picsum.photos/200#4",
                    is_online: false
                },
                {
                    nickname: "LucRatif",
                    avatar_url: "https://picsum.photos/200#5",
                    is_online: true
                },
                {
                    nickname: "YcareAmel",
                    avatar_url: "https://picsum.photos/200#6",
                    is_online: false
                },
                {
                    nickname: "LanaRguilé",
                    avatar_url: "https://picsum.photos/200#7",
                    is_online: true
                },
                {
                    nickname: "OttoPsie",
                    avatar_url: "https://picsum.photos/200#8",
                    is_online: false
                },
                {
                    nickname: "ThibaultLognaise",
                    avatar_url: "https://picsum.photos/200#9",
                    is_online: true
                },
                {
                    nickname: "LaraClure",
                    avatar_url: "https://picsum.photos/200#10",
                    is_online: false
                },
                {
                    nickname: "JustineTitegoutte",
                    avatar_url: "https://picsum.photos/200#11",
                    is_online: true
                },
                {
                    nickname: "TerryDicule",
                    avatar_url: "https://picsum.photos/200#12",
                    is_online: false
                }
            ]
        }
    }


    async addFriend(image) {
        await new Promise(resolve => setTimeout(resolve, 100));
        return {
            friends: [
                {
                    nickname: "New One",
                    avatar_url: "https://picsum.photos/200#1000",
                    is_online: true
                },
                {
                    nickname: "SophieStiqué",
                    avatar_url: "https://picsum.photos/200#1",
                    is_online: true
                },
                {
                    nickname: "BobIchon",
                    avatar_url: "https://picsum.photos/200#2",
                    is_online: false
                },
                {
                    nickname: "SarahClure",
                    avatar_url: "https://picsum.photos/200#3",
                    is_online: true
                },
                {
                    nickname: "MarieHônnete",
                    avatar_url: "https://picsum.photos/200#4",
                    is_online: false
                },
                {
                    nickname: "LucRatif",
                    avatar_url: "https://picsum.photos/200#5",
                    is_online: true
                },
                {
                    nickname: "YcareAmel",
                    avatar_url: "https://picsum.photos/200#6",
                    is_online: false
                },
                {
                    nickname: "LanaRguilé",
                    avatar_url: "https://picsum.photos/200#7",
                    is_online: true
                },
                {
                    nickname: "OttoPsie",
                    avatar_url: "https://picsum.photos/200#8",
                    is_online: false
                },
                {
                    nickname: "ThibaultLognaise",
                    avatar_url: "https://picsum.photos/200#9",
                    is_online: true
                },
                {
                    nickname: "LaraClure",
                    avatar_url: "https://picsum.photos/200#10",
                    is_online: false
                },
                {
                    nickname: "JustineTitegoutte",
                    avatar_url: "https://picsum.photos/200#11",
                    is_online: true
                },
                {
                    nickname: "TerryDicule",
                    avatar_url: "https://picsum.photos/200#12",
                    is_online: false
                }
            ]
        }

    }



    async uploadUserAvatar(image) {
        await new Promise(resolve => setTimeout(resolve, 100));
        return {
            avatar_url: "https://picsum.photos/200#4"
        };

    }

    async setUsername(newUsername) {
        await new Promise(resolve => setTimeout(resolve, 100));
        return {
            nickname: newUsername.charAt(0).toUpperCase() + newUsername.slice(1),
        };

    }


    async getUserGameHistory() {
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






