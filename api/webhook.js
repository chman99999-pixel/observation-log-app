import supabase from './_utils/supabase.js';
import { getPayment } from './_utils/portone.js';

// 포트원 웹훅 시크릿 (포트원 콘솔에서 설정)
const WEBHOOK_SECRET = process.env.PORTONE_WEBHOOK_SECRET;

export default async function handler(req, res) {
  // 포트원 웹훅은 POST로 전달
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { type, data } = req.body;

    console.log('Webhook received:', type, JSON.stringify(data));

    // 웹훅 시크릿 검증 (설정된 경우)
    if (WEBHOOK_SECRET) {
      const webhookId = req.headers['webhook-id'];
      const webhookTimestamp = req.headers['webhook-timestamp'];
      const webhookSignature = req.headers['webhook-signature'];

      // 기본적인 헤더 존재 검증
      if (!webhookId || !webhookTimestamp || !webhookSignature) {
        console.error('Webhook signature headers missing');
        return res.status(400).json({ error: 'Missing webhook signature headers' });
      }
    }

    // 결제 완료 이벤트
    if (type === 'Transaction.Paid') {
      const paymentId = data?.paymentId;
      if (!paymentId) {
        return res.status(400).json({ error: 'Missing paymentId' });
      }

      // 포트원 API로 결제 상태 재확인 (이중 검증)
      let payment;
      try {
        payment = await getPayment(paymentId);
      } catch (err) {
        console.error('결제 조회 실패:', err);
        return res.status(500).json({ error: '결제 조회 실패' });
      }

      if (payment.status !== 'PAID') {
        console.warn(`Payment ${paymentId} status is ${payment.status}, not PAID`);
        return res.status(200).json({ message: 'Payment not in PAID status, skipping' });
      }

      // payments 테이블 업데이트
      const { error: updateError } = await supabase
        .from('payments')
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .eq('payment_id', paymentId);

      if (updateError) {
        console.error('Payment update error:', updateError);
      }

      return res.status(200).json({ success: true });
    }

    // 결제 실패 이벤트
    if (type === 'Transaction.Failed') {
      const paymentId = data?.paymentId;
      if (paymentId) {
        await supabase
          .from('payments')
          .update({ status: 'failed' })
          .eq('payment_id', paymentId);
      }
      return res.status(200).json({ success: true });
    }

    // 결제 취소 이벤트
    if (type === 'Transaction.Cancelled') {
      const paymentId = data?.paymentId;
      if (paymentId) {
        await supabase
          .from('payments')
          .update({ status: 'cancelled' })
          .eq('payment_id', paymentId);
      }
      return res.status(200).json({ success: true });
    }

    // 기타 이벤트는 200으로 응답 (재시도 방지)
    console.log('Unhandled webhook type:', type);
    return res.status(200).json({ message: 'Event type not handled' });

  } catch (error) {
    console.error('Webhook Error:', error);
    // 웹훅은 500 응답 시 재시도하므로, 처리 불가능한 에러도 200 응답
    return res.status(200).json({ error: 'Internal error but acknowledged' });
  }
}
