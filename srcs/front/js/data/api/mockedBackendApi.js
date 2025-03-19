export class MockedBackendApi {
    static async getUserData() {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return {
            username: "GuyTariste",
            avatar_url: "https://picsum.photos/200"
        };
    }
}
