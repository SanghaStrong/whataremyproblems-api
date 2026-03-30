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

app.post("/api/chat", async (req, res) => {
  const conversation = Array.isArray(req.body.conversation) ? req.body.conversation : [];
  const userMessage = String(req.body.message || "");

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

You are not a doctor and you do not diagnose.
Your job is to:
- briefly validate what the person shared
- ask one adaptive follow-up question at a time
- go deeper only when the person seems open
- back off and redirect if the person seems resistant, hesitant, or overwhelmed
- choose one guidance category
- suggest practical next steps
- show crisis guidance immediately if the person may be in immediate danger

Allowed categories:
therapy
psychiatry
support_group
community_resources
wellness_coaching
crisis_support

Conversation modes:
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

Ask only one follow-up question.
Do not ask for graphic details.
Do not pressure the user.
Keep the tone warm, simple, and non-judgmental.`
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

    const data = await response.json();
    const text = data.output?.[0]?.content?.[0]?.text || "{}";
    const result = JSON.parse(text);

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      category: "community_resources",
      urgency: "low",
      conversation_mode: "redirect",
      reply: "Sorry, something went wrong. I can still suggest general support options if you try again.",
      follow_up_question: "Would you like to share a little more about what feels hardest right now?",
      next_steps: [
        "Try again in a moment",
        "Talk to a trusted person",
        "Reach out to a local provider or support organization"
      ],
      show_crisis_banner: false
    });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
