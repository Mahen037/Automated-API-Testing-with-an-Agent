"""Utilities for loading agent prompts from YAML files."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Dict

import yaml

PROMPTS_DIR = Path(__file__).parent


@dataclass(frozen=True)
class Prompt:
    """Represents a parsed prompt entry."""
    name: str
    prompt: str


def _load_prompt_from_yaml(filename: str, *, prompt_key: str = "prompt") -> Prompt:
    path = PROMPTS_DIR / filename
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    if not data or prompt_key not in data:
        raise ValueError(f"Prompt file '{filename}' missing '{prompt_key}' key.")
    name = data.get("name", Path(filename).stem)
    return Prompt(name=name, prompt=data[prompt_key])


PROMPTS: Dict[str, Prompt] = {
    "route_extraction": _load_prompt_from_yaml("route_extraction.yaml"),
    "test_generation": _load_prompt_from_yaml("test_generation.yaml"),
    "test_execution": _load_prompt_from_yaml("test_execution.yaml"),
}
