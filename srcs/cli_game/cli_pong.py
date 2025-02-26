import curses
import requests
import json
import os
import websocket
import threading
import time

USER_MGMT_URL = "http://user_management:8000"
PONG_GAME_URL = "http://pong_game:8000"

class AuthenticationError(Exception):
    pass

def login(username, password):
    try:
        session = requests.Session()
        
        response = session.post(
            f"{USER_MGMT_URL}/login/",
            json={"username": username, "password": password},
            headers={
                "Content-Type": "application/json",
                "Host": "localhost:8000"
            }
        )
        
        try:
            response_data = response.json()
        except json.JSONDecodeError:
            raise AuthenticationError(f"Server response: {response.text}")
            
        if response.status_code == 200:
            access_token = response.cookies.get('access_token')
            if not access_token:
                raise AuthenticationError("No access token in cookies")
            return {
                'username': username,
                'access_token': access_token,
                'session': session,
                **response_data
            }
        else:
            raise AuthenticationError(f"Login failed: {response_data.get('error', 'Unknown error')}")
    except requests.RequestException as e:
        raise AuthenticationError(f"Connection error: {str(e)}")

def signup(username, password):
    try:
        session = requests.Session()
        
        response = session.post(
            f"{USER_MGMT_URL}/signup/",
            json={"username": username, "password": password},
            headers={
                "Content-Type": "application/json",
                "Host": "localhost:8000"
            }
        )
        try:
            response_data = response.json()
        except json.JSONDecodeError:
            raise AuthenticationError(f"Server response: {response.text}")
            
        if response.status_code == 200:
            access_token = response.cookies.get('access_token')
            if not access_token:
                raise AuthenticationError("No access token in cookies")
            return {
                'username': username,
                'access_token': access_token,
                'session': session,
                **response_data
            }
        elif response.status_code == 400:
            raise AuthenticationError(f"Signup failed: {response_data.get('detail', response_data)}")
        else:
            raise AuthenticationError(f"Signup failed with status {response.status_code}: {response_data}")
    except requests.RequestException as e:
        raise AuthenticationError(f"Connection error: {str(e)}")

def get_string(stdscr, prompt, y, x):
    curses.echo()
    stdscr.addstr(y, x, prompt)
    stdscr.refresh()
    input_str = stdscr.getstr(y, x + len(prompt), 30).decode('utf-8')
    curses.noecho()
    return input_str

def handle_login(stdscr):
    stdscr.clear()
    try:
        username = get_string(stdscr, "Username: ", 2, 2)
        password = get_string(stdscr, "Password: ", 3, 2)
        
        result = login(username, password)
        stdscr.addstr(5, 2, "Login successful!", curses.A_BOLD)
        stdscr.addstr(6, 2, f"Access Token: {result['access_token']}", curses.A_BOLD)
        
        if 'id' in result:
            result['user_id'] = result['id']
        elif 'userId' in result:
            result['user_id'] = result['userId']
        elif 'ID' in result:
            result['user_id'] = result['ID']
        else:
            result['user_id'] = username  # Fallback to using username as ID
        
        stdscr.addstr(15, 2, "Press any key to continue...")
        stdscr.refresh()
        stdscr.getch()
        return result
    except AuthenticationError as e:
        stdscr.addstr(5, 2, f"Error: {str(e)}", curses.A_BOLD)
        stdscr.addstr(6, 2, "Press any key to continue...")
        stdscr.refresh()
        stdscr.getch()
        return None

def handle_signup(stdscr):
    stdscr.clear()
    try:
        username = get_string(stdscr, "Choose username: ", 2, 2)
        password = get_string(stdscr, "Choose password: ", 3, 2)
        
        result = signup(username, password)
        stdscr.addstr(5, 2, "Signup successful! Please login.", curses.A_BOLD)
        stdscr.addstr(6, 2, f"Access Token: {result['access_token']}", curses.A_BOLD)
        
        if 'id' in result:
            result['user_id'] = result['id']
        elif 'userId' in result:
            result['user_id'] = result['userId']
        elif 'ID' in result:
            result['user_id'] = result['ID']
        else:
            result['user_id'] = username
            
        stdscr.addstr(7, 2, "Press any key to continue...")
        stdscr.refresh()
        stdscr.getch()
        return result
    except AuthenticationError as e:
        stdscr.addstr(5, 2, f"Error: {str(e)}", curses.A_BOLD)
        stdscr.addstr(6, 2, "Press any key to continue...")
        stdscr.refresh()
        stdscr.getch()
        return None

