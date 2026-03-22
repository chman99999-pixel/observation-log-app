export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  res.status(200).json({
    accessCode: process.env.APP_ACCESS_CODE ?? '2026',
    portone: {
      storeId: process.env.PORTONE_STORE_ID || '',
      channelKey: process.env.PORTONE_CHANNEL_KEY || '',
    },
    kakaoJsKey: (process.env.KAKAO_JS_KEY || '').trim(),
    googleClientId: (process.env.GOOGLE_CLIENT_ID || '').trim(),
  });
}
