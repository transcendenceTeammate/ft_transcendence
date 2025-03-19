import { MockedBackendApi } from "../api/mockedBackendApi.js";


export class UserRepository {
    static _instance = null;
    static _backend = MockedBackendApi;

    constructor() {
        this.user = null;
    }

    async getUserData() {
        if (this.user != null)
            return this.user;
        let rawUserData = await UserRepository._backend.getUserData();

        let userData = {
            username: rawUserData.USerName,
            avatarUrl: rawUserData.avatar_url
        };
        this.user = userData;

        return userData;
    }

    async setAvatar() {
        this.user = null;
    }

    static getInstance() {
        if (UserRepository._instance == null) {
            UserRepository._instance = new UserRepository();
        }
        return UserRepository._instance;
    }
}
