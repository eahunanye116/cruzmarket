import { CreateTickerForm } from '@/components/create-ticker-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles } from 'lucide-react';

export default function CreateTickerPage() {
  return (
    <div className="container mx-auto py-12 px-4 sm:px-6 lg:px-8 max-w-2xl">
      <div className="flex flex-col items-center text-center mb-8">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <Sparkles className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-4xl font-bold font-headline">Create a New Meme Ticker</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Unleash the next big meme. Fill out the details to launch your ticker on CruiseMarket.
        </p>
      </div>
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Ticker Details</CardTitle>
          <CardDescription>Provide the essential information for your new meme ticker.</CardDescription>
        </CardHeader>
        <CardContent>
          <CreateTickerForm />
        </CardContent>
      </Card>
    </div>
  );
}
