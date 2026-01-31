'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Globe, Bot, AlertTriangle, CheckCircle2, Activity, Info } from 'lucide-react';
import { setTelegramWebhookAction, deleteTelegramWebhookAction, getTelegramBotUsername, getTelegramWebhookInfoAction } from '@/app/actions/telegram-actions';
import { Label } from '../ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export function TelegramManagement() {
    const { toast } = useToast();
    const [baseUrl, setBaseUrl] = useState('');
    const [botUsername, setBotUsername] = useState('');
    const [isSetting, setIsSetting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isChecking, setIsChecking] = useState(false);
    const [isWorkstation, setIsWorkstation] = useState(false);
    const [webhookInfo, setWebhookInfo] = useState<any>(null);

    useEffect(() => {
        const origin = window.location.origin;
        setBaseUrl(origin);
        getTelegramBotUsername().then(setBotUsername);
        
        if (origin.includes('cloudworkstations.dev') || origin.includes('localhost') || origin.includes('webcontainer.io')) {
            setIsWorkstation(true);
        }
        
        handleCheckStatus();
    }, []);

    const handleCheckStatus = async () => {
        setIsChecking(true);
        const result = await getTelegramWebhookInfoAction();
        if (result.success) {
            setWebhookInfo(result.info);
        } else {
            toast({ variant: 'destructive', title: 'Status Check Failed', description: result.error });
        }
        setIsChecking(false);
    };

    const handleSetWebhook = async () => {
        if (!baseUrl) {
            toast({ variant: 'destructive', title: 'Missing URL', description: 'Please provide your application base URL.' });
            return;
        }
        setIsSetting(true);
        const result = await setTelegramWebhookAction(baseUrl);
        if (result.success) {
            toast({ title: 'Webhook Updated', description: result.message });
            handleCheckStatus();
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
            handleCheckStatus();
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
                        You are currently in a <b>Development Environment</b>. If you set the webhook here, your bot will stop working as soon as you close FireStudio.
                        <br /><br />
                        <b>To fix:</b> Open your live site (e.g., <code>https://cruzmarket.fun</code>) and set the webhook from there.
                    </AlertDescription>
                </Alert>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Bot className="h-5 w-5 text-[#229ED9]" /> Configure Webhook
                        </CardTitle>
                        <CardDescription>
                            Registers your site with Telegram. Use <code>https://cruzmarket.fun</code>.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="base-url">App Base URL</Label>
                            <Input 
                                id="base-url"
                                placeholder="https://your-app.com" 
                                value={baseUrl} 
                                onChange={(e) => setBaseUrl(e.target.value)} 
                            />
                        </div>
                        <div className="flex gap-2">
                            <Button onClick={handleSetWebhook} disabled={isSetting || !baseUrl} className="flex-1">
                                {isSetting ? <Loader2 className="animate-spin" /> : <Globe className="mr-2 h-4 w-4" />}
                                Set Webhook
                            </Button>
                            <Button variant="outline" onClick={handleDeleteWebhook} disabled={isDeleting} className="text-destructive border-destructive/20">
                                {isDeleting ? <Loader2 className="animate-spin" /> : 'Clear'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Live Webhook Status</CardTitle>
                        <Button variant="ghost" size="icon" onClick={handleCheckStatus} disabled={isChecking}>
                            <Activity className={isChecking ? "animate-spin" : ""} />
                        </Button>
                    </CardHeader>
                    <CardContent>
                        {webhookInfo ? (
                            <div className="space-y-2">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-muted-foreground">Active URL:</span>
                                    <span className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded break-all max-w-[180px] text-right">
                                        {webhookInfo.url || 'NONE (Polling Mode)'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-muted-foreground">Pending Updates:</span>
                                    <span className={webhookInfo.pending_update_count > 0 ? "text-yellow-500 font-bold" : "text-accent"}>
                                        {webhookInfo.pending_update_count}
                                    </span>
                                </div>
                                {webhookInfo.last_error_message && (
                                    <div className="mt-2 p-2 bg-destructive/5 border border-destructive/20 rounded text-[10px] text-destructive">
                                        <b>Last Error:</b> {webhookInfo.last_error_message}
                                    </div>
                                )}
                                {webhookInfo.url && !webhookInfo.url.includes('cruzmarket.fun') && (
                                    <p className="text-[10px] text-yellow-600 font-bold flex items-center gap-1 mt-2">
                                        <Info className="h-3 w-3" /> URL points to temporary studio!
                                    </p>
                                )}
                            </div>
                        ) : (
                            <p className="text-center py-4 text-xs text-muted-foreground">No webhook info available. Token might be missing.</p>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Vercel Deployment Checklist</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-muted-foreground">
                    <p className="text-destructive font-bold">If your bot works in FireStudio but stops on Vercel:</p>
                    <ul className="list-decimal list-inside space-y-2">
                        <li>Go to <b>Vercel Dashboard > Project Settings > Environment Variables</b>.</li>
                        <li>Add <code>TELEGRAM_BOT_TOKEN</code> with your bot's token.</li>
                        <li>Add <code>PAYSTACK_SECRET_KEY</code> and <code>NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY</code>.</li>
                        <li><b>Redeploy</b> your project on Vercel so it picks up the new variables.</li>
                        <li>Open your <b>live site</b> (not the FireStudio one) and click <b>"Set Webhook"</b> here.</li>
                    </ul>
                </CardContent>
            </Card>
        </div>
    );
}