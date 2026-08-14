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
    operationName: "SearchProduct",
    variables: { storeCode: "TJ", published: "1", sku },
    query: `query SearchProduct($sku: String, $storeCode: String = "TJ", $published: String = "1") {
      products(
        filter: { sku: { eq: $sku }, store_code: { eq: $storeCode }, published: { eq: $published } }
      ) {
        items {
          sku
          name
          url_key
          primary_image_meta { url }
          price_range { minimum_price { regular_price { value currency } final_price { value currency } } }
          categories { name url_key }
          item_title
          item_description
          item_story_marketing
          item_story_qil
          fun_tags
          primary_image
          sales_size
          sales_uom_description
          country_of_origin
          first_published_date
          nutrition {
            display_sequence
            panel_id
            panel_title
            serving_size
            calories_per_serving
            servings_per_container
            details { display_seq nutritional_item amount percent_dv }
          }
          ingredients { display_sequence ingredient }
          allergens { display_sequence ingredient }
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
  const item = json?.data?.products?.items?.[0];
  if (!item) return json;
  return { ...json, data: { products: { items: [enrichProduct(item)] } } };
}

function enrichProduct(item) {
  return {
    sku: item.sku,
    name: item.item_title || item.name,
    url_key: item.url_key,
    description: item.item_story_marketing || item.item_story_qil,
    size: item.sales_size ? `${item.sales_size} ${item.sales_uom_description ?? ""}`.trim() : undefined,
    price: item.price_range?.minimum_price?.final_price ?? null,
    primary_image: item.primary_image,
    categories: item.categories,
    fun_tags: item.fun_tags,
    country_of_origin: item.country_of_origin,
    first_published_date: item.first_published_date,
    ingredients: (item.ingredients ?? []).map((i) => i.ingredient),
    nutrition: item.nutrition,
    allergens: (item.allergens ?? []).map((a) => a.ingredient)
  };
}
const STORE_API_URL = "https://alphaapi.brandify.com/rest";
const STORE_APP_KEY = "8BC3433A-60FC-11E3-991D-B2EE0C70A832";
const STORE_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

async function findStores(zip, radius = 25) {
  const body = JSON.stringify({
    request: {
      appkey: STORE_APP_KEY,
      formdata: {
        geoip: 0,
        dataview: "store_default",
        limit: 50,
        geolocs: { geoloc: [{ addressline: zip, country: "US", latitude: "", longitude: "" }] },
        searchradius: String(radius),
        where: { warehouse: { distinctfrom: "1" } },
        false: "0"
      }
    }
  });
  const res = await fetch(`${STORE_API_URL}/locatorsearch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  const json = await res.json();
  const collection = json?.response?.collection ?? [];
  return {
    query: zip,
    radius,
    centerpoint: json?.response?.attributes?.centerpoint ?? null,
    total: collection.length,
    stores: collection.map((s) => ({
      name: s.name,
      address: [s.address1, s.address2, s.city, s.state, s.postalcode].filter(Boolean).join(", "),
      phone: s.phone || null,
      latitude: s.latitude ? Number(s.latitude) : null,
      longitude: s.longitude ? Number(s.longitude) : null,
      hours: (s.bho ?? []).map((h, i) => ({
        day: STORE_DAYS[i] ?? null,
        open: h[0],
        close: h[1]
      })),
      website: s.website || null
    }))
  };
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
