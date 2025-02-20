import curses
import requests
import json
import os

USER_MGMT_URL = "http://user_management:8000"

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
        stdscr.addstr(6, 2, f"Access Token: {result['access_token']}", curses.A_BOLD)  # Print access token on signup
        stdscr.addstr(7, 2, "Press any key to continue...")
        stdscr.refresh()
        stdscr.getch()
        return None
    except AuthenticationError as e:
        stdscr.addstr(5, 2, f"Error: {str(e)}", curses.A_BOLD)
        stdscr.addstr(6, 2, "Press any key to continue...")
        stdscr.refresh()
        stdscr.getch()
        return None

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

    stdscr.clear()
    stdscr.addstr(0, 10, f"You chose: {menu2[selected_game_action]}", curses.A_BOLD)
    stdscr.addstr(2, 5, "Press any key to exit...")
    stdscr.refresh()
    stdscr.getch()

if __name__ == "__main__":
    curses.wrapper(main)