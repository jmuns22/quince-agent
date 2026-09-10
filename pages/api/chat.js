// API route: POST { messages: [...] }
// Wires Claude tool-use to search_catalog instead of dumping full catalog in prompt.
import Anthropic from "@anthropic-ai/sdk";
import catalog from "../../data/catalog.json";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are Quince's shopping assistant.
Only answer product questions using data returned by search_catalog. If results are empty, say plainly that item isn't in the current catalog selection. Do not guess. Do not use outside knowledge of Quince's real product line.

VERIFIED POLICY FACTS (source: quince.com/shipping-returns). You may answer general policy QUESTIONS using these facts directly, no tool needed:
- Returns: free returns for up to 365 days from purchase.
- Cancellations: an order can be canceled or edited only before it ships. Once shipped, it falls under the return policy instead, and cannot be canceled.
- Shipping: always free, standard.
If someone asks a general policy question ("what's your return policy", "can I cancel an order"), answer from these facts directly.
If someone is trying to ACT on their own specific order (return this, cancel my order, my order arrived damaged), that needs account access you don't have. Escalate to human support for that, do not attempt it.
Also escalate: complaints, medical or allergy-adjacent claims, or anything outside catalog scope and outside the policy facts above.
Tone: helpful, concise, on-brand (factory-direct, no middleman, high quality at low prices, no em dashes).`;
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

const STOPWORDS = new Set([
  "a","an","the","do","does","you","have","i","want","need","for","of","in","on",
  "is","are","to","with","and","or","under","over","less","than","some","any","looking"
]);

function extractPriceFallback(text) {
  const match = (text || "").match(/(?:under|below|less than)\s*\$?(\d+(?:\.\d+)?)|\$?(\d+(?:\.\d+)?)\s*(?:or less|and under)/i);
  if (!match) return undefined;
  const num = match[1] || match[2];
  return num ? parseFloat(num) : undefined;
}

function normalizeWord(w) {
  if (w.length > 4 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

function tokenize(text) {
  return (text || "")
    .toLowerCase()
    .split(/[^a-z0-9$.]+/)
    .map(normalizeWord)
    .filter(w => w.length > 2 && !STOPWORDS.has(w));
}

function searchCatalog({ query, max_price }) {
  const words = tokenize(query);
  const effectiveMaxPrice = max_price ?? extractPriceFallback(query);

  const matches = catalog.filter(p => {
    const haystackWords = tokenize(p.name + " " + p.category + " " + (p.color || ""));
    const hasMatch = words.length === 0 || words.some(w => haystackWords.some(hw => hw.includes(w) || w.includes(hw)));
    const withinPrice = effectiveMaxPrice ? p.price <= effectiveMaxPrice : true;
    return hasMatch && withinPrice;
  }).slice(0, 8).map(p => {
    // Don't hand the model a link we haven't verified — omit rather than risk a dead URL.
    if (p.url_verified === false) {
      const { url, url_verified, ...rest } = p;
      return rest;
    }
    return p;
  });

  if (matches.length === 0) {
    return { found: false, message: "No matching items in the current catalog selection.", results: [] };
  }
  return { found: true, results: matches };
}

const MAX_TOOL_ROUNDS = 4;
const MAX_HISTORY_MESSAGES = 12; // caps token growth on long conversations

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is not set.");
    return res.status(500).json({ error: "Server configuration issue — API key not set." });
  }

  let messages;
  try {
    messages = req.body.messages;
    if (!Array.isArray(messages)) throw new Error("messages must be an array");
  } catch (e) {
    return res.status(400).json({ error: "Invalid request body." });
  }

  // Keep only the most recent turns — bounds token cost on long conversations.
  let workingMessages = messages.slice(-MAX_HISTORY_MESSAGES);

  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        messages: workingMessages
      });

      const toolUse = response.content.find(b => b.type === "tool_use");

      if (!toolUse) {
        if (response.stop_reason === "max_tokens") {
          console.warn("Response truncated at max_tokens.");
          const textBlock = response.content.find(b => b.type === "text");
          if (textBlock) textBlock.text += "\n\n[Response was cut short — ask me to continue if needed.]";
        }
        return res.status(200).json(response);
      }

      const result = searchCatalog(toolUse.input);
      workingMessages = [
        ...workingMessages,
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
      ];
    }

    return res.status(200).json({
      content: [{ type: "text", text: "I'm having trouble narrowing that down — could you rephrase, or would you like me to connect you with support?" }]
    });

  } catch (err) {
    const status = err?.status || 500;
    const message =
      status === 401 ? "Server configuration issue — invalid API key." :
      status === 429 ? "Too many requests right now — please try again in a moment." :
      "Something went wrong processing that request.";
    console.error("chat.js error:", err);
    return res.status(status).json({ error: message });
  }
}

