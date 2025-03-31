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
}
