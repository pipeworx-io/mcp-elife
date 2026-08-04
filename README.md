# mcp-elife

eLife MCP — keyless open-access life-sciences & biomedical journal articles.

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

## Tools

| Tool | Description |
|------|-------------|
| `search_articles` | Search eLife — the open-access journal for life sciences & biomedicine — for articles by keyword (gene, disease, method, organism, author, etc.). Returns matching articles with id, title, type, DOI, publication date, authors, and subjects. Keyless. |
| `get_article` | Get the full metadata and abstract for a single eLife article by its id (e.g. "107545"). Returns title, DOI, type, publication date, authors, abstract, and subjects. Keyless. |
| `latest_articles` | List the most recently published eLife articles (newest first). eLife is the open-access journal for life sciences & biomedicine. Returns id, title, type, DOI, publication date, and authors. Keyless. |

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "elife": {
      "url": "https://gateway.pipeworx.io/elife/mcp"
    }
  }
}
```

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Elife data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
