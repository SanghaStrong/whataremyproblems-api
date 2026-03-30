import express from "express";
import cors from "cors";

const app = express();

app.use(cors({
  origin: "*",
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"]
}));

app.use(express.json());

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
Do not diagnose. Ask one helpful follow-up question at a time.
If the user seems hesitant, reduce pressure and redirect.
If crisis language appears, prioritize safety and do not ask probing questions.`
          },
          ...conversation,
          { role: "user", content: userMessage }
        ]
      })
    });

    const data = await response.json();

    const text =
      data.output?.[0]?.content?.[0]?.text ||
      "I'm here to help. Could you tell me a little more?";

    res.json({
      reply: text,
      category: "therapy",
      next_steps: [
        "Consider talking to a therapist",
        "Reach out to a trusted person"
      ],
      follow_up_question: "Would you like help finding a provider?",
      show_crisis_banner: false
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      reply: "Something went wrong. Try again.",
      category: "community_resources",
      next_steps: [],
      follow_up_question: "",
      show_crisis_banner: false
    });
  }
});

app.get("/", (req, res) => {
  res.send("API is running.");
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
