import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { processDeposit } from '@/lib/wallet';

const NOWPAYMENTS_IPN_SECRET = process.env.NOWPAYMENTS_IPN_SECRET;
const USD_TO_NGN_RATE = 1600;

export async function POST(req: NextRequest) {
    const signature = req.headers.get('x-nowpayments-sig');
    const bodyText = await req.text();

    // Verify signature if secret is configured
    if (NOWPAYMENTS_IPN_SECRET) {
        const hmac = crypto.createHmac('sha512', NOWPAYMENTS_IPN_SECRET);
        hmac.update(bodyText);
        const expectedSignature = hmac.digest('hex');

        if (signature !== expectedSignature) {
            console.error('NOWPAYMENTS_WEBHOOK: Invalid signature received.');
            return new NextResponse('Invalid signature', { status: 401 });
        }
    }

    try {
        const payload = JSON.parse(bodyText);
        const { payment_status, price_amount, order_id, payment_id } = payload;

        console.log(`NOWPAYMENTS_WEBHOOK: Received status "${payment_status}" for order "${order_id}"`);

        // Only process deposits that are successfully finished
        if (payment_status === 'finished') {
            // order_id expected format: `DEP_${timestamp}_${userId}`
            const parts = order_id.split('_');
            const userId = parts[2];
            const reference = payment_id.toString();

            if (userId) {
                // Convert USD to NGN before crediting the internal balance
                const amountInNgn = price_amount * USD_TO_NGN_RATE;
                
                await processDeposit(reference, userId, amountInNgn);
                console.log(`NOWPAYMENTS_WEBHOOK: Successfully converted $${price_amount} to ₦${amountInNgn} and credited user ${userId}`);
            } else {
                console.error(`NOWPAYMENTS_WEBHOOK: Could not extract userId from order_id "${order_id}"`);
            }
        }

        return NextResponse.json({ ok: true });
    } catch (error: any) {
        console.error('NOWPAYMENTS_WEBHOOK_ERROR:', error);
        return new NextResponse(`Error: ${error.message}`, { status: 500 });
    }
}
