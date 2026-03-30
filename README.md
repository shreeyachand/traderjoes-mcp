# Trader Joe's MCP Server

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) server that provides tools for searching Trader Joe's products, looking up detailed product info, finding store locations, and browsing new arrivals. No authentication required -- this uses Trader Joe's public API.

## Tools

| Tool | Description |
|------|-------------|
| `search_products` | Search for products by keyword. Returns names, SKUs, prices, sizes, categories, and tags. |
| `get_product_details` | Get full details for a product by SKU, including ingredients, nutrition facts, and allergens. |
| `find_stores` | Find Trader Joe's store locations near a ZIP code, with addresses, phone numbers, and hours. |
| `get_new_products` | List new and featured products, with optional category filter. |

## Environment Variables

None. This server uses Trader Joe's public GraphQL API and requires no API keys or authentication.

## Setup

```bash
npm ci
```

## Usage

### stdio mode (for Claude Desktop, Claude Code, etc.)

```bash
node dist/index.js
```

Add to your MCP client config:

```json
{
  "mcpServers": {
    "traderjoes": {
      "command": "node",
      "args": ["/path/to/traderjoes-mcp/dist/index.js"]
    }
  }
}
```

### HTTP mode (with mcp-proxy)

```bash
npx mcp-proxy --port 8007 -- node dist/index.js
```

## Building from Source

The compiled output is included in `dist/`. To rebuild from TypeScript:

```bash
npm run build
```

## License

MIT -- see [LICENSE](LICENSE).
