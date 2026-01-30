'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Send, Link as LinkIcon, Trash2, Globe, Bot } from 'lucide-react';
import { setTelegramWebhookAction, deleteTelegramWebhookAction, getTelegramBotUsername } from '@/app/actions/telegram-actions';
import { Label } from '../ui/label';

export function TelegramManagement() {
    const { toast } = useToast();
    const [baseUrl, setBaseUrl] = useState('');
    const [botUsername, setBotUsername] = useState('');
    const [isSetting, setIsSetting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        // Auto-fill base URL with current origin for convenience
        setBaseUrl(window.location.origin);
        getTelegramBotUsername().then(setBotUsername);
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
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Bot className="h-5 w-5 text-[#229ED9]" /> Bot Status
                    </CardTitle>
                    <CardDescription>
                        Configuration for @{botUsername}. Ensure your token is correct in the .env file.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="base-url">App Base URL</Label>
                        <div className="flex gap-2">
                            <Input 
                                id="base-url"
                                placeholder="https://your-app.com" 
                                value={baseUrl} 
                                onChange={(e) => setBaseUrl(e.target.value)} 
                            />
                            <Button onClick={handleSetWebhook} disabled={isSetting || !baseUrl}>
                                {isSetting ? <Loader2 className="animate-spin" /> : <Globe className="mr-2 h-4 w-4" />}
                                Set Webhook
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            This registers the API endpoint <code>/api/telegram/webhook</code> with Telegram.
                        </p>
                    </div>

                    <div className="pt-4 border-t">
                        <Button variant="outline" className="text-destructive border-destructive/20 hover:bg-destructive/10" onClick={handleDeleteWebhook} disabled={isDeleting}>
                            {isDeleting ? <Loader2 className="animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                            Delete Webhook
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>How to use</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-muted-foreground">
                    <ol className="list-decimal list-inside space-y-2">
                        <li>Ensure <code>TELEGRAM_BOT_TOKEN</code> is set in your environment variables.</li>
                        <li>Enter your production URL (e.g., <code>https://cruzmarket.fun</code>) above and click "Set Webhook".</li>
                        <li>Go to the bot on Telegram and send <code>/start</code>.</li>
                        <li>Users link their accounts via the **Settings** page in the web app.</li>
                    </ol>
                </CardContent>
            </Card>
        </div>
    );
}
