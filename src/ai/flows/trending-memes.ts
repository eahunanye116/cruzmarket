'use server';
/**
 * @fileOverview This file defines a Genkit flow for identifying and listing trending meme tickers.
 *
 * - trendingMemes - A function that retrieves a list of trending meme tickers.
 * - TrendingMemesInput - The input type for the trendingMemes function.
 * - TrendingMemesOutput - The return type for the trendingMemes function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const TrendingMemesInputSchema = z.object({
  memeTickers: z
    .array(z.object({
      tickerName: z.string(),
      recentActivity: z.string(),
      marketCap: z.number().optional(),
    }))
    .describe('An array of meme tickers with their recent activity and market cap.'),
  numberOfMemes: z.number().default(5).describe('The number of trending memes to return.'),
});
export type TrendingMemesInput = z.infer<typeof TrendingMemesInputSchema>;

const TrendingMemesOutputSchema = z.object({
  trendingMemes: z.array(z.string()).describe('A list of the most popular meme tickers.'),
});
export type TrendingMemesOutput = z.infer<typeof TrendingMemesOutputSchema>;

export async function trendingMemes(input: TrendingMemesInput): Promise<TrendingMemesOutput> {
  return trendingMemesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'trendingMemesPrompt',
  input: {schema: TrendingMemesInputSchema},
  output: {schema: TrendingMemesOutputSchema},
  prompt: `You are an AI assistant that identifies the most trending meme tickers from a list of meme tickers, their recent activity, and market capitalization.  Return a list of just the names of the trending meme tickers.

Meme Tickers: {{#each memeTickers}}{{{tickerName}}}: {{{recentActivity}}} (Market Cap: {{{marketCap}}}){{#unless @last}}, {{/unless}}{{/each}}

Trending Meme Tickers ({{numberOfMemes}}):
`,
});

const trendingMemesFlow = ai.defineFlow(
  {
    name: 'trendingMemesFlow',
    inputSchema: TrendingMemesInputSchema,
    outputSchema: TrendingMemesOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    const trendingMemes = output!.trendingMemes;
    return {trendingMemes};
  }
);

