import asyncio
import sys
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PROJECT_ROOT))

from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from my_agent.agent import root_agent

async def main():
    print("Starting debug run...")
    session_service = InMemorySessionService()
    runner = Runner(
        agent=root_agent,
        app_name="debug-app",
        session_service=session_service,
    )
    
    class SimpleMessage:
        def __init__(self, content):
            self.role = "user"
            self.content = content
            
    try:
        async for event in runner.run_async(
            user_id="debug-user",
            session_id="debug-session",
            new_message=SimpleMessage("https://github.com/Kludex/fastapi-microservices")
        ):
            print(event)
    except Exception as e:
        print(f"Caught error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
