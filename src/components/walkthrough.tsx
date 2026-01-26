
'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { Progress } from './ui/progress';

export type WalkthroughStep = {
  title: string;
  description: React.ReactNode;
};

type WalkthroughProps = {
  isOpen: boolean;
  onFinish: () => void;
  steps: WalkthroughStep[];
};

export function Walkthrough({ isOpen, onFinish, steps }: WalkthroughProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onFinish();
      // Reset step to 0 for next time it opens, just in case.
      setTimeout(() => setCurrentStep(0), 500);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleClose = () => {
      onFinish();
      setTimeout(() => setCurrentStep(0), 500);
  }

  const progress = ((currentStep + 1) / steps.length) * 100;
  const isLastStep = currentStep === steps.length - 1;

  if (!isOpen || steps.length === 0) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{steps[currentStep].title}</DialogTitle>
          <DialogDescription asChild>
              <div className="text-base pt-2 text-foreground/80">{steps[currentStep].description}</div>
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
             <Progress value={progress} />
             <p className="text-xs text-muted-foreground text-center mt-2">Step {currentStep + 1} of {steps.length}</p>
        </div>
        <DialogFooter className='justify-between'>
          <Button variant="ghost" onClick={handlePrev} disabled={currentStep === 0}>
            <ArrowLeft className="mr-2" /> Previous
          </Button>
          <Button onClick={handleNext}>
            {isLastStep ? 'Finish' : 'Next'}
            {isLastStep ? <Check className="ml-2" /> : <ArrowRight className="ml-2" />}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
