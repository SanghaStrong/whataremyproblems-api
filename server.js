import express from "express";
import cors from "cors";

const app = express();

app.use(cors({
  origin: "*",
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"]
}));

app.use(express.json());

app.get("/", (req, res) => {
  res.send("API is running.");
});

function buildSanghaRedirect(userMessage, parsed = {}) {
  const params = new URLSearchParams();

  const text = userMessage.toLowerCase();

  // Always include original message
  params.set("need", userMessage);

  // -------- TYPE LOGIC --------
  if (parsed.category === "therapy") {
    params.set("type", "provider");
  } else if (parsed.category === "psychiatry") {
    params.set("type", "provider");
    params.set("specialty", "Medication Support");
  } else if (parsed.category === "support_group") {
    params.set("type", "organization");
    params.set("specialty", "Support Groups");
  } else if (parsed.category === "community_resources") {
    params.set("type", "organization");
  } else if (parsed.category === "wellness_coaching") {
    params.set("type", "provider");
    params.set("specialty", "Wellness Coaching");
  } else if (parsed.category === "crisis_support") {
    params.set("type", "organization");
    params.set("urgency", "high");
  } else {
    params.set("type", "provider");
  }

  // -------- SPECIALTY DETECTION --------
  if (/anx|panic|worry|overwhelm|stress/i.test(text)) {
    params.set("specialty", "Anxiety");
  }

  if (/depress|sad|hopeless|empty|numb/i.test(text)) {
    params.set("specialty", "Depression");
  }

  if (/trauma|ptsd|abuse|flashback/i.test(text)) {
    params.set("specialty", "Trauma");
  }

  if (/grief|loss|mourning/i.test(text)) {
    params.set("specialty", "Grief");
  }

  if (/burnout|exhausted|drained/i.test(text)) {
    params.set("specialty", "Burnout");
  }

  if (/relationship|marriage|partner|divorce/i.test(text)) {
    params.set("specialty", "Relationships");
  }

  if (/sleep|insomnia/i.test(text)) {
    params.set("specialty", "Sleep Issues");
  }

  // -------- MODE --------
  params.set("mode", "Telehealth");

  // -------- AUTO SEARCH --------
  params.set("autorun", "1");

  return `https://sanghastrong.com/?${params.toString()}`;
}
app.post("/api/chat", async (req, res) => {
  const conversation = Array.isArray(req.body.conversation) ? req.body.conversation : [];
  const userMessage = String(req.body.message || "").trim();

  if (!userMessage) {
    return res.status(400).json({
      category: "community_resources",
      urgency: "low",
      conversation_mode: "redirect",
      reply: "Please share a little about what has been going on.",
      follow_up_question: "What feels hardest right now?",
      next_steps: [],
      show_crisis_banner: false,
      redirect_url: buildSanghaRedirect("")
    });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: [
          {
            role: "system",
            content: `You are a calm, supportive mental health navigation assistant.

You do not diagnose.
You help users describe what they are feeling and guide them toward the right kind of support.

Your job:
- validate what the person shared
- ask one helpful follow-up question at a time
- choose one category
- suggest 2 to 4 practical next steps
- if the user seems hesitant, soften and redirect
- if there is crisis language, prioritize safety

Allowed categories:
therapy
psychiatry
support_group
community_resources
wellness_coaching
crisis_support

Allowed urgency:
low
medium
high

Allowed conversation_mode:
explore
deepen
redirect
route_now
crisis

If the user mentions self-harm, suicide, harming others, or immediate danger:
- category must be crisis_support
- urgency must be high
- show_crisis_banner must be true
- conversation_mode must be crisis
- do not ask a probing follow-up question

Return valid JSON only.`
          },
          ...conversation,
          { role: "user", content: userMessage }
        ],
        text: {
          format: {
            type: "json_schema",
            name: "support_guidance",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                category: {
                  type: "string",
                  enum: [
                    "therapy",
                    "psychiatry",
                    "support_group",
                    "community_resources",
                    "wellness_coaching",
                    "crisis_support"
                  ]
                },
                urgency: {
                  type: "string",
                  enum: ["low", "medium", "high"]
                },
                conversation_mode: {
                  type: "string",
                  enum: ["explore", "deepen", "redirect", "route_now", "crisis"]
                },
                reply: { type: "string" },
                follow_up_question: { type: "string" },
                next_steps: {
                  type: "array",
                  items: { type: "string" }
                },
                show_crisis_banner: { type: "boolean" }
              },
              required: [
                "category",
                "urgency",
                "conversation_mode",
                "reply",
                "follow_up_question",
                "next_steps",
                "show_crisis_banner"
              ]
            }
          }
        }
      })
    });

    const raw = await response.json();
    console.log("OPENAI RAW RESPONSE:", JSON.stringify(raw, null, 2));

    const text = raw.output?.[0]?.content?.[0]?.text;

    if (!text) {
      return res.json({
        category: "community_resources",
        urgency: "low",
        conversation_mode: "redirect",
        reply: "I’m here with you. Could you share a little more about what you’ve been experiencing lately?",
        follow_up_question: "What has been bothering you the most?",
        next_steps: [
          "Describe your main feeling in your own words",
          "Mention how long this has been going on",
          "Share whether it affects sleep, work, or relationships"
        ],
        show_crisis_banner: false,
        redirect_url: buildSanghaRedirect(userMessage)
      });
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (parseError) {
      console.error("JSON PARSE ERROR:", parseError);
      return res.json({
        category: "community_resources",
        urgency: "low",
        conversation_mode: "redirect",
        reply: text || "I’m here to help.",
        follow_up_question: "Can you tell me a little more about what feels hardest right now?",
        next_steps: [
          "Share the main symptom or emotion",
          "Mention how long you’ve felt this way"
        ],
        show_crisis_banner: false,
        redirect_url: buildSanghaRedirect(userMessage)
      });
    }

    res.json({
      category: parsed.category || "community_resources",
      urgency: parsed.urgency || "low",
      conversation_mode: parsed.conversation_mode || "explore",
      reply: parsed.reply || "I’m here to help.",
      follow_up_question: parsed.follow_up_question || "",
      next_steps: Array.isArray(parsed.next_steps) ? parsed.next_steps : [],
      show_crisis_banner: Boolean(parsed.show_crisis_banner),
      redirect_url: buildSanghaRedirect(userMessage, parsed)
    });

  } catch (error) {
    console.error("SERVER ERROR:", error);
    res.status(500).json({
      category: "community_resources",
      urgency: "low",
      conversation_mode: "redirect",
      reply: "Sorry, something went wrong on the server. Please try again in a moment.",
      follow_up_question: "What has been weighing on you most lately?",
      next_steps: [
        "Try again in a moment",
        "Talk to a trusted person",
        "Reach out to a local provider or support organization"
      ],
      show_crisis_banner: false,
      redirect_url: buildSanghaRedirect(userMessage)
    });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
