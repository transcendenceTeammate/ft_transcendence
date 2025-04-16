from django.apps import AppConfig


class AppConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'app'
    
    def ready(self):
        """Initialize app services when Django starts"""
        # Import here to prevent circular imports
        from .game.manager import GameManager
        
        # This touch ensures GameManager class is loaded and initialized
        pass