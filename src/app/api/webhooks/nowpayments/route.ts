import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { processDeposit } from '@/lib/wallet';
import { getLatestUsdNgnRate } from '@/app/actions/wallet-actions';

const NOWPAYMENTS_IPN_SECRET = process.env.NOWPAYMENTS_IPN_SECRET;

export async function POST(req: NextRequest) {
    const signature = req.headers.get('x-nowpayments-sig');
    const bodyText = await req.text();

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

        if (payment_status === 'finished') {
            const parts = order_id.split('_');
            const userId = parts[2];
            const reference = payment_id.toString();

            if (userId) {
                // Fetch real-time rate during confirmation for maximum accuracy
                const currentRate = await getLatestUsdNgnRate();
                const amountInNgn = price_amount * currentRate;
                
                await processDeposit(reference, userId, amountInNgn);
                console.log(`NOWPAYMENTS_WEBHOOK: Successfully converted $${price_amount} to ₦${amountInNgn} (Rate: ${currentRate}) and credited user ${userId}`);
            }
        }

        return NextResponse.json({ ok: true });
    } catch (error: any) {
        console.error('NOWPAYMENTS_WEBHOOK_ERROR:', error);
        return new NextResponse(`Error: ${error.message}`, { status: 500 });
    }
}
