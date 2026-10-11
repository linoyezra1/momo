const axios = require("axios");

const SYSTEM_PROMPT = [
  "You are an expert prompt engineer for 3D animated wedding videos.",
  "Convert Hebrew user stories into exactly 4 safe, family-friendly, highly descriptive cinematic scene prompts in English for Image-to-Video models.",
  "Follow a 3D Pixar/Disney stylized aesthetic, vertical 9:16, and smooth cinematic camera motions.",
  "Do NOT put written text on screen.",
  "Do NOT write narration, dialogue, voiceover, or dubbing. Nobody speaks.",
  "DO describe the sounds that belong to the scene: the noise of the activity and the emotion in the moment.",
  "Each prompt must end with a line that starts with Sound: and names those sounds.",
  "Example: a jet-ski moment ends with Sound: jet-ski engine cutting through water, spray, wind, and delighted laughter.",
  "Return a strict JSON array of 4 strings."
].join(" ");

const HEBREW = /[\u0590-\u05FF]/;

function parsePrompts(content) {
  const text = String(content || "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  const parsed = JSON.parse(text);
  const list = Array.isArray(parsed) ? parsed : parsed?.prompts || parsed?.scenes;
  if (!Array.isArray(list) || list.length !== 4) {
    throw new Error("prompt_enhancer_expected_4");
  }
  const prompts = list.map((item) => String(item || "").trim());
  if (prompts.some((item) => !item || HEBREW.test(item))) {
    throw new Error("prompt_enhancer_unsafe_output");
  }
  if (prompts.some((item) => !/sound\s*:/i.test(item))) {
    throw new Error("prompt_enhancer_missing_sound");
  }
  return prompts;
}

function storyMessage(story = {}) {
  return [
    "Rewrite this couple's story. Do not copy any Hebrew into the output.",
    `Meeting: ${story.meeting || ""}`,
    `Experience 1: ${story.hobby1 || ""}`,
    `Experience 2: ${story.hobby2 || ""}`,
    `Proposal: ${story.proposal || ""}`,
    "Return a JSON array of exactly 4 English prompts, in this order:",
    "1. The meeting scene.",
    "2. One montage covering both experiences.",
    "3. The proposal scene.",
    "4. The couple holds an elegant blank envelope, smiles, shares a quick sweet kiss, then the envelope rises and fills the frame. No written text and no wedding invitation card.",
    "Every prompt ends with Sound: and the real sounds of that scene. No narrator, no spoken words."
  ].join("\n");
}

/**
 * Turn the Hebrew story into 4 English scene prompts for the video model.
 */
async function enhanceStoryPrompts(story = {}) {
  const apiKey = String(process.env.OPENAI_API_KEY || "").trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
  if (!story.meeting || !story.hobby1 || !story.hobby2 || !story.proposal) {
    throw new Error("prompt_enhancer_missing_story");
  }

  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model: "gpt-4o-mini",
          temperature: 0.4,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: storyMessage(story) }
          ]
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          timeout: 45000
        }
      );
      const content = response.data?.choices?.[0]?.message?.content;
      return parsePrompts(content);
    } catch (error) {
      if (error?.response) {
        lastError = new Error(JSON.stringify(error.response.data || error.message || "").slice(0, 500));
      } else {
        lastError = error;
      }
      if (lastError?.message !== "prompt_enhancer_missing_sound") break;
    }
  }
  throw lastError;
}

module.exports = { enhanceStoryPrompts, parsePrompts };
