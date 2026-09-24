from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

ID_PATTERN = r"^[a-z0-9-]{1,40}$"


class CamelModel(BaseModel):
    """camelCase on the wire, snake_case in Python (api-contract.md 0)."""
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)
