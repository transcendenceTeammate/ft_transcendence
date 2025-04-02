from datetime import datetime, timedelta
import logging

EXPIRATION = timedelta(seconds=10)

# user_id: {"last_seen": datetime, "status": "available"}
_userPresence = {}

def set_user_status(user_id, status):
    _userPresence[user_id] = {
        "last_seen": datetime.utcnow(),
        "status": status
    }

def update_ping(user_id):
    print(f"Updating ping for user_id: {user_id}")
    logger = logging.getLogger(__name__)
    logger.info(f"Ping updated for user_id: {user_id}")
    logger.info(_userPresence)
    if user_id in _userPresence:
        _userPresence[user_id]["last_seen"] = datetime.utcnow()

def get_user_status(user_id):
    data = _userPresence.get(user_id)
    if not data:
        return "offline"
    if datetime.utcnow() - data["last_seen"] > EXPIRATION:
        return "offline"
    return data["status"]

def is_user_connected(user_id):
    logger = logging.getLogger(__name__)
    logger.info(f"check: {user_id}")
    logger.info(_userPresence)
    data = _userPresence.get(user_id)
    if not data:
        return False
    return datetime.utcnow() - data["last_seen"] <= EXPIRATION and data["status"] != "offline"




def remove_user(user_id):
    _userPresence.pop(user_id, None)

def get_all_statuses():
    now = datetime.utcnow()
    return {
        uid: data["status"]
        if now - data["last_seen"] < EXPIRATION
        else "offline"
        for uid, data in _userPresence.items()
    }
