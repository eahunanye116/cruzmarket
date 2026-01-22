'use server';
/**
 * @fileOverview A flow for generating promotional tweets for CruzMarket.
 *
 * - generateTweet - A function that generates a tweet, optionally based on a trending topic.
 * - GenerateTweetInput - The input type for the generateTweet function.
 * - GenerateTweetOutput - The return type for the generateTweet function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateTweetInputSchema = z.object({
  topic: z.string().optional().nullable().describe('An optional trending topic to include in the tweet.'),
  tone: z.string().optional().nullable().describe('The desired tone for the tweet (e.g., "Hype", "Professional").'),
  trainingData: z.string().optional().nullable().describe("A sample text to guide the AI's tone and style."),
});
export type GenerateTweetInput = z.infer<typeof GenerateTweetInputSchema>;

const GenerateTweetOutputSchema = z.object({
  tweet: z.string().max(280).describe('The generated tweet content, up to 280 characters.'),
});
export type GenerateTweetOutput = z.infer<typeof GenerateTweetOutputSchema>;


const prompt = ai.definePrompt({
  name: 'generateTweetPrompt',
  input: { schema: GenerateTweetInputSchema },
  output: { schema: GenerateTweetOutputSchema },
  prompt: `
You are a savvy social media manager for "CruzMarket", a chaotic, high-octane trading platform for meme tickers.

**Your Task:**
Generate a short, engaging tweet (max 280 characters). Your behavior will change based on the instructions below. Use emojis to add personality. 🚀👑📈

**CRITICAL INSTRUCTION: TONE AND PROMOTION**
This is the most important part of your instructions.

{{#if tone}}
  **User-Provided Tone:** You MUST adopt the following tone: **{{{tone}}}**

  **SPECIAL INSTRUCTION: CHECK FOR "NO PROMOTION"**
  If the user's tone includes instructions like "do not promote", "don't promote", or "no brand mentions", you MUST follow these rules strictly:
  1.  **IGNORE CRUZMARKET:** Completely ignore your role as a social media manager for CruzMarket. Do not mention the brand, its features (like Cruz Mode), or its hashtags (#CruzMarket).
  2.  **AVOID FINANCIAL THEMES:** Do NOT write about trading, finance, meme coins, crypto, gains, P/L, or making money.
  3.  **FOCUS ON THE TONE:** Generate a tweet based *only* on the user's tone and the optional training data below. If a topic is provided, the tweet should be about that topic. If not, it should be a general engaging tweet matching the tone.
  4.  **HASHTAGS:** Use hashtags relevant to the topic or tone, NOT to CruzMarket or finance.

{{else}}
  **Default Tone:** You will adopt the default CruzMarket tone: Energetic, witty, slightly unhinged, and full of internet slang. You will promote the platform and use hashtags like #CruzMarket, #MemeCoin, #Crypto.
{{/if}}


{{#if trainingData}}
**CRITICAL TONE TRAINING:**
Your next highest priority is to learn from the following example. Analyze its style, voice, and vocabulary, and then adopt that exact tone for the tweet you generate. This is secondary only to a "no promotion" instruction.

**Training Example:**
\'\'\'
{{{trainingData}}}
\'\'\'
{{/if}}

**CONTENT INSTRUCTIONS:**

{{#if topic}}
  **Current Trend:**
  Generate a tweet about the following trending topic: "{{{topic}}}".
  (Remember to check for "no promotion" instructions in the tone above. If they exist, do not tie this topic to CruzMarket. If they don't, you should tie it to CruzMarket.)
{{else}}
  **General Tweet:**
  Generate a general-purpose tweet.
  (Remember to check for "no promotion" instructions. If they exist, create a generic engaging tweet based on the tone. If not, create a tweet that captures the essence of CruzMarket.)
{{/if}}

Generate the tweet now.
`,
});

const generateTweetFlow = ai.defineFlow(
  {
    name: 'generateTweetFlow',
    inputSchema: GenerateTweetInputSchema,
    outputSchema: GenerateTweetOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
      throw new Error("Failed to generate tweet");
    }
    return output;
  }
);


export async function generateTweet(input: GenerateTweetInput): Promise<GenerateTweetOutput> {
    const result = await generateTweetFlow(input);
    if (!result) {
        throw new Error('Tweet generation failed to produce an output.');
    }
    return result;
}
