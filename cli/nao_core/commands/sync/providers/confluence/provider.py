import re
from pathlib import Path
from typing import Any

from rich.console import Console
from rich.progress import BarColumn, Progress, SpinnerColumn, TaskProgressColumn, TextColumn

from nao_core.config.base import NaoConfig
from nao_core.config.confluence import ConfluenceConfig

from ..base import SyncProvider, SyncResult

console = Console()


def cleanup_stale_pages(synced_files: set[str], output_path: Path, verbose: bool = False) -> int:
    """Remove markdown files that were not synced.

    Args:
        synced_files: Set of filenames that were synced in this run.
        output_path: Path where synced markdown files are stored.
        verbose: Whether to print cleanup messages.

    Returns:
        Number of stale files removed.
    """
    if not output_path.exists():
        return 0

    removed_count = 0
    for file_path in output_path.iterdir():
        if file_path.is_file() and file_path.suffix == ".md":
            if file_path.name not in synced_files:
                file_path.unlink()
                removed_count += 1
                if verbose:
                    console.print(f"  [dim red]removing stale page:[/dim red] {file_path.name}")

    return removed_count


class ConfluenceSyncProvider(SyncProvider):
    """Provider for syncing Confluence spaces to markdown files."""

    @property
    def name(self) -> str:
        return "Confluence"

    @property
    def emoji(self) -> str:
        return "📚"

    @property
    def default_output_dir(self) -> str:
        return "docs/confluence"

    def get_items(self, config: NaoConfig) -> list[ConfluenceConfig]:
        return [config.confluence] if config.confluence else []

    def sync(self, items: list[ConfluenceConfig], output_path: Path, project_path: Path | None = None) -> SyncResult:
        """Sync Confluence spaces to local filesystem as markdown files.

        This provider:
        1. Connects to Confluence using the API Token and email
        2. Fetches all pages from the configured spaces
        3. Converts pages to markdown with frontmatter
        4. Writes them to docs/confluence/ in the local project directory

        Args:
            items: Confluence configuration with spaces to sync.
            output_path: Path where synced markdown files should be written.
            project_path: Path to the nao project root.

        Returns:
            SyncResult with statistics about what was synced.
        """
        if not items:
            console.print("\n[dim]No Confluence spaces configured[/dim]")
            return SyncResult(provider_name=self.name, items_synced=0, summary="No Confluence configurations configured")

        confluence_config = items[0]
        output_path.mkdir(parents=True, exist_ok=True)

        total_pages_synced = 0
        synced_pages: list[str] = []
        synced_files: set[str] = set()

        console.print(f"\n[bold cyan]{self.emoji}  Syncing {self.name}[/bold cyan]")
        console.print(f"[dim]Location:[/dim] {output_path.absolute()}\n")

        try:
            from atlassian import Confluence as ConfluenceClient
        except ImportError:
            console.print("[bold red]✗[/bold red] atlassian-python-api not installed. Run: pip install atlassian-python-api")
            return SyncResult(provider_name=self.name, items_synced=0, summary="Missing dependency: atlassian-python-api")

        # Collect all pages from all spaces first
        all_pages_to_sync = []
        for space_config in confluence_config.spaces:
            try:
                # Extract space key and base URL from Space URL
                space_key, base_url = self._parse_space_url(space_config.space_url)

                # Initialize Confluence client
                client = ConfluenceClient(
                    url=base_url,
                    username=space_config.email,
                    password=space_config.api_token
                )

                # Get all pages (including child pages) from the space
                pages = self._get_all_pages(client, space_key)
                console.print(f"  [dim]Found {len(pages)} pages in space '{space_key}'[/dim]")

                # Add space info to each page
                for page in pages:
                    page['_space_key'] = space_key
                    all_pages_to_sync.append((page, client))

            except Exception as e:
                console.print(f"  [bold red]✗[/bold red] Failed to connect to space {space_config.space_url}: {e}")

        total_pages = len(all_pages_to_sync)

        if total_pages == 0:
            console.print("[dim]No pages to sync[/dim]")
            return SyncResult(provider_name=self.name, items_synced=0, summary="No pages found in Confluence spaces")

        # Sync all pages with progress bar
        with Progress(
            SpinnerColumn(style="dim"),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(bar_width=30, style="dim", complete_style="cyan", finished_style="green"),
            TaskProgressColumn(),
            console=console,
            transient=False,
        ) as progress:
            task = progress.add_task("Syncing pages", total=total_pages)

            for page, client in all_pages_to_sync:
                try:
                    # Sync page to markdown
                    title, filename, content = self._convert_page_to_markdown(client, page)

                    # Write to file
                    filepath = output_path / filename
                    with open(filepath, 'w', encoding='utf-8') as f:
                        f.write(content)

                    total_pages_synced += 1
                    synced_pages.append(title)
                    synced_files.add(filename)
                    progress.update(task, advance=1, description=f"Synced: {title}")

                except Exception as e:
                    console.print(f"    [dim red]✗[/dim red] Failed to sync page {page.get('title', 'Unknown')}: {e}")
                    progress.update(task, advance=1)

        # Clean up stale pages
        removed_count = cleanup_stale_pages(synced_files, output_path, verbose=True)

        # Build summary
        summary = f"{total_pages_synced} pages synced as markdown"
        if removed_count > 0:
            summary += f", {removed_count} stale removed"

        return SyncResult(
            provider_name=self.name,
            items_synced=total_pages_synced,
            details={"pages": synced_pages, "removed": removed_count},
            summary=summary,
        )

    def _parse_space_url(self, space_url: str) -> tuple[str, str]:
        """Parse Confluence space URL to extract space key and base URL.

        Handles URLs like:
        - https://company.atlassian.net/wiki/spaces/TEAM/overview
        - https://company.atlassian.net/wiki/spaces/TEAM

        Returns:
            Tuple of (space_key, base_url)
        """
        match = re.search(r'/spaces/([^/]+)', space_url)
        if not match:
            raise ValueError(f"Could not extract space key from URL: {space_url}")

        space_key = match.group(1)

        # Extract base URL (everything before /wiki)
        base_url = space_url.split('/wiki')[0]

        return space_key, base_url

    def _get_all_pages(self, client, space_key: str) -> list[dict[str, Any]]:
        """Get all pages in a space including child pages.

        Args:
            client: Confluence client instance
            space_key: Confluence space key

        Returns:
            List of page dictionaries
        """
        all_pages = []
        start = 0
        limit = 50

        while True:
            pages = client.get_all_pages_from_space(space_key, start=start, limit=limit, expand='body.view')
            if not pages:
                break
            all_pages.extend(pages)
            if len(pages) < limit:
                break
            start += limit

        return all_pages

    def _convert_page_to_markdown(self, client, page: dict[str, Any]) -> tuple[str, str, str]:
        """Convert a Confluence page to markdown format.

        Args:
            client: Confluence client instance
            page: Page dictionary from Confluence API

        Returns:
            Tuple of (title, filename, markdown_content)
        """
        page_id = page['id']
        title = page.get('title', 'untitled')
        space_key = page.get('_space_key', '')

        # Try to use body content from the page if it was already expanded
        body_content = ''
        if 'body' in page and 'view' in page.get('body', {}):
            body_content = page['body']['view'].get('value', '')

        # If body content wasn't included, fetch it separately
        if not body_content:
            content_data = client.get_page_by_id(page_id, expand='body.view')
            body_content = content_data.get('body', {}).get('view', {}).get('value', '')

        # Convert HTML-like storage format to markdown (basic conversion)
        markdown_content = self._html_to_markdown(body_content)

        # Build web UI URL
        base_url = client.url
        web_ui_url = f"{base_url}/wiki/pages/{page_id}"

        # Create markdown with frontmatter
        markdown = f"""---
title: {title}
id: {page_id}
space: {space_key}
url: {web_ui_url}
---

{markdown_content}
"""

        # Sanitize title for filename
        safe_title = re.sub(r'[^\w\s-]', '', title).strip().replace(' ', '-').lower()
        filename = f"{safe_title}.md"

        return title, filename, markdown

    def _html_to_markdown(self, html: str) -> str:
        """Convert basic HTML to markdown.

        This is a simple conversion for common Confluence HTML elements.
        For a more robust solution, consider using a library like html2text.
        """
        # Remove empty lines
        html = re.sub(r'\n+', '\n', html)

        # Headers
        html = re.sub(r'<h1[^>]*>(.*?)</h1>', r'\n# \1\n', html, flags=re.DOTALL)
        html = re.sub(r'<h2[^>]*>(.*?)</h2>', r'\n## \1\n', html, flags=re.DOTALL)
        html = re.sub(r'<h3[^>]*>(.*?)</h3>', r'\n### \1\n', html, flags=re.DOTALL)
        html = re.sub(r'<h4[^>]*>(.*?)</h4>', r'\n#### \1\n', html, flags=re.DOTALL)
        html = re.sub(r'<h5[^>]*>(.*?)</h5>', r'\n##### \1\n', html, flags=re.DOTALL)
        html = re.sub(r'<h6[^>]*>(.*?)</h6>', r'\n###### \1\n', html, flags=re.DOTALL)

        # Bold and italic
        html = re.sub(r'<strong[^>]*>(.*?)</strong>', r'**\1**', html, flags=re.DOTALL)
        html = re.sub(r'<b[^>]*>(.*?)</b>', r'**\1**', html, flags=re.DOTALL)
        html = re.sub(r'<em[^>]*>(.*?)</em>', r'*\1*', html, flags=re.DOTALL)
        html = re.sub(r'<i[^>]*>(.*?)</i>', r'*\1*', html, flags=re.DOTALL)

        # Links
        html = re.sub(r'<a [^>]*href="([^"]*)"[^>]*>(.*?)</a>', r'[\2](\1)', html, flags=re.DOTALL)

        # Code blocks
        html = re.sub(r'<pre[^>]*><code[^>]*>(.*?)</code></pre>', r'```\n\1\n```', html, flags=re.DOTALL)
        html = re.sub(r'<code[^>]*>(.*?)</code>', r'`\1`', html, flags=re.DOTALL)

        # Lists
        html = re.sub(r'<ul[^>]*>(.*?)</ul>', r'\n\1\n', html, flags=re.DOTALL)
        html = re.sub(r'<ol[^>]*>(.*?)</ol>', r'\n\1\n', html, flags=re.DOTALL)
        html = re.sub(r'<li[^>]*>(.*?)</li>', r'- \1', html, flags=re.DOTALL)

        # Paragraphs
        html = re.sub(r'<p[^>]*>(.*?)</p>', r'\1\n\n', html, flags=re.DOTALL)

        # Line breaks
        html = re.sub(r'<br\s*/?>', '\n', html)

        # Remove remaining HTML tags
        html = re.sub(r'<[^>]+>', '', html)

        # Clean up excessive whitespace
        html = re.sub(r'\n{3,}', '\n\n', html)
        html = html.strip()

        return html
