'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Wand2, Twitter } from 'lucide-react';
import { generateTweetAction, postTweetAction } from '@/app/actions/x-actions';

export function XManagement() {
  const { toast } = useToast();

  const [generalTweet, setGeneralTweet] = useState('');
  const [isGeneratingGeneral, setIsGeneratingGeneral] = useState(false);
  const [isPostingGeneral, setIsPostingGeneral] = useState(false);

  const [trendTopic, setTrendTopic] = useState('');
  const [trendTweet, setTrendTweet] = useState('');
  const [isGeneratingTrend, setIsGeneratingTrend] = useState(false);
  const [isPostingTrend, setIsPostingTrend] = useState(false);
  
  const handleGenerateGeneral = async () => {
    setIsGeneratingGeneral(true);
    setGeneralTweet('');
    const result = await generateTweetAction({ topic: null });
    if (result.success && result.tweet) {
      setGeneralTweet(result.tweet);
    } else {
      toast({ variant: 'destructive', title: 'Generation Failed', description: result.error });
    }
    setIsGeneratingGeneral(false);
  };
  
  const handlePostGeneral = async () => {
      setIsPostingGeneral(true);
      const result = await postTweetAction(generalTweet);
      if (result.success) {
          toast({ title: 'Tweet Posted!', description: result.message });
          setGeneralTweet(''); // Clear after posting
      } else {
          toast({ variant: 'destructive', title: 'Post Failed', description: result.error });
      }
      setIsPostingGeneral(false);
  }

  const handleGenerateTrend = async () => {
    if (!trendTopic) {
      toast({ variant: 'destructive', title: 'Missing Topic', description: 'Please enter a trending topic.' });
      return;
    }
    setIsGeneratingTrend(true);
    setTrendTweet('');
    const result = await generateTweetAction({ topic: trendTopic });
    if (result.success && result.tweet) {
      setTrendTweet(result.tweet);
    } else {
      toast({ variant: 'destructive', title: 'Generation Failed', description: result.error });
    }
    setIsGeneratingTrend(false);
  };

  const handlePostTrend = async () => {
      setIsPostingTrend(true);
      const result = await postTweetAction(trendTweet);
      if (result.success) {
          toast({ title: 'Tweet Posted!', description: result.message });
          setTrendTweet(''); // Clear after posting
      } else {
          toast({ variant: 'destructive', title: 'Post Failed', description: result.error });
      }
      setIsPostingTrend(false);
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>AI Tweet Generation</CardTitle>
          <CardDescription>
            Generate engaging, on-brand tweets about CruzMarket. The AI understands your platform's vibe.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={handleGenerateGeneral} disabled={isGeneratingGeneral}>
            {isGeneratingGeneral ? <Loader2 className="animate-spin" /> : <Wand2 />}
            Generate General Tweet
          </Button>
          <Textarea
            placeholder="Generated tweet will appear here..."
            value={generalTweet}
            onChange={(e) => setGeneralTweet(e.target.value)}
            rows={5}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleGenerateGeneral} disabled={isGeneratingGeneral || isPostingGeneral}>
                Regenerate
            </Button>
            <Button onClick={handlePostGeneral} disabled={!generalTweet || isPostingGeneral || isGeneratingGeneral}>
              {isPostingGeneral ? <Loader2 className="animate-spin" /> : <Twitter />}
              Approve & Post
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Trend Hijacking</CardTitle>
          <CardDescription>
            Input a trending topic from X, and the AI will draft a tweet to engage with the trend and promote the platform.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Input
              placeholder="e.g., #NewProfilePic"
              value={trendTopic}
              onChange={(e) => setTrendTopic(e.target.value)}
            />
            <Button onClick={handleGenerateTrend} disabled={isGeneratingTrend} className="w-full">
              {isGeneratingTrend ? <Loader2 className="animate-spin" /> : <Wand2 />}
              Generate Tweet from Trend
            </Button>
          </div>
          <Textarea
            placeholder="Generated tweet based on the trend will appear here..."
            value={trendTweet}
            onChange={(e) => setTrendTweet(e.target.value)}
            rows={5}
          />
           <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleGenerateTrend} disabled={isGeneratingTrend || isPostingTrend}>
                Regenerate
            </Button>
            <Button onClick={handlePostTrend} disabled={!trendTweet || isPostingTrend || isGeneratingTrend}>
              {isPostingTrend ? <Loader2 className="animate-spin" /> : <Twitter />}
              Approve & Post
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
