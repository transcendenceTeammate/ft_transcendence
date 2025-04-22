import argparse
from srcs.config import Config
from srcs.app import Application

def parse_args():
    parser = argparse.ArgumentParser(
        description="Start the game client with specified server endpoints."
    )

    parser.add_argument(
        "--ws-endpoint",
        required=True,
        help="WebSocket game server endpoint (e.g., wss://app.127.0.0.1.nip.io:8443)"
    )

    parser.add_argument(
        "--matchmaking-endpoint",
        required=True,
        help="HTTP(S) matchmaking server endpoint (e.g., https://api.app.127.0.0.1.nip.io:8443)"
    )

    parser.add_argument(
        "--no-verify-cert",
        action="store_false",
        dest="verify_cert",
        help="Disable HTTPS certificate verification (DANGEROUS: use only for local/dev environments)"
    )

    return parser.parse_args()

def main():
    args = parse_args()
    config = Config(
        ws_url=args.ws_endpoint,
        matchmaking_url=args.matchmaking_endpoint,
        verify_cert=args.verify_cert
    )

    app = Application(config=config)
    app.run()

if __name__ == "__main__":
    main()
