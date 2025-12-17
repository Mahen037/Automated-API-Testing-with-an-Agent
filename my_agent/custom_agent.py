from google.adk.agents import BaseAgent
from google.adk.events import Event
from google.genai import types

from pathlib import Path
from typing import AsyncIterator
from pydantic import PrivateAttr

class GenerationRevisionAgent(BaseAgent):
    _junior_agent: BaseAgent = PrivateAttr()
    _senior_agent: BaseAgent = PrivateAttr()
    _max_iterations: int = PrivateAttr()
    
    def __init__(
        self,
        *,
        name: str = "generation-revision-agent",
        description="Iteratively generates and reviews Playwright tests until approved.",
        sub_agents: list[BaseAgent],
        max_iterations: int = 5,
    ):
        super().__init__(name=name, description=description, sub_agents=sub_agents)
        self._junior_agent = sub_agents[0]
        self._senior_agent = sub_agents[1]
        self._max_iterations = max_iterations

    def _make_text_event(
        self,
        *,
        author: str,
        text: str,
        partial: bool = False,
        turn_complete: bool | None = None,
    ) -> Event:
        """
        Create a schema-valid ADK Event for a plain text/progress message.
        Works for ADK Web + CLI.
        """
        kwargs = {
            "author": author,
            "content": types.Content(parts=[types.Part(text=text)]),
            "partial": partial,
        }
        if turn_complete is not None:
            kwargs["turn_complete"] = turn_complete

        # Guard against version differences (only pass supported fields)
        model_fields = getattr(Event, "model_fields", None)
        if model_fields:
            kwargs = {k: v for k, v in kwargs.items() if k in model_fields}

        return Event(**kwargs)

    async def run_async(self, invocation_context) -> AsyncIterator[Event]:
        """
        Repeatedly runs junior + senior until all services are approved
        or max_iterations is reached.
        """

        for iteration in range(1, self._max_iterations + 1):

            # --- Log iteration start ---
            yield self._make_text_event(author=self.name, text=f"Test generation iteration {iteration}")

            # --- Run junior agent ---
            async for event in self._junior_agent.run_async(invocation_context):
                yield event

            # --- Run senior agent ---
            async for event in self._senior_agent.run_async(invocation_context):
                yield event

            # --- Check stopping condition ---
            if self._all_services_approved():
                yield self._make_text_event(author=self.name, text="All services approved. Stopping test generation loop.")
                break

        # --- Final log ---
        yield self._make_text_event(author=self.name, text="Test generation loop completed.")

    def _all_services_approved(self) -> bool:
        state_dir = Path(".api-tests/.atlas-internal")
        if not state_dir.exists():
            return False

        approved_services = {
            p.stem.replace(".approved", "")
            for p in state_dir.glob("*.approved.json")
        }

        # Derive expected services from route snapshots
        routes_dir = Path(".api-tests/routes")
        expected_services = {
            p.stem.replace("-routes", "")
            for p in routes_dir.glob("*-routes.json")
        }

        return expected_services.issubset(approved_services)
