from dataclasses import dataclass

@dataclass
class Config:
    ws_url: str
    matchmaking_url: str
    verify_cert: bool
