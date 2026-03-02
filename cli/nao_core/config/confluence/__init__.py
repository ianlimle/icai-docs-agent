from pydantic import BaseModel, Field

from nao_core.ui import UI, ask_text, ask_confirm


class ConfluenceSpace(BaseModel):
    """Configuration for a single Confluence space."""
    space_url: str = Field(description="Confluence space URL")
    api_token: str = Field(description="Confluence API token")
    email: str = Field(description="Email for authentication")


class ConfluenceConfig(BaseModel):
    """Confluence configuration for the project."""
    spaces: list[ConfluenceSpace] = Field(default_factory=list, description="Confluence spaces to sync")

    @classmethod
    def promptConfig(cls) -> "ConfluenceConfig":
        """Interactively prompt for Confluence configuration."""
        spaces = []
        while True:
            UI.info("Configure Confluence space:")
            space_url = ask_text("Space URL:", required_field=True)
            api_token = ask_text("API Token:", password=True, required_field=True)
            email = ask_text("Email:", required_field=True)

            spaces.append(ConfluenceSpace(
                space_url=space_url,
                api_token=api_token,
                email=email
            ))

            if not ask_confirm("Add another Confluence space?", default=False):
                break

        return ConfluenceConfig(spaces=spaces)
