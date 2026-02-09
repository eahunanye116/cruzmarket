import { LoginForm } from '@/components/auth/login-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function LoginPage() {
  return (
    <div className="container mx-auto py-12 px-4 sm:px-6 lg:px-8 max-w-sm">
      <div className="flex flex-col items-center text-center mb-8">
        <h1 className="text-4xl font-bold font-headline">Sign In</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Access your CruzMarket account.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Welcome Back</CardTitle>
          <CardDescription>Enter your credentials to continue.</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </div>
  );
}
