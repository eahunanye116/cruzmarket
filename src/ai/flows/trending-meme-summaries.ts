 'use server';
/**
 * @fileOverview This file defines a Genkit flow for generating a short summary of why a meme ticker is trending.
 *
 * - trendingMemeSummaries - A function that generates the trending meme summary.
 * - TrendingMemeSummariesInput - The input type for the trendingMemeSummaries function.
 * - TrendingMemeSummariesOutput - The return type for the trendingMemeSummaries function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const TrendingMemeSummariesInputSchema = z.object({
  tickerName: z.string().describe('The name of the meme ticker.'),
  recentActivity: z.string().describe('A description of recent trading activity and price appreciation for the meme ticker.'),
});
export type TrendingMemeSummariesInput = z.infer<typeof TrendingMemeSummariesInputSchema>;

const TrendingMemeSummariesOutputSchema = z.object({
  summary: z.string().describe('A short, AI-generated summary of why the meme ticker is trending.'),
});
export type TrendingMemeSummariesOutput = z.infer<typeof TrendingMemeSummariesOutputSchema>;

export async function trendingMemeSummaries(input: TrendingMemeSummariesInput): Promise<TrendingMemeSummariesOutput> {
  return trendingMemeSummariesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'trendingMemeSummariesPrompt',
  input: {schema: TrendingMemeSummariesInputSchema},
  output: {schema: TrendingMemeSummariesOutputSchema},
  prompt: `You are an AI assistant that summarizes why a meme ticker is trending. Use the recent activity to create a concise summary.

Meme Ticker Name: {{{tickerName}}}
Recent Activity: {{{recentActivity}}}

Summary: `,
});

const trendingMemeSummariesFlow = ai.defineFlow(
  {
    name: 'trendingMemeSummariesFlow',
    inputSchema: TrendingMemeSummariesInputSchema,
    outputSchema: TrendingMemeSummariesOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
