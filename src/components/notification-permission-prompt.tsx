'use client';

import { useState, useEffect } from 'react';
import { BellRing, X, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function NotificationPermissionPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission | 'unsupported'>('default');

  useEffect(() => {
    // Check if browser supports notifications
    if (!('Notification' in window)) {
      setPermissionStatus('unsupported');
      return;
    }

    setPermissionStatus(Notification.permission);

    // Show prompt if permission is still 'default'
    // and they haven't dismissed this prompt in this session
    const isDismissed = sessionStorage.getItem('notification_prompt_dismissed');
    if (Notification.permission === 'default' && !isDismissed) {
      // Delay slightly for better UX
      const timer = setTimeout(() => setShowPrompt(true), 3000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleRequestPermission = async () => {
    if (!('Notification' in window)) return;

    try {
      const permission = await Notification.requestPermission();
      setPermissionStatus(permission);
      setShowPrompt(false);
      
      if (permission === 'granted') {
        new Notification("Notifications Enabled!", {
          body: "You'll now receive alerts for new ticker launches.",
          icon: "/favicon.ico" // Browser will use default if missing
        });
      }
    } catch (error) {
      console.error("Error requesting notification permission:", error);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    sessionStorage.setItem('notification_prompt_dismissed', 'true');
  };

  if (!showPrompt || permissionStatus !== 'default') return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 md:bottom-6 md:left-auto md:right-6 md:w-96 z-[60] animate-in slide-in-from-bottom-10 duration-500">
      <div className="bg-card border-2 border-primary/30 shadow-hard-lg rounded-lg p-4 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
        
        <button 
          onClick={handleDismiss}
          className="absolute top-2 right-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex gap-4 items-start pr-6">
          <div className="bg-primary/10 p-2 rounded-full shrink-0">
            <BellRing className="h-6 w-6 text-primary animate-pulse" />
          </div>
          <div className="space-y-1">
            <h4 className="font-bold text-sm sm:text-base leading-tight">Don't Miss the Next Moonshot!</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Enable desktop alerts to get instant notifications when new meme tickers launch.
            </p>
            <div className="pt-2 flex gap-2">
              <Button size="sm" onClick={handleRequestPermission} className="h-8 text-xs px-4">
                Enable Alerts
              </Button>
              <Button size="sm" variant="ghost" onClick={handleDismiss} className="h-8 text-xs">
                Later
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
