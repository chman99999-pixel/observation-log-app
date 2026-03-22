// 포트원 V2 API 유틸리티 (단건 결제용)
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

// 결제 조회 (단건 결제 검증용)
export async function getPayment(paymentId) {
  return portoneRequest('GET', `/payments/${encodeURIComponent(paymentId)}`);
}

export default {
  getPayment,
};
