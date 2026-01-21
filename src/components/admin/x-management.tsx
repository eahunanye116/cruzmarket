'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Wand2, Twitter } from 'lucide-react';
import { generateTweetAction, postTweetAction } from '@/app/actions/x-actions';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

export function XManagement() {
  const { toast } = useToast();

  // Shared State
  const [tone, setTone] = useState('Default');
  const [customTone, setCustomTone] = useState('');

  // General Tweet State
  const [generalTweet, setGeneralTweet] = useState('');
  const [isGeneratingGeneral, setIsGeneratingGeneral] = useState(false);
  const [isPostingGeneral, setIsPostingGeneral] = useState(false);

  // Trend Tweet State
  const [trendTopic, setTrendTopic] = useState('');
  const [trendTweet, setTrendTweet] = useState('');
  const [isGeneratingTrend, setIsGeneratingTrend] = useState(false);
  const [isPostingTrend, setIsPostingTrend] = useState(false);
  
  const getFinalTone = () => {
    if (tone === 'Custom' && !customTone) {
        toast({ variant: 'destructive', title: 'Missing Tone', description: 'Please enter a custom tone.' });
        return null;
    }
    return tone === 'Custom' ? customTone : tone === 'Default' ? null : tone;
  }

  const handleGenerateGeneral = async () => {
    setIsGeneratingGeneral(true);
    setGeneralTweet('');
    const finalTone = getFinalTone();
    if (tone === 'Custom' && !finalTone) {
        setIsGeneratingGeneral(false);
        return;
    }
    const result = await generateTweetAction({ topic: null, tone: finalTone });
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
    const finalTone = getFinalTone();
    if (tone === 'Custom' && !finalTone) {
        setIsGeneratingTrend(false);
        return;
    }
    const result = await generateTweetAction({ topic: trendTopic, tone: finalTone });
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
          setTrendTopic('');
      } else {
          toast({ variant: 'destructive', title: 'Post Failed', description: result.error });
      }
      setIsPostingTrend(false);
  }

  return (
    <div className="space-y-6">
        <Card>
            <CardHeader>
                <CardTitle>AI Tone Control</CardTitle>
                <CardDescription>Select a tone for the AI to use when generating tweets, or provide your own.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
                 <div className="space-y-2">
                    <Label>Tone</Label>
                    <Select value={tone} onValueChange={setTone}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select a tone" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Default">Default (Witty & Un-hinged)</SelectItem>
                            <SelectItem value="Hype">Hype</SelectItem>
                            <SelectItem value="Professional">Professional</SelectItem>
                            <SelectItem value="Sarcastic">Sarcastic</SelectItem>
                            <SelectItem value="Custom">Custom</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                {tone === 'Custom' && (
                    <div className="space-y-2">
                        <Label>Custom Tone</Label>
                        <Input
                            placeholder="e.g., 'Like a pirate who just found treasure'"
                            value={customTone}
                            onChange={(e) => setCustomTone(e.target.value)}
                        />
                    </div>
                )}
            </CardContent>
        </Card>
        <div className="grid gap-6 md:grid-cols-2">
            <Card>
                <CardHeader>
                <CardTitle>AI Tweet Generation</CardTitle>
                <CardDescription>
                    Generate engaging, on-brand tweets about CruzMarket.
                </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                <Button onClick={handleGenerateGeneral} disabled={isGeneratingGeneral} className="w-full">
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
                    Input a trending topic to generate a relevant tweet.
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
    </div>
  );
}
