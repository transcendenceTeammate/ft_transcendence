import CONFIG from "../config.js";

export default class User {
    constructor(name, userpic, type, me) {
        this.name = name;
        this.userpic = userpic;
        this.type = type;
        this.me = me;
        this.friends = [];
    }



    updateName(name){ if (!me) return; this.name = name;}

    updateAvatar(avatar) {if (!me) return; this.avatar = avatar;}

    getUserInfo() {
        return {
            name: this.name,
            userpic: this.userpic,
            type: this.type,
            friends: this.friends
        };
    }

    addFriend(friend) {
        if (friend instanceof User) {
            this.friends.push(friend);
        } else {
            console.error('Friend must be an instance of User');
        }
    }

    removeFriend(friend) {
        this.friends = this.friends.filter(f => f !== friend);
    }

}
