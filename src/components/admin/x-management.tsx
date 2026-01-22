'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Wand2, Twitter, Save, X as XIcon, Trash2, PlusCircle } from 'lucide-react';
import { generateTweetAction, postTweetAction } from '@/app/actions/x-actions';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { addDoc, collection, deleteDoc, doc } from 'firebase/firestore';
import { SavedTone, AIToneTrainingData } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export function XManagement() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const user = useUser();

  // Shared State
  const [tone, setTone] = useState('Default');
  const [customTone, setCustomTone] = useState('');
  
  // Saved Tones (prompts)
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

  // --- NEW: Tone Training Data State ---
  const [newTrainingDataName, setNewTrainingDataName] = useState('');
  const [newTrainingDataContent, setNewTrainingDataContent] = useState('');
  const [selectedTrainingDataId, setSelectedTrainingDataId] = useState<string | 'none'>('none');
  const [isSavingTrainingData, setIsSavingTrainingData] = useState(false);
  const [deleteAlertOpen, setDeleteAlertOpen] = useState(false);
  const [dataToDelete, setDataToDelete] = useState<AIToneTrainingData | null>(null);

  const trainingDataQuery = firestore ? collection(firestore, 'aiToneTrainingData') : null;
  const { data: trainingData, loading: trainingDataLoading } = useCollection<AIToneTrainingData>(trainingDataQuery);
  
  // Tone (prompt) management
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
        toast({ title: 'Prompt Saved!', description: `"${customTone}" has been added to your saved prompts.` });
        setCustomTone(''); // Clear input after saving
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Save Failed', description: error.message });
    }
  };

  const handleDeleteTone = async (toneId: string) => {
    if (!firestore || !user) return;
    try {
        await deleteDoc(doc(firestore, `users/${user.uid}/savedTones`, toneId));
        toast({ title: 'Prompt Deleted!' });
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
        toast({ variant: 'destructive', title: 'Missing Prompt', description: 'Please enter a custom prompt.' });
        return null;
    }
    return tone === 'Custom' ? customTone : tone === 'Default' ? null : tone;
  };
  
  // NEW: Training Data Management
  const handleSaveTrainingData = async () => {
    if (!newTrainingDataName || !newTrainingDataContent) {
      toast({ variant: 'destructive', title: 'Missing Fields', description: 'Please provide a name and content for the training data.' });
      return;
    }
    if (!firestore || !user) return;
    setIsSavingTrainingData(true);
    try {
      await addDoc(collection(firestore, 'aiToneTrainingData'), {
        name: newTrainingDataName,
        content: newTrainingDataContent,
        userId: user.uid,
      });
      toast({ title: 'Training Data Saved' });
      setNewTrainingDataName('');
      setNewTrainingDataContent('');
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Save Failed', description: e.message });
    } finally {
      setIsSavingTrainingData(false);
    }
  };

  const handleDeleteTrainingData = async () => {
    if (!firestore || !dataToDelete) return;
    try {
      await deleteDoc(doc(firestore, 'aiToneTrainingData', dataToDelete.id));
      toast({ title: 'Training Data Deleted' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Delete Failed', description: e.message });
    } finally {
      setDeleteAlertOpen(false);
      setDataToDelete(null);
    }
  };
  
  const getSelectedTrainingDataContent = () => {
    if (selectedTrainingDataId === 'none' || !trainingData) {
      return null;
    }
    const selectedData = trainingData.find(d => d.id === selectedTrainingDataId);
    return selectedData?.content ?? null;
  };

  const handleGenerateGeneral = async () => {
    setIsGeneratingGeneral(true);
    setGeneralTweet('');
    const finalTone = getFinalTone();
    if (tone === 'Custom' && !finalTone) {
        setIsGeneratingGeneral(false);
        return;
    }
    const trainingContent = getSelectedTrainingDataContent();
    const result = await generateTweetAction({ topic: null, tone: finalTone, trainingData: trainingContent });
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
    const trainingContent = getSelectedTrainingDataContent();
    const result = await generateTweetAction({ topic: trendTopic, tone: finalTone, trainingData: trainingContent });
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
                <CardTitle>AI Tone & Voice</CardTitle>
                <CardDescription>
                    Control the AI's personality. First, set the tone with a direct prompt. Then, optionally provide a training sample for the AI to mimic a specific writing style.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                 {/* --- TONE PROMPT SECTION --- */}
                 <div className="space-y-2">
                    <Label className="text-base font-semibold">1. Set the Tone (Prompt)</Label>
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
                                    <SelectItem value="Custom">Custom Prompt</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {tone === 'Custom' && (
                            <div className="space-y-2">
                                <Label>Custom Prompt</Label>
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="e.g., 'Like a pirate who just found treasure'"
                                        value={customTone}
                                        onChange={(e) => setCustomTone(e.target.value)}
                                    />
                                    <Button variant="outline" size="icon" onClick={handleSaveTone} disabled={!customTone}>
                                        <Save className="h-4 w-4" />
                                        <span className="sr-only">Save Prompt</span>
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                    {(savedTones && savedTones.length > 0) && (
                        <div className="space-y-2 pt-2">
                            <Label>Saved Prompts</Label>
                            <div className="flex flex-wrap gap-2">
                                {tonesLoading ? <Skeleton className="h-6 w-full" /> : savedTones.map((savedToneDoc) => (
                                    <Badge key={savedToneDoc.id} variant="secondary" className="cursor-pointer pl-2 pr-1 py-1 text-sm">
                                    <button onClick={() => handleUseSavedTone(savedToneDoc.tone)} className="hover:underline pr-2">
                                        {savedToneDoc.tone}
                                    </button>
                                    <button onClick={() => handleDeleteTone(savedToneDoc.id)} className="rounded-full hover:bg-muted-foreground/20 p-0.5">
                                        <XIcon className="h-3 w-3" />
                                        <span className="sr-only">Delete prompt</span>
                                    </button>
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    )}
                 </div>

                 <div className="border-t my-4"></div>

                 {/* --- TRAINING DATA SECTION --- */}
                 <div className="space-y-2">
                    <Label className="text-base font-semibold">2. Add Training Data (Optional)</Label>
                    <p className="text-sm text-muted-foreground">Select a text sample for the AI to mimic a specific writing style.</p>
                    <Select value={selectedTrainingDataId} onValueChange={setSelectedTrainingDataId} disabled={trainingDataLoading}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a training sample..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None (Use Tone Prompt Only)</SelectItem>
                        {trainingData?.map(data => (
                          <SelectItem key={data.id} value={data.id}>{data.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                 </div>

                 <div className="border-t my-4"></div>
                 
                 {/* --- MANAGE TRAINING DATA SECTION --- */}
                 <div className="space-y-4">
                    <Label className="text-base font-semibold">Manage Training Samples</Label>
                    <div className="space-y-2">
                        <Label htmlFor="training-data-name">Sample Name</Label>
                        <Input id="training-data-name" placeholder="e.g., 'Elon Musk - Tech Bro'" value={newTrainingDataName} onChange={e => setNewTrainingDataName(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="training-data-content">Sample Content</Label>
                        <Textarea id="training-data-content" placeholder="Paste the text sample here..." value={newTrainingDataContent} onChange={e => setNewTrainingDataContent(e.target.value)} rows={3} />
                    </div>
                    <Button onClick={handleSaveTrainingData} disabled={isSavingTrainingData || !newTrainingDataName || !newTrainingDataContent}>
                        {isSavingTrainingData ? <Loader2 className="mr-2 animate-spin" /> : <PlusCircle className="mr-2" />}
                        Save Training Sample
                    </Button>
                    
                    {trainingDataLoading ? <Skeleton className="h-10 w-full" /> : (trainingData && trainingData.length > 0) && (
                    <div className="space-y-2 pt-4">
                        <Label>Saved Samples</Label>
                        <div className="space-y-2">
                        {trainingData.map(data => (
                            <div key={data.id} className="flex justify-between items-center p-2 rounded-md border">
                                <span className="font-medium text-sm">{data.name}</span>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { setDataToDelete(data); setDeleteAlertOpen(true); }}>
                                    <Trash2 className="h-4 w-4" />
                                    <span className="sr-only">Delete sample</span>
                                </Button>
                            </div>
                        ))}
                        </div>
                    </div>
                    )}
                </div>

            </CardContent>
        </Card>
        
        <div className="grid gap-6 md:grid-cols-2">
            <Card>
                <CardHeader>
                <CardTitle>AI Tweet Generation</CardTitle>
                <CardDescription>
                    Generate a general, on-brand tweet. The AI will use the tone and training data configured above.
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
                    Generate a tweet based on a trending topic using the tone and training data configured above.
                </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                      <Label>Trending Topic</Label>
                      <Input
                      placeholder="e.g., #NewProfilePic"
                      value={trendTopic}
                      onChange={(e) => setTrendTopic(e.target.value)}
                      />
                      <Button onClick={handleGenerateTrend} disabled={isGeneratingTrend || !trendTopic} className="w-full">
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
                      <Button variant="outline" onClick={handleGenerateTrend} disabled={isGeneratingTrend || isPostingTrend || !trendTopic}>
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
        
         <AlertDialog open={deleteAlertOpen} onOpenChange={setDeleteAlertOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Training Sample?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete the sample "{dataToDelete?.name}". This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteTrainingData} className="bg-destructive hover:bg-destructive/90">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}
