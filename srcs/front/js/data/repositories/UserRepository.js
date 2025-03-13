import { BackendApi } from "../api/backendApi";
import { MockedBackendApi } from "../api/mockedBackendApi";


class UserModel
{
    constructor (username, avatarUrl)
    {
        
    }


}


export class UserRepository {
    static _backend = BackendApi();

    constructor ()
    {
        this.user = null;
    }

    async getUserData() {
        userData = _backend.getUserData();

        return {
            username: userData.username,
            profile_picture_url: userData.profile_picture_url
        };
    }

}
