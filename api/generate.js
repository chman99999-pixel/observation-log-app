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

1. **기본 구조**
   - 시작: "[활동명]을(를) ~하는 시간을 가졌습니다" (※ '오늘'로 시작하지 마세요)
   - 중간: 이용자의 행동과 발화를 시간 순서대로 서술
   - 끝맺음: 마지막 행동 뒤에 "~며" + 전문적 견해 + "나타냈습니다/보였습니다/표현했습니다"

2. **중요: '이용자는' 표현 규칙**
   - "이용자는 ~했습니다" 형태는 글 전체에서 딱 한 번만 사용
   - 이후 문장에서는 "이용자는"을 생략하고 바로 행동을 서술
   - 예시: "이용자는 활동에 적극적으로 참여했습니다. 재료를 직접 선택하고, 완성 후 만족스러운 표정을 지으며..."

3. **구어체 → 격식체 변환**
   - 했어 → 했습니다
   - 보였어 → 보였습니다
   - 말했어 → 말했습니다

4. **호칭 규칙**
   - 직원, 선생님, 제공인력 등은 모두 "관찰자"로 통일

5. **전문적 견해 패턴**
   긍정적: "활동에 대한 즐거움과 성취감을 표현했습니다", "높은 몰입도와 집중력을 나타냈습니다"
   부정적: "지속적인 집중력 유지에 어려움을 보였습니다"

6. **처리사항 생성 규칙**
   ${needAction ? '- 처리사항을 반드시 포함해서 작성해주세요.\n   - 처리사항은 50자 내외로 작성\n   - "~안내해드렸습니다", "~도와드렸습니다", "~격려했습니다" 형태 사용' : '- 처리사항을 절대 포함하지 마세요.\n   - 관찰일지 내용만 작성하세요.\n   - [처리사항] 태그를 사용하지 마세요.'}

7. **글자 수**
   - 관찰일지: 140자 내외

8. **출력 형식**
   ${needAction ? '- [관찰일지]\n   (관찰 내용)\n   \n   [처리사항]\n   (처리사항 내용)' : '- 관찰일지 내용만 출력하세요.\n   - [관찰일지] 태그도 사용하지 마세요.\n   - 바로 내용만 작성하세요.'}

**입력된 활동 내용:**
${activity}

위 내용을 규칙에 맞게 관찰일지로 작성해주세요. 다른 설명 없이 요청된 형식대로만 출력하세요.`;

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
