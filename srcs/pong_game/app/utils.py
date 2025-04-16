# In-memory implementation reference file
#
# These utility functions have been consolidated into app.game.manager:
# - game_state_to_dict -> GameState.to_dict()
# - calculate_state_delta -> GameManager.calculate_state_delta()
# - cache_game_state -> GameManager.cache_game_state()
# - get_cached_game_state -> (included in GameManager.get_game())
# - generate_room_code -> GameManager.generate_room_code()
#
# Ball trajectory prediction has been removed as part of simplification.
# Latency measurement has been simplified and is handled directly in the websocket consumer.
