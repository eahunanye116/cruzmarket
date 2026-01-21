'use server';

import { generateTweet, GenerateTweetInput } from '@/ai/flows/generate-tweet-flow';
import { revalidatePath } from 'next/cache';

// This is a placeholder function. In a real application, you would use
// a library like 'twitter-api-v2' and securely stored OAuth 1.0a credentials.
async function postTweetToX(tweet: string) {
  console.log("--- Posting to X (Simulated) ---");
  console.log(tweet);
  console.log("---------------------------------");
  // In a real app:
  // const client = new TwitterApi({ ...credentials });
  // await client.v2.tweet(tweet);
  return { success: true, message: "Tweet posted successfully (simulated)." };
}


export async function generateTweetAction(input: GenerateTweetInput) {
  try {
    const output = await generateTweet(input);
    return { success: true, tweet: output.tweet };
  } catch (error) {
    console.error(error);
    return { success: false, error: 'Failed to generate tweet.' };
  }
}

export async function postTweetAction(tweet: string) {
    if (!tweet || tweet.length === 0) {
        return { success: false, error: 'Cannot post an empty tweet.' };
    }
    if (tweet.length > 280) {
        return { success: false, error: 'Tweet exceeds 280 characters.' };
    }
    
    try {
        const result = await postTweetToX(tweet);
        revalidatePath('/admin'); // Revalidate to show updated state if needed
        return { success: true, message: result.message };
    } catch (error: any) {
        console.error(error);
        return { success: false, error: error.message || 'Failed to post tweet.' };
    }
}
