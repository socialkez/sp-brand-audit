export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { brand } = req.body;
  if (!brand) return res.status(400).json({ error: "Brand is required" });

  const systemPrompt = `You are an expert local SEO and AI search visibility auditor. Given a brand name, research what you know about the brand and output ONLY a JSON object — no markdown fences, no commentary — with this exact structure:

{
  "trustScore": <integer 0-100>,
  "aiScore": <integer 0-100>,
  "trustVerdict": "<1-sentence verdict>",
  "aiVerdict": "<1-sentence verdict>",
  "signals": [
    { "name": "E-E-A-T & Location Content",   "status": "<Pass|Warn|Fail>", "note": "<1-2 sentences>" },
    { "name": "Review Volume & Sentiment",      "status": "<Pass|Warn|Fail>", "note": "<1-2 sentences>" },
    { "name": "NAP Consistency",               "status": "<Pass|Warn|Fail>", "note": "<1-2 sentences>" },
    { "name": "Third-Party Citations",          "status": "<Pass|Warn|Fail>", "note": "<1-2 sentences>" },
    { "name": "Branded Search Volume",         "status": "<Pass|Warn|Fail>", "note": "<1-2 sentences>" }
  ],
  "aiPlatforms": {
    "google":  "<Yes|No|Partial>",
    "chatgpt": "<Yes|No|Partial>",
    "gemini":  "<Yes|No|Partial>",
    "claude":  "<Yes|No|Partial>",
    "bing":    "<Yes|No|Partial>"
  },
  "rationale": "<3-4 sentence rationale with specific recommendations>"
}

Base scores on your knowledge of the brand. trustScore reflects the 5 trust signals. aiScore reflects AI platform coverage. Unknown or obscure brands should score lower. Output only the JSON object, nothing else.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-5",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: `Audit this brand and return only a JSON object: "${brand}"`,
          },
        ],
        system: systemPrompt,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(500).json({ error: `Anthropic API error: ${response.status} — ${errText}` });
    }

    const data = await response.json();

    const allText = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    const match = allText.match(/\{[\s\S]*\}/);
    if (!match) {
      return res.status(500).json({ error: "Could not parse audit response", raw: allText });
    }

    res.status(200).json(JSON.parse(match[0]));
  } catch (err) {
    res.status(500).json({ error: err.message || "Audit failed" });
  }
}