def create_game(session, user_id):
    try:
        response = session.post(
            f"{PONG_GAME_URL}/api/game/create",
            json={"user_id": user_id},
            headers={
                "Content-Type": "application/json",
                "Host": "localhost:8000"
            }
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            return {"error": f"Failed to create game: {response.text}"}
    except requests.RequestException as e:
        return {"error": f"Connection error: {str(e)}"}

def join_game(session, user_id, room_code):
    try:
        response = session.post(
            f"{PONG_GAME_URL}/api/game/join",
            json={"user_id": user_id, "room_code": room_code},
            headers={
                "Content-Type": "application/json",
                "Host": "localhost:8000"
            }
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            return {"error": f"Failed to join game: {response.text}"}
    except requests.RequestException as e:
        return {"error": f"Connection error: {str(e)}"}

def connect_to_websocket(room_code, on_message, on_error=None, on_close=None):
    ws_url = f"ws://pong_game:8000/ws/game/{room_code}/"
    
    def on_open(ws):
        print(f"WebSocket connection opened to room {room_code}")
    
    ws = websocket.WebSocketApp(
        ws_url,
        on_open=on_open,
        on_message=on_message,
        on_error=on_error if on_error else lambda ws, error: print(f"Error: {error}"),
        on_close=on_close if on_close else lambda ws, close_status_code, close_msg: print("Connection closed")
    )
    
    wst = threading.Thread(target=ws.run_forever)
    wst.daemon = True
    wst.start()
    
    return ws

def handle_create_game(stdscr, user_data):
    stdscr.clear()
    stdscr.addstr(0, 0, "Creating a new game room...", curses.A_BOLD)
    stdscr.refresh()
    
    session = user_data.get('session')
    user_id = user_data.get('user_id')
    
    if not user_id:
        stdscr.clear()
        stdscr.addstr(2, 0, "Error: User ID not found in login data", curses.A_BOLD)
        stdscr.addstr(4, 0, "Press any key to return to menu...")
        stdscr.refresh()
        stdscr.getch()
        return None
    
    result = create_game(session, user_id)
    
    if "error" in result:
        stdscr.clear()
        stdscr.addstr(2, 0, f"Error: {result['error']}", curses.A_BOLD)
        stdscr.addstr(4, 0, "Press any key to return to menu...")
        stdscr.refresh()
        stdscr.getch()
        return None
    
    room_code = result.get('room_code')
    
    stdscr.clear()
    stdscr.addstr(0, 0, f"Game room created successfully!", curses.A_BOLD)
    stdscr.addstr(2, 0, "ROOM CODE:", curses.A_BOLD)
    stdscr.addstr(3, 0, f"┌{'─' * (len(room_code) + 2)}┐")
    stdscr.addstr(4, 0, f"│ {room_code} │")
    stdscr.addstr(5, 0, f"└{'─' * (len(room_code) + 2)}┘")
    stdscr.addstr(7, 0, "Share this code with the second player")
    stdscr.addstr(9, 0, "Waiting for player 2 to join...")
    stdscr.addstr(11, 0, "Press 'q' to quit waiting")
    stdscr.refresh()
    
    game_state = {}
    
    def on_message(ws, message):
        nonlocal game_state
        data = json.loads(message)
        if data.get('event_type') == 'game_state':
            game_state = data.get('data', {})
    
    ws = connect_to_websocket(room_code, on_message)
    
    curses.halfdelay(5)
    while True:
        try:
            key = stdscr.getch()
            if key == ord('q'):
                ws.close()
                return None
                
            if game_state.get('player_2_id'):
                stdscr.clear()
                stdscr.addstr(0, 0, "Player 2 has joined! Starting game...", curses.A_BOLD)
                stdscr.refresh()
                time.sleep(2)
                play_game(stdscr, ws, room_code, 1, game_state)
                break
                
            stdscr.addstr(9, 0, "Waiting for player 2 to join...            ")
            stdscr.refresh()
        except curses.error:
            pass
    
    curses.nocbreak()
    stdscr.nodelay(False)
    return None

def handle_join_game(stdscr, user_data):
    stdscr.clear()
    room_code = get_string(stdscr, "Enter Room Code: ", 2, 2)
    
    if not room_code:
        return None
    
    stdscr.clear()
    stdscr.addstr(0, 0, "Joining game room...", curses.A_BOLD)
    stdscr.refresh()
    
    session = user_data.get('session')
    user_id = user_data.get('user_id')
    
    if not user_id:
        stdscr.clear()
        stdscr.addstr(2, 0, "Error: User ID not found in login data", curses.A_BOLD)
        stdscr.addstr(4, 0, "Press any key to return to menu...")
        stdscr.refresh()
        stdscr.getch()
        return None
    
    result = join_game(session, user_id, room_code)
    
    if "error" in result:
        stdscr.clear()
        stdscr.addstr(2, 0, f"Error: {result['error']}", curses.A_BOLD)
        stdscr.addstr(4, 0, "Press any key to return to menu...")
        stdscr.refresh()
        stdscr.getch()
        return None
    
    stdscr.clear()
    stdscr.addstr(0, 0, "Successfully joined the game!", curses.A_BOLD)
    stdscr.refresh()
    
    game_state = {}
    
    def on_message(ws, message):
        nonlocal game_state
        data = json.loads(message)
        if data.get('event_type') == 'game_state':
            game_state = data.get('data', {})
    
    ws = connect_to_websocket(room_code, on_message)
    
    time.sleep(1)
    
    play_game(stdscr, ws, room_code, 2, game_state)
    
    return None

def play_game(stdscr, ws, room_code, player_nb, initial_game_state):
    curses.curs_set(0)
    stdscr.clear()
    
    game_state = initial_game_state
    player_moving_up = False
    player_moving_down = False
    
    def send_key_event(key, action):
        ws.send(json.dumps({
            "event_type": "key_event",
            "data": {
                "room_code": room_code,
                "player_nb": player_nb,
                "key": key,
                "action": action
            }
        }))
    
    stdscr.nodelay(True)
    
    running = True
    while running:
        try:
            key = stdscr.getch()
            if key == ord('q'):
                running = False
            elif key == ord('w') and player_nb == 1:
                if not player_moving_up:
                    player_moving_up = True
                    send_key_event('w', 'keydown')
            elif key == ord('s') and player_nb == 1:
                if not player_moving_down:
                    player_moving_down = True
                    send_key_event('s', 'keydown')
            elif key == curses.KEY_UP and player_nb == 2:
                if not player_moving_up:
                    player_moving_up = True
                    send_key_event('ArrowUp', 'keydown')
            elif key == curses.KEY_DOWN and player_nb == 2:
                if not player_moving_down:
                    player_moving_down = True
                    send_key_event('ArrowDown', 'keydown')
            elif key == -1:
                if player_moving_up:
                    player_moving_up = False
                    if player_nb == 1:
                        send_key_event('w', 'keyup')
                    else:
                        send_key_event('ArrowUp', 'keyup')
                if player_moving_down:
                    player_moving_down = False
                    if player_nb == 1:
                        send_key_event('s', 'keyup')
                    else:
                        send_key_event('ArrowDown', 'keyup')
        except curses.error:
            pass
        
        stdscr.clear()
        
        stdscr.addstr(0, 0, "CLI PONG GAME", curses.A_BOLD)
        stdscr.addstr(1, 0, f"You are Player {player_nb}", curses.A_BOLD)
        stdscr.addstr(2, 0, "Press 'q' to quit, 'w'/'s' or UP/DOWN arrows to move", curses.A_BOLD)
        
        p1_score = game_state.get('player_1_score', 0)
        p2_score = game_state.get('player_2_score', 0)
        stdscr.addstr(4, 10, f"Player 1: {p1_score}  |  Player 2: {p2_score}")
        
        height, width = stdscr.getmaxyx()
        field_width = min(60, width - 4)
        field_height = min(20, height - 8)
        
        orig_width = game_state.get('canvas_width', 800)
        orig_height = game_state.get('canvas_height', 600)
        scale_x = field_width / orig_width
        scale_y = field_height / orig_height
        
        for i in range(field_height + 2):
            if i == 0 or i == field_height + 1:
                stdscr.addstr(i + 6, 2, '+' + '-' * field_width + '+')
            else:
                stdscr.addstr(i + 6, 2, '|' + ' ' * field_width + '|')
        
        p1_y = game_state.get('player_1_paddle_y', 250)
        p2_y = game_state.get('player_2_paddle_y', 250)
        paddle_height = 5
        
        p1_scaled_y = int(p1_y * scale_y)
        p2_scaled_y = int(p2_y * scale_y)
        
        for i in range(paddle_height):
            if 0 <= p1_scaled_y + i < field_height:
                stdscr.addstr(p1_scaled_y + i + 7, 4, '|')
            if 0 <= p2_scaled_y + i < field_height:
                stdscr.addstr(p2_scaled_y + i + 7, field_width, '|')
        
        ball_x = game_state.get('ball_x', 400)
        ball_y = game_state.get('ball_y', 300)
        
        ball_scaled_x = int(ball_x * scale_x)
        ball_scaled_y = int(ball_y * scale_y)
        
        if 0 <= ball_scaled_y < field_height and 0 <= ball_scaled_x < field_width:
            stdscr.addstr(ball_scaled_y + 7, ball_scaled_x + 3, 'O')
        
        stdscr.refresh()
        time.sleep(0.05)
    
    ws.close()
    stdscr.nodelay(False)
    curses.curs_set(1)

def main(stdscr):
    curses.curs_set(0)
    stdscr.clear()

    menu1 = ["Login", "Signup"]
    menu2 = ["Create Game", "Join Game"]
    user_data = None
    session = None

    def draw_menu(stdscr, menu, selected):
        stdscr.clear()
        stdscr.addstr(0, 10, "CLI Pong - Main Menu", curses.A_BOLD)
        for idx, item in enumerate(menu):
            if idx == selected:
                stdscr.addstr(idx + 3, 5, f"> {item}", curses.A_REVERSE)
            else:
                stdscr.addstr(idx + 3, 5, f"  {item}")
        stdscr.refresh()

    def navigate_menu(stdscr, menu):
        selected = 0
        while True:
            draw_menu(stdscr, menu, selected)
            key = stdscr.getch()

            if key == curses.KEY_UP and selected > 0:
                selected -= 1
            elif key == curses.KEY_DOWN and selected < len(menu) - 1:
                selected += 1
            elif key in [10, 13]:
                return selected
            elif key in [27, ord('q')]:
                return None

    while not user_data:
        selected_action = navigate_menu(stdscr, menu1)

        if selected_action is None:
            stdscr.clear()
            stdscr.addstr(0, 10, "Exiting game...", curses.A_BOLD)
            stdscr.refresh()
            curses.napms(1000)
            return

        if menu1[selected_action] == "Login":
            user_data = handle_login(stdscr)
            if user_data:
                session = user_data.get('session')
        else:
            user_data = handle_signup(stdscr)
            if user_data:
                session = user_data.get('session')

    selected_game_action = navigate_menu(stdscr, menu2)

    if selected_game_action is None:
        stdscr.clear()
        stdscr.addstr(0, 10, "Exiting game...", curses.A_BOLD)
        stdscr.refresh()
        curses.napms(1000)
        return

    if menu2[selected_game_action] == "Create Game":
        handle_create_game(stdscr, user_data)
    else:
        handle_join_game(stdscr, user_data)

if __name__ == "__main__":
    curses.wrapper(main)