Here's a **summary of the HTTP request schema** based on the Django views and URLs provided in your code:

---

## 🔹 API Endpoints Schema

### 1. `POST /api/room/create/`
**Purpose:** Create a new game room.

#### Headers:
- `Authorization: Bearer <JWT Token>` _(optional)_

#### Request Body (JSON):
```json
{
  "username": "optional_username"
}
```

#### Response (JSON):
```json
{
  "success": true,
  "room_code": "ABCD1234",
  "player_number": 1,
  "player_id": "user-or-guest-id",
  "username": "player_username",
  "game_state": { ... }
}
```

---

### 2. `POST /api/room/join/`
**Purpose:** Join an existing room.

#### Headers:
- `Authorization: Bearer <JWT Token>` _(optional)_

#### Request Body (JSON):
```json
{
  "room_code": "ABCD1234",
  "username": "optional_username"
}
```

#### Response (JSON):
```json
{
  "success": true,
  "room_code": "ABCD1234",
  "player_number": 2,
  "player_id": "user-or-guest-id",
  "username": "player_username",
  "reconnecting": false,
  "game_state": { ... }
}
```

---

### 3. `GET /api/room/check/<room_code>/`
**Purpose:** Check the existence and status of a room.

#### Path Parameter:
- `room_code` — The code of the room to check

#### Response (JSON):
```json
{
  "success": true,
  "room_code": "ABCD1234",
  "status": "WAITING | ONGOING | FINISHED",
  "player_count": 2,
  "active_sessions": 2,
  "player_1_id": "...",
  "player_2_id": "...",
  "is_paused": false,
  "created_at": "2024-05-01T12:00:00Z"
}
```

---

## ⚠️ Notes:
- If the user is **not authenticated**, a guest ID will be generated (e.g., `guest-1234`).
- If a `username` is provided in the request body, it overrides the one in the JWT token.
- JWT is expected in the `Authorization` header as a Bearer token.

---

Would you like a similar schema for the WebSocket messages (`GameConsumer`)?