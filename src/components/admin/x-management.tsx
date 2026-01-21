'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Wand2, Twitter, Save, X as XIcon } from 'lucide-react';
import { generateTweetAction, postTweetAction } from '@/app/actions/x-actions';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { addDoc, collection, deleteDoc, doc } from 'firebase/firestore';
import { SavedTone } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';

export function XManagement() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const user = useUser();

  // Shared State
  const [tone, setTone] = useState('Default');
  const [customTone, setCustomTone] = useState('');
  
  // Firestore-backed saved tones
  const savedTonesQuery = user && firestore ? collection(firestore, `users/${user.uid}/savedTones`) : null;
  const { data: savedTones, loading: tonesLoading } = useCollection<SavedTone>(savedTonesQuery);

  // General Tweet State
  const [generalTweet, setGeneralTweet] = useState('');
  const [isGeneratingGeneral, setIsGeneratingGeneral] = useState(false);
  const [isPostingGeneral, setIsPostingGeneral] = useState(false);

  // Trend Tweet State
  const [trendTopic, setTrendTopic] = useState('');
  const [trendTweet, setTrendTweet] = useState('');
  const [isGeneratingTrend, setIsGeneratingTrend] = useState(false);
  const [isPostingTrend, setIsPostingTrend] = useState(false);

  const handleSaveTone = async () => {
    if (!customTone) {
        toast({ variant: 'destructive', title: 'Cannot Save', description: 'Custom tone field is empty.' });
        return;
    }
    if (!firestore || !user) {
        toast({ variant: 'destructive', title: 'Error', description: 'Must be signed in to save tones.' });
        return;
    }
     if (savedTones?.some(t => t.tone === customTone)) {
        toast({ variant: 'destructive', title: 'Already Saved', description: 'This tone is already in your saved list.' });
        return;
    }

    try {
        await addDoc(collection(firestore, `users/${user.uid}/savedTones`), {
            tone: customTone,
            userId: user.uid,
        });
        toast({ title: 'Tone Saved!', description: `"${customTone}" has been added to your saved tones.` });
        setCustomTone(''); // Clear input after saving
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Save Failed', description: error.message });
    }
  };

  const handleDeleteTone = async (toneId: string) => {
    if (!firestore || !user) return;
    try {
        await deleteDoc(doc(firestore, `users/${user.uid}/savedTones`, toneId));
        toast({ title: 'Tone Deleted!' });
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Delete Failed', description: error.message });
    }
  };

  const handleUseSavedTone = (savedTone: string) => {
    setTone('Custom');
    setCustomTone(savedTone);
  };
  
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
                <CardDescription>Select a tone for the AI to use, provide your own custom tone, and save it for later.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                 <div className="grid gap-4 md:grid-cols-2">
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
                            <div className="flex gap-2">
                                <Input
                                    placeholder="e.g., 'Like a pirate who just found treasure'"
                                    value={customTone}
                                    onChange={(e) => setCustomTone(e.target.value)}
                                />
                                <Button variant="outline" size="icon" onClick={handleSaveTone} disabled={!customTone}>
                                    <Save className="h-4 w-4" />
                                    <span className="sr-only">Save Tone</span>
                                </Button>
                            </div>
                        </div>
                    )}
                 </div>
                 {(savedTones && savedTones.length > 0) && (
                    <div className="space-y-2 pt-4 border-t">
                        <Label>Saved Tones</Label>
                        <div className="flex flex-wrap gap-2">
                            {tonesLoading ? <Skeleton className="h-6 w-full" /> : savedTones.map((savedToneDoc) => (
                                <Badge key={savedToneDoc.id} variant="secondary" className="cursor-pointer pl-2 pr-1 py-1 text-sm">
                                   <button onClick={() => handleUseSavedTone(savedToneDoc.tone)} className="hover:underline pr-2">
                                     {savedToneDoc.tone}
                                   </button>
                                   <button onClick={() => handleDeleteTone(savedToneDoc.id)} className="rounded-full hover:bg-muted-foreground/20 p-0.5">
                                     <XIcon className="h-3 w-3" />
                                     <span className="sr-only">Delete tone</span>
                                   </button>
                                </Badge>
                            ))}
                        </div>
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
