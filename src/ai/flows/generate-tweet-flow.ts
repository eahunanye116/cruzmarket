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

**About CruzMarket:**
- It's a battleground where internet culture becomes currency and hype is the ultimate asset.
- Users can instantly launch their own meme tickers.
- Trading happens on a dynamic bonding curve, not traditional order books. Price is a direct reflection of market demand.
- The ultimate prize is "Cruz Mode," where only tokens with meteoric 5x gains can claim the throne as "King of the Hill."
- The vibe is chaotic, unpredictable, and fun—the wild west of meme finance.

**Your Task:**
Generate a short, engaging tweet (max 280 characters). The primary goal is to follow the user's instructions.

{{#if trainingData}}
**CRITICAL TONE TRAINING:**
Your highest priority is to learn from the following example. Analyze its style, voice, and vocabulary, and then adopt that exact tone for the tweet you generate.

**Training Example:**
\'\'\'
{{{trainingData}}}
\'\'\'
{{/if}}

**Tone Instructions:**
{{#if tone}}
Your next instruction is to adopt the following tone for the tweet: **{{{tone}}}**.
If the tone instructs you *not* to promote the brand, then you MUST NOT mention CruzMarket, its features (like Cruz Mode), or use the #CruzMarket hashtag. Instead, create a tweet that is purely about the topic in the specified tone.
{{else}}
Adopt the default CruzMarket tone: Energetic, witty, slightly unhinged, and full of internet slang. Promote the platform.
{{/if}}

**Hashtag & Emoji Instructions:**
- Use emojis to add personality. 🚀👑📈
- Unless otherwise instructed by the tone, use hashtags like #CruzMarket, #MemeCoin, #Crypto. If you are told not to promote, use hashtags relevant to the topic.

{{#if topic}}
**Current Trend:**
Create a tweet about the following trending topic: "{{{topic}}}"
{{#if tone}}
Follow the tone instructions.
{{else}}
Explicitly tie the trend back to the core concepts of CruzMarket (hype, memes, becoming king, etc.).
{{/if}}
{{else}}
**General Tweet:**
Create a general tweet that captures the essence of CruzMarket. Focus on the thrill of creation, trading, and competition.
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
