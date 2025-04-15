import Accueil from "../../views/Accueil.js";
import Login from "../../views/Login.js";
import Signup from "../../views/Signup.js";
import NotFound from "../../views/NotFound.js";
import StartGame from "../../views/StartGame.js";
import Profile from "../../views/Profile.js";
import Game from "../../views/Game.js";
import Tournament from "../../views/Tournament.js";
import TournamentGame from "../../views/TournamentGame.js";
import OnlineGame from "../../views/OnlineGame.js";

import { requireAuth, redirectIfAuth } from './guards.js';

export const routes = [
  { path: '/', view: Accueil, guard: redirectIfAuth },
  { path: '/login', view: Login, guard: redirectIfAuth },
  { path: '/signup', view: Signup, guard: redirectIfAuth },
  { path: '/notfound', view: NotFound },
  { path: '/start-game', view: StartGame, guard: requireAuth },
  { path: '/profile', view: Profile, guard: requireAuth },
  { path: '/game', view: Game, guard: requireAuth },
  { path: '/tournament', view: Tournament, guard: requireAuth },
  { path: '/tournament-game', view: TournamentGame, guard: requireAuth },
  { path: '/online-game', view: OnlineGame, guard: requireAuth },
  
];
