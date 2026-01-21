'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useDoc, useFirestore } from '@/firebase';
import { PlatformSettings } from '@/lib/types';
import { doc, setDoc } from 'firebase/firestore';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '../ui/skeleton';

export function PrivacyManagement() {
  const firestore = useFirestore();
  const settingsRef = firestore ? doc(firestore, 'settings', 'privacy') : null;
  const { data: settings, loading } = useDoc<PlatformSettings>(settingsRef);
  const { toast } = useToast();

  const signupEnabled = settings === null || settings?.signupEnabled !== false; // Default to true

  const handleSignupToggle = async (enabled: boolean) => {
    if (!settingsRef) return;
    try {
      await setDoc(settingsRef, { signupEnabled: enabled }, { merge: true });
      toast({
        title: 'Settings Updated',
        description: `User signups have been ${enabled ? 'enabled' : 'disabled'}.`,
      });
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Error updating settings',
        description: e.message,
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Privacy & Access</CardTitle>
        <CardDescription>
          Control platform-wide access settings, such as user registration.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-10 w-full" />
        ) : (
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="signup-switch" className="text-base">
                Enable New User Signups
              </Label>
              <p className="text-sm text-muted-foreground">
                Allow new users to create accounts on the platform.
              </p>
            </div>
            <Switch
              id="signup-switch"
              checked={signupEnabled}
              onCheckedChange={handleSignupToggle}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
