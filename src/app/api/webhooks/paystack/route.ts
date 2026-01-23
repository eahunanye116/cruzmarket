import 'server-only';
import { headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { processDeposit } from '@/lib/wallet';

const PAYSTACK_WEBHOOK_SECRET = process.env.PAYSTACK_WEBHOOK_SECRET;

export async function POST(req: NextRequest) {
    if (!PAYSTACK_WEBHOOK_SECRET) {
        console.error('Paystack webhook secret is not set.');
        return new NextResponse('Webhook secret not configured.', { status: 500 });
    }

    const headersList = headers();
    const paystackSignature = headersList.get('x-paystack-signature');
    const body = await req.text();

    const hash = crypto
        .createHmac('sha512', PAYSTACK_WEBHOOK_SECRET)
        .update(body)
        .digest('hex');

    if (hash !== paystackSignature) {
        return new NextResponse('Invalid signature', { status: 401 });
    }
    
    const event = JSON.parse(body);

    // We are only interested in successful charges
    if (event.event === 'charge.success') {
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
