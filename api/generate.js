export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { activity, needAction } = req.body;
  if (!activity) return res.status(400).json({ error: '활동내용을 입력해주세요.' });

  const prompt = `당신은 성인 발달장애인 주간활동센터 '감사합니다'의 사회복지사입니다. 아래 구어체 활동 내용을 전문적인 관찰일지로 작성해주세요.

**작성 규칙:**
1. 시작: "[활동명]을(를) ~하는 시간을 가졌습니다" (※ '오늘'로 시작하지 마세요)
2. "이용자는 ~했습니다" 형태는 글 전체에서 딱 한 번만 사용, 이후는 생략
3. 직원, 선생님 등은 모두 "관찰자"로 통일
4. 글자 수: 140자 내외
${needAction ? '5. [관찰일지]와 [처리사항] 형식으로 출력. 처리사항은 50자 내외, "~안내해드렸습니다" 형태' : '5. 태그 없이 관찰일지 내용만 출력'}

**활동 내용:**
${activity}`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }]
      })
    });
    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message });
    return res.status(200).json({ result: data.content?.[0]?.text?.trim() || '' });
  } catch (error) {
    return res.status(500).json({ error: '서버 오류: ' + error.message });
  }
}
