#!/usr/bin/env node
"use strict";

// src/index.ts
var import_server = require("@modelcontextprotocol/sdk/server/index.js");
var import_stdio = require("@modelcontextprotocol/sdk/server/stdio.js");
var import_types = require("@modelcontextprotocol/sdk/types.js");
var BASE_URL = "https://www.traderjoes.com/api/graphql";
async function searchProducts(query, pageSize = 10) {
  const body = JSON.stringify({
    operationName: "SearchProducts",
    variables: {
      storeCode: "TJ",
      published: "1",
      search: query,
      pageSize,
      currentPage: 1
    },
    query: `query SearchProducts($storeCode: String, $published: String, $search: String, $pageSize: Int, $currentPage: Int) {
      products(
        filter: { store_code: { eq: $storeCode }, published: { eq: $published } }
        search: $search
        pageSize: $pageSize
        currentPage: $currentPage
      ) {
        items {
          sku
          name
          url_key
          primary_image_meta { url }
          price_range { minimum_price { regular_price { value currency } final_price { value currency } } }
          categories { name url_key }
        }
        total_count
        page_info { current_page page_size total_pages }
      }
    }`
  });
  const res = await fetch(BASE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  return res.json();
}
async function getProductDetails(sku) {
  const body = JSON.stringify({
    operationName: "GetProduct",
    variables: { storeCode: "TJ", published: "1", sku },
    query: `query GetProduct($storeCode: String, $published: String, $sku: String) {
      products(
        filter: { store_code: { eq: $storeCode }, published: { eq: $published }, sku: { eq: $sku } }
        pageSize: 1
      ) {
        items {
          sku
          name
          url_key
          primary_image_meta { url }
          price_range { minimum_price { regular_price { value currency } final_price { value currency } } }
          categories { name url_key }
          custom_attributesV2 {
            items {
              code
              ... on AttributeValue { value }
              ... on AttributeSelectedOptions { selected_options { label value } }
            }
          }
        }
      }
    }`
  });
  const res = await fetch(BASE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  const json = await res.json();
  const item = json?.data?.products?.items?.[0];
  if (!item) return json;
  return { ...json, data: { products: { items: [enrichProduct(item)] } } };
}

function enrichProduct(item) {
  const attrs = {};
  for (const a of item.custom_attributesV2?.items ?? []) {
    attrs[a.code] = a.value !== undefined
      ? a.value
      : (a.selected_options ?? []).map((o) => o.label ?? o.value);
  }
  const parseJson = (code) => {
    const raw = attrs[code];
    if (raw === undefined) return undefined;
    try { return JSON.parse(raw); } catch { return raw; }
  };
  const images = parseJson("primary_image");
  const primaryImage = Array.isArray(images)
    ? (images.find((i) => i.store_code === "TJ")?.value ?? images[0]?.value)
    : attrs.primary_image;
  return {
    sku: item.sku,
    name: attrs.item_title || item.name,
    url_key: item.url_key,
    description: attrs.item_story_marketing || attrs.item_story_qil,
    size: attrs.sales_size ? `${attrs.sales_size} ${attrs.sales_uom_description ?? ""}`.trim() : undefined,
    price: item.price_range?.minimum_price?.regular_price ?? null,
    primary_image: primaryImage,
    categories: item.categories,
    fun_tags: attrs.fun_tags,
    country_of_origin: attrs.country_of_origin,
    first_published_date: attrs.first_published_date,
    ingredients: parseJson("ingredients"),
    nutrition: parseJson("nutrition"),
    allergens: parseJson("allergens"),
    directions: parseJson("directions")
  };
}
async function findStores(zip, radius = 25) {
  throw new Error(
    "Store search is not available via Trader Joe's public GraphQL API (the storeSearch field does not exist and pickupLocations returns no data). Use https://locations.traderjoes.com or a third-party store dataset instead."
  );
}
async function getFeaturedProducts(category) {
  const body = JSON.stringify({
    operationName: "FeaturedProducts",
    variables: {
      storeCode: "TJ",
      published: "1",
      pageSize: 20,
      currentPage: 1,
      ...category ? { category } : {}
    },
    query: `query FeaturedProducts($storeCode: String, $published: String, $pageSize: Int, $currentPage: Int) {
      products(
        filter: { store_code: { eq: $storeCode }, published: { eq: $published }, new_product: { match: "1" } }
        pageSize: $pageSize
        currentPage: $currentPage
      ) {
        items {
          sku
          name
          url_key
          primary_image_meta { url }
          price_range { minimum_price { regular_price { value currency } final_price { value currency } } }
          categories { name url_key }
        }
        total_count
      }
    }`
  });
  const res = await fetch(BASE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  const json = await res.json();
  if (category && json?.data?.products?.items) {
    const term = category.toLowerCase();
    const matches = (it) => (it.categories ?? []).some(
      (c) => c.name.toLowerCase().includes(term) || c.url_key.toLowerCase().includes(term)
    );
    const items = json.data.products.items.filter(matches);
    json.data.products.items = items;
    json.data.products.total_count = items.length;
  }
  return json;
}
var TOOLS = [
  {
    name: "search_products",
    description: "Search for products at Trader Joe's by keyword. Returns product names, SKUs, prices, and descriptions.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search term (e.g. 'cauliflower', 'frozen pizza', 'wine')"
        },
        page_size: {
          type: "number",
          description: "Number of results to return (default: 10, max: 50)"
        }
      },
      required: ["query"]
    }
  },
  {
    name: "get_product_details",
    description: "Get detailed information about a specific Trader Joe's product by SKU, including ingredients, nutrition facts, and allergens.",
    inputSchema: {
      type: "object",
      properties: {
        sku: {
          type: "string",
          description: "Product SKU from search results"
        }
      },
      required: ["sku"]
    }
  },
  {
    name: "find_stores",
    description: "Find Trader Joe's store locations near a ZIP code, including addresses, phone numbers, and store hours.",
    inputSchema: {
      type: "object",
      properties: {
        zip: {
          type: "string",
          description: "US ZIP code to search near"
        },
        radius: {
          type: "number",
          description: "Search radius in miles (default: 25)"
        }
      },
      required: ["zip"]
    }
  },
  {
    name: "get_new_products",
    description: "Get a list of new and featured products currently available at Trader Joe's.",
    inputSchema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description: "Optional category filter (e.g. 'produce', 'frozen', 'snacks')"
        }
      },
      required: []
    }
  }
];
var server = new import_server.Server(
  { name: "mcp-traderjoes", version: "1.0.0" },
  { capabilities: { tools: {} } }
);
server.setRequestHandler(import_types.ListToolsRequestSchema, async () => ({ tools: TOOLS }));
server.setRequestHandler(import_types.CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let result;
    switch (name) {
      case "search_products": {
        const { query, page_size } = args;
        result = await searchProducts(query, page_size);
        break;
      }
      case "get_product_details": {
        const { sku } = args;
        result = await getProductDetails(sku);
        break;
      }
      case "find_stores": {
        const { zip, radius } = args;
        result = await findStores(zip, radius);
        break;
      }
      case "get_new_products": {
        const { category } = args ?? {};
        result = await getFeaturedProducts(category);
        break;
      }
      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
          isError: true
        };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  } catch (err) {
    return {
      content: [{ type: "text", text: `Error: ${err.message}` }],
      isError: true
    };
  }
});
async function main() {
  const transport = new import_stdio.StdioServerTransport();
  await server.connect(transport);
  console.error("Trader Joe's MCP server running on stdio");
}
main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
