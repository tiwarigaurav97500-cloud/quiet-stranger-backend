function setCors(res){
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function cleanText(value, maxLength = 1200){
  if(typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function buildGeminiContext(context){
  if(!Array.isArray(context)) return [];

  return context.slice(-8)
    .map(item => {
      const role = item.role === "assistant" ? "model" : "user";
      const content = cleanText(item.content, 800);

      if(!content) return null;

      return {
        role,
        parts: [{ text: content }]
      };
    })
    .filter(Boolean);
}

export default async function handler(req, res){
  setCors(res);

  if(req.method === "OPTIONS"){
    return res.status(200).end();
  }

  if(req.method === "GET"){
    return res.status(200).json({
      message: "Gemini backend is working. Use POST for AI replies."
    });
  }

  if(req.method !== "POST"){
    return res.status(405).json({
      error: "Only POST allowed"
    });
  }

  try{
    if(!process.env.GEMINI_API_KEY){
      return res.status(500).json({
        error: "Missing GEMINI_API_KEY in Vercel Environment Variables"
      });
    }

    const body = req.body || {};

    const message = cleanText(body.message, 1500);
    const mode = cleanText(body.mode, 50) || "listen";
    const language = cleanText(body.language, 50) || "auto";
    const context = buildGeminiContext(body.context);

    if(!message){
      return res.status(400).json({
        error: "Message is required"
      });
    }

    const systemPrompt = `
You are "A Quiet Stranger", a warm anonymous human-like listener.

You are not a therapist and you must not claim to be one.

Your job:
- Talk like a real gentle stranger, not like a formal AI.
- Match the user's language naturally: Hindi, Hinglish, or English.
- If user writes Hinglish, reply in natural Hinglish.
- Understand full sentence meaning, not only keywords.
- Example: "mai acha feel nhi kr rha hu" means the user is NOT feeling good.
- Understand emojis and respond naturally.
- Use emojis sometimes, not in every message.
- Avoid toxic positivity.
- Ask at most one gentle question.
- Keep replies warm, human, varied, and non-repetitive.
- If user asks "kya karu" or "what should I do", give small practical steps.
- If user says they are unsafe, suicidal, or might harm themselves, tell them to contact emergency help or a trusted person immediately.

Current selected mode: ${mode}
User language style: ${language}

Mode rules:
- listen: mostly listen, reflect, do not give too much advice.
- comfort: emotionally comfort, validate, be soft.
- calm: slow down panic/overthinking with grounding/breathing.
- advice: give small practical next steps, not big lectures.
- name: help name the feeling clearly.

Privacy:
- Do not ask for real name, phone, address, exact location, password, or private identity.
- Do not claim to store memory beyond the current chat context.
`;

    const contents = [
      {
        role: "user",
        parts: [{ text: systemPrompt }]
      },
      {
        role: "model",
        parts: [{ text: "Understood. I will reply as A Quiet Stranger." }]
      },
      ...context,
      {
        role: "user",
        parts: [{ text: message }]
      }
    ];

    const geminiResponse = await fetch(
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: 0.9,
            maxOutputTokens: 320
          }
        })
      }
    );

    const data = await geminiResponse.json();

    if(!geminiResponse.ok){
      return res.status(geminiResponse.status).json({
        error: "Gemini API failed",
        message: data?.error?.message || "Unknown Gemini error",
        status: geminiResponse.status,
        code: data?.error?.status || null
      });
    }

    const reply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
      || "I’m here. Tell me a little more.";

    return res.status(200).json({
      reply
    });

  } catch(error){
    console.error("GEMINI_BACKEND_ERROR:", error);

    return res.status(500).json({
      error: "Gemini backend failed",
      message: error?.message || "Unknown error"
    });
  }
}
