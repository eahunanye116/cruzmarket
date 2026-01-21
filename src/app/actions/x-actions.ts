'use server';

import { generateTweet, GenerateTweetInput } from '@/ai/flows/generate-tweet-flow';
import { revalidatePath } from 'next/cache';
import { TwitterApi } from 'twitter-api-v2';

// This function now uses environment variables to post to X.
async function postTweetToX(tweet: string) {
  const { X_APP_KEY, X_APP_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET } = process.env;

  if (!X_APP_KEY || !X_APP_SECRET || !X_ACCESS_TOKEN || !X_ACCESS_SECRET) {
      console.error("X API credentials are not configured in environment variables.");
      // In a production app, you might want to throw an error or return a more specific message.
      // For this simulation, we'll log it and proceed as if it was a simulation.
      console.log("--- Posting to X (Simulated due to missing credentials) ---");
      console.log(tweet);
      console.log("----------------------------------------------------------");
      return { success: true, message: "Tweet posted successfully (simulated - credentials missing)." };
  }

  try {
    const client = new TwitterApi({
      appKey: X_APP_KEY,
      appSecret: X_APP_SECRET,
      accessToken: X_ACCESS_TOKEN,
      accessSecret: X_ACCESS_SECRET,
    });

    // Using v2 for tweeting
    const rwClient = client.readWrite;
    await rwClient.v2.tweet(tweet);

    return { success: true, message: "Tweet posted successfully to X." };
  } catch (error: any) {
    console.error("Failed to post tweet to X:", error);
    // Return the actual error message for better debugging on the admin panel
    throw new Error(error.message || "An unknown error occurred while posting to X.");
  }
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
