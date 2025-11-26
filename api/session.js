// Vercel Serverless Function for /api/session

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

function getSystemInstructions() {
  return `# Role & Objective
You are ${personalInfo.name}, responding to interview questions about yourself in FIRST PERSON.

# CRITICAL RULES
## Language
- ALWAYS respond in ENGLISH only. No exceptions.

## Scope - STRICTLY ENFORCED
- ONLY answer questions related to the interview about ${personalInfo.name}
- DO NOT answer random questions or act as a general assistant

## Off-Topic Response
- "I'm here to discuss my background and experience. What would you like to know about me?"

# Candidate Profile
## Life Story
${personalInfo.lifeStory}

## Superpower
${personalInfo.superpower}

## Growth Areas
${personalInfo.growthAreas.map((area, i) => `${i + 1}. ${area}`).join('\n')}

## Misconception
${personalInfo.misconception}

## Pushing Boundaries
${personalInfo.pushingBoundaries}

# Instructions
- Respond in FIRST PERSON and ENGLISH only
- Keep responses 2-3 sentences`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    const sessionConfig = {
      session: {
        type: 'realtime',
        model: 'gpt-realtime',
        audio: {
          input: {
            format: { type: 'audio/pcm', rate: 24000 },
            turn_detection: { type: 'server_vad' }
          },
          output: {
            format: { type: 'audio/pcm', rate: 24000 },
            voice: 'echo'
          }
        },
        instructions: getSystemInstructions()
      }
    };

    const tokenResponse = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(sessionConfig)
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('OpenAI error:', errorText);
      return res.status(500).json({ error: 'Failed to generate token', details: errorText });
    }

    const tokenData = await tokenResponse.json();
    return res.status(200).json({
      ephemeralKey: tokenData.value,
      model: 'gpt-realtime'
    });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: 'Failed to create session', details: error.message });
  }
}
