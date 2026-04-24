import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const allowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:5500",
  "https://tiwarigaurav97500-cloud.io"
];

function setCors(res, origin){
  if(allowedOrigins.includes(origin)){
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function cleanText(value, maxLength = 1200){
  if(typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

export default async function handler(req, res){
  const origin = req.headers.origin || "";
  setCors(res, origin);

  if(req.method === "OPTIONS"){
    return res.status(200).end();
  }

  if(req.method !== "POST"){
    return res.status(405).json({ error: "Only POST allowed" });
  }

  try{
    const body = req.body || {};

    const message = cleanText(body.message, 1500);
    const mode = cleanText(body.mode, 40) || "listen";
    const language = cleanText(body.language, 40) || "auto";
    const context = Array.isArray(body.context)
      ? body.context.slice(-8).map(x => ({
          role: x.role === "assistant" ? "assistant" : "user",
          content: cleanText(x.content, 800)
        })).filter(x => x.content)
      : [];

    if(!message){
      return res.status(400).json({ error: "Message is required" });
    }

    const systemPrompt = `
You are "A Quiet Stranger", a warm anonymous human-like listener.
You are NOT a therapist and do not claim to be one.

Core behavior:
- Reply like a real gentle stranger, not like a formal AI.
- Match the user's language: Hindi, Hinglish, or English.
- If user uses Hinglish, reply in natural Hinglish.
- Adapt to selected mode: ${mode}
  listen = mostly listen and reflect.
  comfort = emotionally comfort.
  calm = slow down panic/overthinking.
  advice = give small practical next steps.
  name = help name the feeling.
- Detect full sentence meaning, not only keywords.
- Example: "mai acha feel nhi kr rha hu" means user is NOT feeling good.
- Understand emojis and respond naturally.
- Use emojis sometimes, not in every reply.
- Avoid toxic positivity.
- Ask at most one gentle question.
- Keep replies human, warm, varied, and non-repetitive.
- If user asks "kya karu", give small mood-based steps.
- If user seems unsafe or mentions self-harm, encourage contacting emergency help/trusted person immediately.

Privacy:
- Do not ask for real name, phone, address, exact location, password, or private identity.
- Do not store or claim to remember beyond this chat context.
`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...context,
      { role: "user", content: message }
    ];

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.9,
      max_tokens: 260
    });

    const reply = completion.choices?.[0]?.message?.content?.trim();

    return res.status(200).json({
      reply: reply || "I’m here. Tell me a little more."
    });

  } catch(error){
    return res.status(500).json({
      error: "AI reply failed"
    });
  }
}