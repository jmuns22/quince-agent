// API route: POST { messages: [...] }
// Wires Claude tool-use to search_catalog instead of dumping full catalog in prompt.
import Anthropic from "@anthropic-ai/sdk";
import catalog from "../../data/catalog.json";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are Quince's shopping assistant.
Only answer using data returned by search_catalog. If something isn't in results, say you don't have that info and offer to connect the shopper with support.
Escalate to a human for: returns/complaints, medical or allergy-adjacent claims, or anything outside catalog scope.
Tone: helpful, concise, on-brand (factory-direct, no middleman, high quality at low prices).`;

const TOOLS = [
  {
    name: "search_catalog",
    description: "Search the Quince product catalog by keyword, category, or price range.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "keyword, product name, or category" },
        max_price: { type: "number" }
      },
      required: ["query"]
    }
  }
];

function searchCatalog({ query, max_price }) {
  const q = (query || "").toLowerCase();
  return catalog
    .filter(p =>
      (p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)) &&
      (max_price ? p.price <= max_price : true)
    )
    .slice(0, 8);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { messages } = req.body;

  let response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1000,
    system: SYSTEM_PROMPT,
    tools: TOOLS,
    messages
  });

  // Handle one round of tool use
  const toolUse = response.content.find(b => b.type === "tool_use");
  if (toolUse) {
    const result = searchCatalog(toolUse.input);
    const followUp = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages: [
        ...messages,
        { role: "assistant", content: response.content },
        {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: toolUse.id,
              content: JSON.stringify(result)
            }
          ]
        }
      ]
    });
    return res.status(200).json(followUp);
  }

  return res.status(200).json(response);
}
