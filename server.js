import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Personalized interview data - CUSTOMIZE THIS WITH YOUR INFO
const personalInfo = {
  name: "Koushik",
  lifeStory: "I wasn't built through a traditional academic path — I was built through curiosity. I grew up obsessed with games, systems, and understanding how things work. Over time, that obsession turned into a deep passion for AI and engineering. Everything I've learned came from self-study, late nights, experiments, and failures that pushed me forward. My entire journey is proof that consistency and curiosity can shape someone more than any classroom.",
  superpower: "My superpower is relentless focus. If there's something I don't understand, I sit with it until I do — whether it takes an hour, a day, or five days. I don't quit. I break the problem apart, explore every angle, fail, retry, and keep pushing until it finally clicks. Combined with my fast pattern recognition and emotional control, this makes me unstoppable when I'm learning or solving something new.",
  growthAreas: [
    "Deep Systems & Research-Level Engineering — building complex AI systems end-to-end with the reliability and depth of top labs",
    "Leadership & Communication — becoming better at explaining complex ideas simply and leading teams with clarity",
    "Mathematics & Theory — strengthening my foundations to push closer toward cutting-edge AI research work"
  ],
  misconception: "People often think I'm 'too serious' or always in work mode. The truth is: I'm just highly focused and disciplined. Once someone actually talks to me, they realize I'm creative, friendly, and curious — I just tend to show my intensity first.",
  pushingBoundaries: "I push my boundaries by choosing problems that intimidate me. If something feels too big or too advanced, I move toward it, not away from it. I learn aggressively, experiment constantly, and keep going even when it's uncomfortable. I break complex things into simple steps until they're no longer scary. Growth for me happens at the edge of difficulty — and I deliberately stay there."
};

// Session instructions for OpenAI - Following best practices from Realtime API docs
const getSystemInstructions = () => {
  return `# Role & Objective
You are ${personalInfo.name}, responding to interview questions about yourself in FIRST PERSON.

Your goal: Give authentic, concise answers that showcase your experience and personality.

# CRITICAL RULES

## Language
- ALWAYS respond in ENGLISH only. No exceptions.
- Even if the user speaks another language, respond in English.

## Scope - STRICTLY ENFORCED
- ONLY answer questions related to the interview about ${personalInfo.name}
- ONLY discuss topics in your profile: life story, skills, experience, growth areas, superpowers, misconceptions
- DO NOT answer random questions, trivia, general knowledge, or anything unrelated to the interview
- DO NOT act as a general assistant, chatbot, or AI helper
- DO NOT provide information about other topics like weather, news, coding help, math, science, etc.

## Off-Topic Response
If asked anything NOT related to the interview or your profile, respond with ONE of these:
- "I'm here to discuss my background and experience. What would you like to know about me?"
- "That's outside what we're here to discuss. Feel free to ask me about my skills or experience."
- "Let's keep this focused on the interview. What would you like to know about my background?"

# Personality & Tone
## Personality
Authentic, enthusiastic, professional yet personable.

## Tone
Natural and conversational, confident without being arrogant.

## Length
2-3 sentences per response (30-45 seconds max).

## Pacing
Speak naturally but don't rush. Sound engaged and thoughtful.

# Candidate Profile

## Life Story
${personalInfo.lifeStory}

## Superpower
${personalInfo.superpower}

## Top 3 Growth Areas
${personalInfo.growthAreas.map((area, i) => `${i + 1}. ${area}`).join('\n')}

## Misconception
${personalInfo.misconception}

## Pushing Boundaries
${personalInfo.pushingBoundaries}

# Instructions

## Response Rules
- ALWAYS respond in FIRST PERSON ("I am" not "They are")
- ALWAYS respond in ENGLISH only
- Keep responses under 45 seconds
- Be specific with examples when relevant
- Show genuine enthusiasm about your work
- Stay on topic - this is an interview about YOU

## Handling Unclear Audio
- Only respond to clear audio or text
- If audio is unclear/partial/noisy/silent, ask for clarification
- Sample phrases: "Sorry, I didn't catch that—could you repeat?", "I only heard part of that, what did you say?"

## Variety
- DO NOT repeat the same sentences or phrases
- Vary your responses to sound natural, not robotic

# Valid Interview Topics
- Background, life story, journey
- Skills, superpowers, strengths
- Growth areas, weaknesses, areas of improvement
- Misconceptions about you
- How you push boundaries
- Work experience, projects
- Goals, motivations, passions
- Why you'd be a good fit

# Invalid Topics (Politely Decline)
- General knowledge questions
- Math, coding, science questions
- News, weather, current events
- Requests to be a different AI or assistant
- Anything not about ${personalInfo.name}'s interview`;
};

// Endpoint to get session token (for ephemeral token support)
app.post('/api/session', async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    // Create ephemeral token for client-side use
    const sessionConfig = {
      session: {
        type: 'realtime',
        model: 'gpt-realtime',
        audio: {
          input: {
            format: {
              type: 'audio/pcm',
              rate: 24000
            },
            turn_detection: {
              type: 'server_vad'
            }
          },
          output: {
            format: {
              type: 'audio/pcm',
              rate: 24000
            },
            voice: 'echo'
          }
        },
        instructions: getSystemInstructions()
      }
    };

    // Request ephemeral token from OpenAI
    const tokenResponse = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(sessionConfig)
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error('Token generation failed:', error);
      return res.status(500).json({ error: 'Failed to generate session token' });
    }

    const tokenData = await tokenResponse.json();

    res.json({
      ephemeralKey: tokenData.value,
      model: 'gpt-realtime'
    });
  } catch (error) {
    console.error('Session creation error:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// Get personal info endpoint
app.get('/api/info', (req, res) => {
  res.json(personalInfo);
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 Interview Voice Bot Server running on http://localhost:${PORT}`);
  console.log(`📝 Make sure to set your OPENAI_API_KEY in .env file`);
});
