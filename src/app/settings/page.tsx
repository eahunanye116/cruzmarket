
'use client';

import { useUser, useDoc, useFirestore } from '@/firebase';
import { UserProfile } from '@/lib/types';
import { doc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Ban, Settings, Send, CheckCircle2, AlertCircle, Trash2, ExternalLink } from 'lucide-react';
import { generateTelegramLinkingCode, unlinkTelegramAction, getTelegramBotUsername } from '@/app/actions/telegram-actions';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

export default function SettingsPage() {
  const user = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const userRef = user && firestore ? doc(firestore, 'users', user.uid) : null;
  const { data: profile, loading } = useDoc<UserProfile>(userRef);

  const [isGenerating, setIsGenerating] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [botUsername, setBotUsername] = useState('cruzmarketfunbot');

  useEffect(() => {
    getTelegramBotUsername().then(setBotUsername);
  }, []);

  if (!user) {
    return (
      <div className="container mx-auto py-12 px-4 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-none bg-destructive/10 border-2 mx-auto">
          <Ban className="h-8 w-8 text-destructive" />
        </div>
        <h1 className="text-4xl font-bold font-headline">Access Denied</h1>
        <p className="mt-2 text-muted-foreground">Please sign in to view settings.</p>
      </div>
    );
  }

  const handleGenerateCode = async () => {
    setIsGenerating(true);
    const result = await generateTelegramLinkingCode(user.uid);
    if (result.success) {
      toast({ title: 'Code Generated', description: 'Code is valid for 10 minutes.' });
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.error });
    }
    setIsGenerating(false);
  };

  const handleUnlink = async () => {
    if (!confirm('Are you sure you want to disconnect Telegram?')) return;
    setIsUnlinking(true);
    const result = await unlinkTelegramAction(user.uid);
    if (result.success) {
      toast({ title: 'Unlinked', description: 'Telegram bot disconnected.' });
    }
    setIsUnlinking(false);
  };

  if (loading) {
    return (
      <div className="container mx-auto py-12 px-4 max-w-2xl">
        <Skeleton className="h-12 w-48 mb-8" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const isLinked = !!profile?.telegramChatId;
  const activeCode = profile?.telegramLinkingCode;
  const isCodeValid = activeCode && activeCode.expiresAt.toDate() > new Date();

  return (
    <div className="container mx-auto py-12 px-4 max-w-2xl">
      <div className="flex items-center gap-4 mb-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-none bg-primary/10 border-2">
          <Settings className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-4xl font-bold font-headline">Settings</h1>
          <p className="text-muted-foreground">Manage your account and integrations.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-[#229ED9]" /> Telegram Bot
          </CardTitle>
          <CardDescription>
            Connect your account to trade tokens directly from Telegram.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLinked ? (
            <div className="rounded-lg border-2 border-accent/20 bg-accent/5 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-6 w-6 text-accent" />
                <div>
                  <p className="font-bold">Telegram Connected</p>
                  <p className="text-sm text-muted-foreground">Chat ID: {profile.telegramChatId}</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={handleUnlink} disabled={isUnlinking}>
                <Trash2 className="h-4 w-4 mr-2" /> Disconnect
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border-2 border-yellow-500/20 bg-yellow-500/5 p-4 flex items-start gap-3">
                <AlertCircle className="h-6 w-6 text-yellow-500 shrink-0" />
                <div>
                  <p className="font-bold">Not Connected</p>
                  <p className="text-sm text-muted-foreground">Connect your account to enable snappy trading via the bot.</p>
                </div>
              </div>

              {!isCodeValid ? (
                <Button onClick={handleGenerateCode} disabled={isGenerating} className="w-full">
                  {isGenerating ? 'Generating...' : 'Connect Telegram Bot'}
                </Button>
              ) : (
                <div className="space-y-4 p-6 border-2 border-dashed rounded-lg text-center bg-muted/30">
                  <p className="text-sm text-muted-foreground font-bold uppercase tracking-widest">Your Secure Linking Code</p>
                  <p className="text-2xl sm:text-3xl font-mono font-bold tracking-tighter text-primary break-all">
                    {activeCode.code}
                  </p>
                  <p className="text-xs text-muted-foreground">Expires in {Math.round((activeCode.expiresAt.toDate().getTime() - Date.now()) / 1000 / 60)} minutes</p>
                  
                  <div className="flex flex-col gap-2 pt-2">
                    <Button asChild className="w-full bg-[#229ED9] hover:bg-[#229ED9]/90">
                      <a href={`https://t.me/${botUsername}?start=${activeCode.code}`} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="mr-2 h-4 w-4" /> Open Telegram Bot
                      </a>
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Or send `/start {activeCode.code}` to @{botUsername}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
