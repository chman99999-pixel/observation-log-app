export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { activity, needAction, model, tone, charCount, includeExpertView } = req.body;
  if (!activity) return res.status(400).json({ error: '활동내용을 입력해주세요.' });

  const MODEL_MAP = {
    'haiku': 'claude-haiku-4-5-20251001',
    'sonnet': 'claude-sonnet-4-6'
  };
  const selectedModel = MODEL_MAP[model] || MODEL_MAP['haiku'];

  // 글자 수 설정
  const charCountText = charCount ? `${charCount}자 내외` : '140자 내외';

  // 말투별 프롬프트 블록
  const TONE_MAP = {
    'default': {
      name: '기본',
      structure: `   - 시작: "[활동명]을(를) ~하는 시간을 가졌습니다" (※ '오늘'로 시작하지 마세요)
   - 중간: 이용자의 행동과 발화를 시간 순서대로 서술
   - 끝맺음: 마지막 행동 뒤에 "~며" + 전문적 견해 + "나타냈습니다/보였습니다/표현했습니다"`,
      style: `   - 정형적이고 체계적인 문장 구조를 사용합니다
   - 접속사 "~하고", "~하며"를 활용하여 매끄럽게 연결합니다
   - 객관적이고 균형 잡힌 톤을 유지합니다`,
      example: `"[활동명]을 하는 시간을 가졌습니다. 이용자는 활동에 적극적으로 참여했습니다. 재료를 직접 선택하고, 완성 후 만족스러운 표정을 지으며 성취감을 표현했습니다."`
    },
    'warm': {
      name: '따뜻한 공감형',
      structure: `   - 시작: "[활동명]을(를) ~하는 시간을 가졌습니다" (※ '오늘'로 시작하지 마세요)
   - 중간: 이용자의 표정, 분위기, 감정 변화를 세심하게 포착하여 서술
   - 끝맺음: 이용자의 긍정적 감정이나 변화를 따뜻하게 마무리`,
      style: `   - 감정과 분위기를 세심하게 묘사합니다 (표정, 눈빛, 목소리 톤 등)
   - "살며시", "환하게", "편안한 모습으로", "조심스럽게", "즐거운 표정으로" 등 분위기를 전달하는 부사와 형용사를 자연스럽게 활용합니다
   - 이용자의 작은 변화나 성장에 주목하는 따뜻한 시선으로 서술합니다
   - 딱딱한 보고서가 아니라, 이용자를 아끼는 마음이 느껴지는 글을 씁니다`,
      example: `"[활동명]을 하는 시간을 가졌습니다. 이용자는 재료를 하나씩 살펴보며 신중하게 골랐습니다. 그림을 그리는 동안 편안한 표정으로 활동에 몰입했으며, 완성 후에는 환하게 웃으며 기쁨을 표현했습니다."`
    },
    'concise': {
      name: '담백한 요약형',
      structure: `   - 시작: "[활동명]에 참여했습니다" 또는 "[활동명]을 진행했습니다" (※ '오늘'로 시작하지 마세요)
   - 중간: 핵심 행동만 짧은 문장으로 서술
   - 끝맺음: 결과나 반응을 간결하게 마무리`,
      style: `   - 짧은 문장을 사용합니다 (한 문장에 하나의 행동만)
   - 꾸밈말과 수식어를 최소화합니다
   - 접속사 사용을 줄이고, 마침표로 문장을 끊습니다
   - 군더더기 없이 사실 위주로 전달합니다
   - 불필요한 반복 표현을 피합니다`,
      example: `"[활동명]에 참여했습니다. 이용자는 스스로 재료를 선택했습니다. 집중하여 작업을 마쳤습니다. 완성 후 만족스러운 반응을 보였습니다."`
    },
    'vivid': {
      name: '생동감 있는 서술형',
      structure: `   - 시작: "[활동명]을(를) ~하는 시간을 가졌습니다" (※ '오늘'로 시작하지 마세요)
   - 중간: 이용자의 구체적인 동작, 표현, 발화를 생생하게 묘사
   - 끝맺음: 인상적인 장면이나 발화로 자연스럽게 마무리`,
      style: `   - 이용자의 구체적인 동작을 생생하게 묘사합니다 (고개를 갸웃거리다, 손을 내밀다, 자리에서 일어나다 등)
   - 이용자의 말을 직접 인용합니다 ("잘 됐어요", "이거 해볼래요" 등)
   - 활동 중 벌어진 작은 에피소드나 장면을 포착합니다
   - 읽는 사람이 그 장면을 머릿속에 그릴 수 있도록 서술합니다
   - "~하다가", "~하자", "~한 뒤" 등 동적인 접속 표현을 사용합니다`,
      example: `"[활동명]을 하는 시간을 가졌습니다. 이용자는 재료를 앞에 놓고 이것저것 집어보다가 마음에 드는 것을 찾아 바로 작업을 시작했습니다. 작업 도중 고개를 갸웃거리기도 하고, 다 만든 뒤에는 \"잘 됐죠?\"라고 이야기하며 뿌듯해했습니다."`
    }
  };

  const toneConfig = TONE_MAP[tone] || TONE_MAP['default'];

  // 전문적 견해 블록
  const expertViewBlock = includeExpertView !== false
    ? `\n5. **전문적 견해 패턴** (끝맺음에 자연스럽게 녹여서 작성)
   긍정적: "활동에 대한 즐거움과 성취감을 표현했습니다", "높은 몰입도와 집중력을 나타냈습니다"
   부정적: "지속적인 집중력 유지에 어려움을 보였습니다"`
    : `\n5. **전문적 견해 제외**
   - 전문적 평가나 분석적 견해를 넣지 마세요
   - 관찰한 행동과 사실만 서술하세요
   - "~을 나타냈습니다", "~을 표현했습니다" 같은 평가성 표현을 쓰지 마세요`;

  const prompt = `당신은 성인 발달장애인 주간활동센터 '감사합니다'의 사회복지사입니다. 아래 구어체 활동 내용을 전문적인 관찰일지로 작성해주세요.

**작성 규칙:**

1. **기본 구조**
${toneConfig.structure}

2. **중요: '이용자는' 표현 규칙**
   - "이용자는 ~했습니다" 형태는 글 전체에서 딱 한 번만 사용
   - 이후 문장에서는 "이용자는"을 생략하고 바로 행동을 서술

3. **문체 규칙 (${toneConfig.name})**
${toneConfig.style}
   - 참고 예시: ${toneConfig.example}

4. **호칭 규칙**
   - 직원, 선생님, 제공인력 등은 모두 "관찰자"로 통일
   - 단, "강사", "강사님"은 그대로 유지 (관찰자로 바꾸지 마세요)
${expertViewBlock}

6. **구어체 → 격식체 변환**
   - 했어 → 했습니다
   - 보였어 → 보였습니다
   - 말했어 → 말했습니다
   - 반드시 경어체(~했습니다, ~보였습니다)를 사용하세요. 줄임말이나 반말체는 절대 사용하지 마세요.

7. **처리사항 생성 규칙**
   ${needAction ? '- 처리사항을 반드시 포함해서 작성해주세요.\n   - 처리사항은 50자 내외로 작성\n   - "~안내해드렸습니다", "~도와드렸습니다", "~격려했습니다" 형태 사용' : '- 처리사항을 절대 포함하지 마세요.\n   - 관찰일지 내용만 작성하세요.\n   - [처리사항] 태그를 사용하지 마세요.'}

8. **글자 수**
   - 관찰일지: ${charCountText}

9. **출력 형식**
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
        model: selectedModel,
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
