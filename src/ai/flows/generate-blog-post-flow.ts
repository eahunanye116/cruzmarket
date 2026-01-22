'use server';
/**
 * @fileOverview A flow for generating blog posts about CruzMarket.
 */
import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateBlogPostInputSchema = z.object({
  topic: z.string().describe('The topic for the blog post.'),
  tone: z.string().optional().nullable().describe('The desired tone for the blog post (e.g., "Humorous", "Formal").'),
});
export type GenerateBlogPostInput = z.infer<typeof GenerateBlogPostInputSchema>;

const GenerateBlogPostOutputSchema = z.object({
  title: z.string().describe('A catchy, SEO-friendly title for the blog post.'),
  excerpt: z.string().max(300).describe('A short, engaging summary of the blog post, around 200-300 characters.'),
  content: z.string().describe('The full blog post content, formatted in Markdown. It should be well-structured with headings, lists, and bold text where appropriate. It must be engaging and informative.'),
  slug: z.string().describe("A URL-friendly slug for the blog post, e.g., 'how-to-trade-meme-coins'."),
  coverImageQuery: z.string().max(50).describe('A 2-3 word search query for Unsplash to find a suitable cover image for this blog post.'),
});
export type GenerateBlogPostOutput = z.infer<typeof GenerateBlogPostOutputSchema>;


const prompt = ai.definePrompt({
  name: 'generateBlogPostPrompt',
  input: { schema: GenerateBlogPostInputSchema },
  output: { schema: GenerateBlogPostOutputSchema },
  prompt: `
You are an expert financial journalist and meme culture analyst, writing for the official blog of "CruzMarket", a chaotic, high-octane trading platform for meme tickers.

**About CruzMarket:**
- It's a battleground where internet culture becomes currency and hype is the ultimate asset.
- Trading happens on a dynamic bonding curve.
- The vibe is chaotic, unpredictable, fun, and slightly unhinged—the wild west of meme finance.
- The audience is crypto-savvy, loves memes, and is looking for high-risk, high-reward opportunities.

**Your Task:**
Write a full, engaging, and SEO-friendly blog post about the following topic: **"{{{topic}}}"**.

**Tone Instructions:**
{{#if tone}}
Your most important instruction is to adopt the following tone for the blog post: **{{{tone}}}**.
{{else}}
Adopt the default CruzMarket tone: Authoritative yet accessible, mixing financial insights with meme culture references.
{{/if}}

**Output Requirements:**
Your output MUST be a JSON object that strictly follows the provided schema.
1.  **title**: Create a catchy, attention-grabbing title.
2.  **excerpt**: Write a short summary (200-300 characters) that hooks the reader.
3.  **content**: Write the full blog post in **Markdown format**.
    - Structure the post with headings ('##'), subheadings ('###'), bullet points ('-'), and bold text ('**...**') for readability.
    - The post should be around 300-400 words long.
    - End with a call to action encouraging readers to check out CruzMarket.
4.  **slug**: Generate a URL-friendly slug from the title (e.g., 'this-is-a-title').
5.  **coverImageQuery**: Provide a simple 2-3 word search query for Unsplash to find a relevant cover image. For example, if the topic is about crypto volatility, a good query would be 'rollercoaster chart'.

Generate the blog post now.
`,
});

const generateBlogPostFlow = ai.defineFlow(
    {
      name: 'generateBlogPostFlow',
      inputSchema: GenerateBlogPostInputSchema,
      outputSchema: GenerateBlogPostOutputSchema,
    },
    async (input) => {
      const { output } = await prompt(input);
      if (!output) {
        throw new Error("The AI model failed to return a valid blog post structure.");
      }
      // The AI sometimes generates slugs with spaces, so we'll fix that.
      output.slug = output.slug.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      return output;
    }
);


export async function generateBlogPost(input: GenerateBlogPostInput): Promise<GenerateBlogPostOutput> {
  const result = await generateBlogPostFlow(input);
  if (!result) {
    throw new Error('Blog post generation failed to produce a final output.');
  }
  return result;
}
