import supabase from './_utils/supabase.js';
import { authenticateRequest } from './_utils/auth.js';
import { getBillingKey, payWithBillingKey, getPayment } from './_utils/portone.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action } = req.query;

  try {
    // ====== 빌링키 발급 완료 처리 ======
    // 프론트에서 PortOne SDK로 빌링키 발급 후, 서버에서 검증 및 저장
    if (action === 'saveBillingKey') {
      const user = authenticateRequest(req);
      if (!user) return res.status(401).json({ error: '인증이 필요합니다.' });

      const { billingKey, planType } = req.body;
      if (!billingKey || !planType) {
        return res.status(400).json({ error: 'billingKey와 planType은 필수입니다.' });
      }

      // 포트원 API로 빌링키 유효성 검증
      let billingKeyInfo;
      try {
        billingKeyInfo = await getBillingKey(billingKey);
      } catch (err) {
        console.error('빌링키 검증 실패:', err);
        return res.status(400).json({ error: '빌링키 검증에 실패했습니다.' });
      }

      // 기존 빌링키가 있으면 비활성화
      await supabase
        .from('billing_keys')
        .update({ is_active: false })
        .eq('user_id', user.id)
        .eq('is_active', true);

      // 새 빌링키 저장
      const { error: insertError } = await supabase.from('billing_keys').insert([{
        user_id: user.id,
        billing_key: billingKey,
        pg_provider: 'inicis_v2',
        method: billingKeyInfo.methods?.[0]?.card?.name || 'card',
        is_active: true,
      }]);

      if (insertError) throw insertError;

      // 요금제 정보 조회
      const { data: plan, error: planError } = await supabase
        .from('plans')
        .select('*')
        .eq('type', planType)
        .eq('is_active', true)
        .single();

      if (planError || !plan) {
        return res.status(400).json({ error: '유효한 요금제를 찾을 수 없습니다.' });
      }

      // 첫 결제 실행
      const paymentId = `pay_${user.id}_${Date.now()}`;
      let paymentResult;
      try {
        paymentResult = await payWithBillingKey({
          billingKey,
          paymentId,
          orderName: `복서방 ${plan.name}`,
          amount: plan.price,
          currency: 'KRW',
          customer: {
            id: user.id,
            name: user.name || undefined,
          },
        });
      } catch (err) {
        console.error('첫 결제 실패:', err);
        return res.status(400).json({ error: '결제에 실패했습니다. 다른 카드로 다시 시도해주세요.' });
      }

      // 구독 시작/갱신
      const now = new Date();
      const endDate = new Date(now);
      if (planType === 'monthly') {
        endDate.setMonth(endDate.getMonth() + 1);
      } else {
        endDate.setFullYear(endDate.getFullYear() + 1);
      }
      const subscriptionEnd = endDate.toISOString().split('T')[0];

      // subscriptions 테이블 업데이트 (기존 활성 구독 종료 후 새로 생성)
      await supabase
        .from('subscriptions')
        .update({ status: 'cancelled', cancelled_at: now.toISOString() })
        .eq('user_id', user.id)
        .in('status', ['trial', 'active']);

      const { error: subError } = await supabase.from('subscriptions').insert([{
        user_id: user.id,
        plan_id: plan.id,
        status: 'active',
        current_period_start: now.toISOString().split('T')[0],
        current_period_end: subscriptionEnd,
        billing_key_id: billingKey,
      }]);

      if (subError) throw subError;

      // payments 테이블에 결제 기록
      const { error: payError } = await supabase.from('payments').insert([{
        user_id: user.id,
        payment_id: paymentId,
        billing_key: billingKey,
        plan_id: plan.id,
        amount: plan.price,
        currency: 'KRW',
        status: 'paid',
        paid_at: now.toISOString(),
        pg_provider: 'inicis_v2',
      }]);

      if (payError) console.error('결제 기록 저장 실패:', payError);

      // users 테이블의 subscription_end도 업데이트 (하위 호환)
      await supabase
        .from('users')
        .update({ subscription_end: subscriptionEnd })
        .eq('id', user.id);

      return res.status(200).json({
        success: true,
        subscription_end: subscriptionEnd,
        plan: plan.name,
        amount: plan.price,
      });
    }

    // ====== 결제 상태 조회 ======
    if (action === 'status') {
      const user = authenticateRequest(req);
      if (!user) return res.status(401).json({ error: '인증이 필요합니다.' });

      // 현재 활성 구독 조회
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('*, plans(*)')
        .eq('user_id', user.id)
        .in('status', ['active', 'trial'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      // 최근 결제 내역 조회
      const { data: payments } = await supabase
        .from('payments')
        .select('*')
        .eq('user_id', user.id)
        .order('paid_at', { ascending: false })
        .limit(5);

      // 활성 빌링키 존재 여부
      const { data: billingKeys } = await supabase
        .from('billing_keys')
        .select('id, method, created_at')
        .eq('user_id', user.id)
        .eq('is_active', true);

      return res.status(200).json({
        subscription: subscription || null,
        payments: payments || [],
        hasBillingKey: (billingKeys && billingKeys.length > 0),
      });
    }

    // ====== 구독 해지 ======
    if (action === 'cancel') {
      const user = authenticateRequest(req);
      if (!user) return res.status(401).json({ error: '인증이 필요합니다.' });

      // 활성 구독 찾기
      const { data: subscription, error: subFindError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (subFindError || !subscription) {
        return res.status(400).json({ error: '활성 구독이 없습니다.' });
      }

      // 구독 상태를 cancelled로 변경 (만료일까지는 계속 사용 가능)
      const { error: updateError } = await supabase
        .from('subscriptions')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
        })
        .eq('id', subscription.id);

      if (updateError) throw updateError;

      // 빌링키 비활성화 (다음 결제 방지)
      await supabase
        .from('billing_keys')
        .update({ is_active: false })
        .eq('user_id', user.id)
        .eq('is_active', true);

      return res.status(200).json({
        success: true,
        message: '구독이 해지되었습니다. 만료일까지 서비스를 이용할 수 있습니다.',
        subscription_end: subscription.current_period_end,
      });
    }

    return res.status(400).json({ error: 'Invalid action' });

  } catch (error) {
    console.error('Payment Error:', error);
    return res.status(500).json({ error: error.message || 'Payment server error' });
  }
}
