// 포트원 V2 API 유틸리티
const PORTONE_API_SECRET = process.env.PORTONE_API_SECRET;
const PORTONE_API_URL = 'https://api.portone.io';

// 포트원 V2 API 호출 헬퍼
async function portoneRequest(method, path, body = null) {
  const headers = {
    'Authorization': `PortOne ${PORTONE_API_SECRET}`,
    'Content-Type': 'application/json',
  };

  const options = { method, headers };
  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${PORTONE_API_URL}${path}`, options);
  const data = await response.json();

  if (!response.ok) {
    console.error('PortOne API Error:', data);
    throw new Error(data.message || `PortOne API error: ${response.status}`);
  }

  return data;
}

// 빌링키 정보 조회
export async function getBillingKey(billingKey) {
  return portoneRequest('GET', `/billing-keys/${billingKey}`);
}

// 빌링키로 결제 요청 (정기결제)
export async function payWithBillingKey({ billingKey, paymentId, orderName, amount, currency = 'KRW', customer }) {
  return portoneRequest('POST', `/payments/${encodeURIComponent(paymentId)}/billing-key`, {
    billingKey,
    orderName,
    amount: { total: amount, currency },
    customer,
  });
}

// 결제 조회
export async function getPayment(paymentId) {
  return portoneRequest('GET', `/payments/${encodeURIComponent(paymentId)}`);
}

// 빌링키 삭제 (구독 해지 시)
export async function deleteBillingKey(billingKey) {
  return portoneRequest('DELETE', `/billing-keys/${billingKey}`);
}

export default {
  getBillingKey,
  payWithBillingKey,
  getPayment,
  deleteBillingKey,
};
