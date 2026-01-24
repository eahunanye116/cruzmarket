import 'server-only';
import { headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { processDeposit } from '@/lib/wallet';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

export async function POST(req: NextRequest) {
    console.log('Received Paystack webhook request.');

    if (!PAYSTACK_SECRET_KEY) {
        console.error('Paystack secret key (PAYSTACK_SECRET_KEY) is not set in environment variables.');
        return new NextResponse('Webhook secret not configured.', { status: 500 });
    }

    const headersList = headers();
    const paystackSignature = headersList.get('x-paystack-signature');
    const body = await req.text();

    const hash = crypto
        .createHmac('sha512', PAYSTACK_SECRET_KEY)
        .update(body)
        .digest('hex');

    if (hash !== paystackSignature) {
        console.error('Invalid Paystack signature.');
        return new NextResponse('Invalid signature', { status: 401 });
    }
    
    console.log('Paystack signature verified.');
    const event = JSON.parse(body);
    console.log(`Received event type: ${event.event}`);

    // We are only interested in successful charges
    if (event.event === 'charge.success') {
        console.log('Processing charge.success event.');
        const { reference, amount, currency, metadata } = event.data;
        const userId = metadata?.userId;

        if (currency !== 'NGN') {
            console.log(`Webhook received for non-NGN currency: ${currency}. Skipping.`);
            return NextResponse.json({ status: 'success', message: 'Skipped non-NGN transaction' });
        }
        
        if (!userId) {
            console.error(`Webhook for reference ${reference} is missing userId in metadata.`);
            // Return a success to Paystack so it doesn't retry, but log the error.
            return NextResponse.json({ status: 'error', message: 'User ID missing from metadata' });
        }
        
        const amountInNaira = amount / 100; // Paystack sends amount in kobo

        try {
            await processDeposit(reference, userId, amountInNaira);
        } catch (error: any) {
            console.error(`Webhook processing failed for reference ${reference}:`, error);
            // We return a 500 to signal to Paystack to retry this webhook.
            return new NextResponse(`Webhook Error: ${error.message}`, { status: 500 });
        }
    }

    return NextResponse.json({ status: 'success' });
}
