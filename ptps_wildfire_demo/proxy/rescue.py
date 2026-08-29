from dataclasses import dataclass


@dataclass(frozen=True)
class Rescue:
    """Represents a single rescued dataset URL"""

    original_url: str
    wayback_newest_url: str | None
    drp_url: str | None
