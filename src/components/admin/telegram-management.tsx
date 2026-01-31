'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Globe, Bot, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { setTelegramWebhookAction, deleteTelegramWebhookAction, getTelegramBotUsername } from '@/app/actions/telegram-actions';
import { Label } from '../ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export function TelegramManagement() {
    const { toast } = useToast();
    const [baseUrl, setBaseUrl] = useState('');
    const [botUsername, setBotUsername] = useState('');
    const [isSetting, setIsSetting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isWorkstation, setIsWorkstation] = useState(false);

    useEffect(() => {
        const origin = window.location.origin;
        setBaseUrl(origin);
        getTelegramBotUsername().then(setBotUsername);
        
        // Detect if we are in a development/workstation environment
        if (origin.includes('cloudworkstations.dev') || origin.includes('localhost') || origin.includes('webcontainer.io')) {
            setIsWorkstation(true);
        }
    }, []);

    const handleSetWebhook = async () => {
        if (!baseUrl) {
            toast({ variant: 'destructive', title: 'Missing URL', description: 'Please provide your application base URL.' });
            return;
        }
        setIsSetting(true);
        const result = await setTelegramWebhookAction(baseUrl);
        if (result.success) {
            toast({ title: 'Webhook Updated', description: result.message });
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
        setIsSetting(false);
    };

    const handleDeleteWebhook = async () => {
        if (!confirm('Are you sure you want to remove the webhook? The bot will stop working.')) return;
        setIsDeleting(true);
        const result = await deleteTelegramWebhookAction();
        if (result.success) {
            toast({ title: 'Webhook Deleted', description: result.message });
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
        setIsDeleting(false);
    };

    return (
        <div className="space-y-6">
            {isWorkstation && (
                <Alert variant="destructive" className="bg-destructive/10 border-destructive/20">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Environment Warning</AlertTitle>
                    <AlertDescription>
                        You are currently in a <b>Development Environment</b>. If you set the webhook here, your bot will stop working as soon as you close this window. 
                        <br /><br />
                        <b>To fix:</b> Open your live site (e.g., <code>https://cruzmarket.fun</code>) and set the webhook from there.
                    </AlertDescription>
                </Alert>
            )}

            {!isWorkstation && (
                <Alert className="bg-accent/10 border-accent/20 text-accent">
                    <CheckCircle2 className="h-4 w-4 text-accent" />
                    <AlertTitle>Production Environment</AlertTitle>
                    <AlertDescription>
                        You are on your production domain. Setting the webhook here will ensure the bot stays online 24/7.
                    </AlertDescription>
                </Alert>
            )}

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Bot className="h-5 w-5 text-[#229ED9]" /> Bot Status
                    </CardTitle>
                    <CardDescription>
                        Configuration for @{botUsername}. Ensure your token is correct in the .env file or Vercel Environment Variables.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="base-url">App Base URL</Label>
                        <div className="flex flex-col sm:flex-row gap-2">
                            <Input 
                                id="base-url"
                                placeholder="https://your-app.com" 
                                value={baseUrl} 
                                onChange={(e) => setBaseUrl(e.target.value)} 
                            />
                            <Button onClick={handleSetWebhook} disabled={isSetting || !baseUrl} className="shrink-0">
                                {isSetting ? <Loader2 className="animate-spin" /> : <Globe className="mr-2 h-4 w-4" />}
                                Set Webhook
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Registers <code>{baseUrl}/api/telegram/webhook</code> with Telegram.
                        </p>
                    </div>

                    <div className="pt-4 border-t">
                        <Button variant="outline" className="text-destructive border-destructive/20 hover:bg-destructive/10" onClick={handleDeleteWebhook} disabled={isDeleting}>
                            {isDeleting ? <Loader2 className="animate-spin" /> : <Globe className="mr-2 h-4 w-4" />}
                            Delete Webhook
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Deployment Checklist</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-muted-foreground">
                    <ul className="list-disc list-inside space-y-2">
                        <li>Set <code>TELEGRAM_BOT_TOKEN</code> in Vercel Dashboard.</li>
                        <li>Set <code>PAYSTACK_SECRET_KEY</code> in Vercel Dashboard.</li>
                        <li>Deploy to Vercel.</li>
                        <li><b>Crucial:</b> Visit the Admin Panel on your <code>.vercel.app</code> or custom domain and click "Set Webhook" there.</li>
                    </ul>
                </CardContent>
            </Card>
        </div>
    );
}
