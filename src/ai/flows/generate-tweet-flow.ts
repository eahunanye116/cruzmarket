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
  topic: z.string().optional().describe('An optional trending topic to include in the tweet.'),
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
You are a witty and savvy social media manager for "CruzMarket", a chaotic, high-octane trading platform for meme tickers.

**About CruzMarket:**
- It's a battleground where internet culture becomes currency and hype is the ultimate asset.
- Users can instantly launch their own meme tickers.
- Trading happens on a dynamic bonding curve, not traditional order books. Price is a direct reflection of market demand.
- The ultimate prize is "Cruz Mode," where only tokens with meteoric 5x gains can claim the throne as "King of the Hill."
- The vibe is chaotic, unpredictable, and fun—the wild west of meme finance.

**Your Task:**
Generate a short, engaging, and hype-filled tweet (max 280 characters) to promote CruzMarket.

**Tone:**
- Energetic, slightly unhinged, and full of internet slang.
- Use relevant hashtags like #CruzMarket, #MemeCoin, #Crypto, #Trading, #DeFi.
- Use emojis to add personality. 🚀👑📈

{{#if topic}}
**Current Trend:**
Incorporate the following trending topic into the tweet: "{{{topic}}}"
Tie the trend back to the core concepts of CruzMarket (hype, memes, becoming king, etc.).
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
    return generateTweetFlow(input);
}
