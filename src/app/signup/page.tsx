import { SignUpForm } from '@/components/auth/signup-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UserPlus } from 'lucide-react';

export default function SignUpPage() {
  return (
    <div className="container mx-auto py-12 px-4 sm:px-6 lg:px-8 max-w-sm">
      <div className="flex flex-col items-center text-center mb-8">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-none bg-primary/10 border-2">
          <UserPlus className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-4xl font-bold font-headline">Create Account</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Join CruiseMarket and start trading memes.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Sign Up</CardTitle>
          <CardDescription>It's quick and easy to get started.</CardDescription>
        </CardHeader>
        <CardContent>
          <SignUpForm />
        </CardContent>
      </Card>
    </div>
  );
}
