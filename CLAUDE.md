# 일지해방 (Observation Log App) - 프로젝트 메모

## 프로젝트 개요
- **앱 이름**: 일지해방 (복지인 서류해방 시리즈 중 하나)
- **용도**: 성인 발달장애인 주간활동센터 '감사합니다'의 관찰일지 자동 작성
- **GitHub**: https://github.com/chman99999-pixel/observation-log-app
- **배포**: Vercel (자동 배포)
- **DB**: Supabase (PostgreSQL)
- **AI**: Anthropic Claude API (Haiku 4.5 / Sonnet 4.6)

## 기술 스택
- Frontend: Vanilla JS SPA (single index.html), Tailwind CSS
- Backend: Vercel Serverless Functions (Node.js)
- 프레임워크 없음 (React/Vue 등 미사용)

## 주요 파일 구조
```
observation-log-app/
├── api/
│   ├── generate.js        # Claude API 호출 (관찰일지 생성)
│   ├── db.js              # Supabase DB 작업
│   └── getAppConfig.js    # 앱 설정 조회
├── public/
│   └── index.html         # 전체 SPA (약 1400줄)
├── .github/workflows/
│   └── keep-alive.yml     # Streamlit 앱 슬립 방지 워크플로우
├── package.json
└── vercel.json
```

## API 모델 설정 (api/generate.js)
```javascript
const MODEL_MAP = {
  'haiku': 'claude-haiku-4-5-20251001',
  'sonnet': 'claude-sonnet-4-6'
};
```
- 프론트엔드에서 'haiku' 또는 'sonnet' 키를 전송하면 MODEL_MAP에서 변환

## 수정 이력 (2026-03-16)
1. **모델 ID 오류 수정**: `claude-sonnet-4-6-20250514` (잘못됨) → `claude-sonnet-4-6`
2. **관리자 페이지 제공인력관리**: 관리자 계정도 표시되도록 변경, admin 뱃지 추가, 삭제 버튼 숨김
3. **로그인 세션 유지**: sessionStorage 기반 세션 저장/복원/삭제 구현
4. **작성 예시 모달 업데이트**: 4가지 말투 스타일 비교, 옵션 안내 추가, 버튼명 "작성 예시 & 옵션 안내"로 변경
5. **가독성 개선**: 노안 선생님 위해 폰트 크기 2단계 증가, 행간/패딩 확대
6. **Streamlit 슬립 방지**: GitHub Actions 워크플로우 (2일마다 KST 새벽 3시 = UTC 18:00)
7. **30일전 로그 삭제 기능**: 관리자 > 로그 관리 탭에 버튼 추가, 기존 deleteLogs API 재활용

## Streamlit 앱 keep-alive 대상
- 기록지해방: https://jukgan-jaripdong-app-93jqyjotebw9s6ykzzncff.streamlit.app/
- 계획서해방2: https://m83g448p3tjqw9tz9nszle.streamlit.app/

## 관찰일지 말투 옵션 (2026-06 재설계 — '관찰의 렌즈'로 차별화, 4종 모두 객관적 사실 기록)
- 기본 (default): 시간순 종합 보고, 접속사로 매끄럽게 연결
- 상세 관찰형 (detailed): 이용자의 동작을 단계별로 자세히, 직접 인용 없음
- 수행 중심형 (support): 혼자 한 것/도움받은 것 중심, 전문용어 없이 일상어 (입력에 도움정보 있을 때만)
- 생동감 있는 서술형 (vivid): 직접 인용 1회 제한 + 핵심 동작 묘사 (글자수 초과 방지)
- 공통 원칙: ~하였습니다 경어체 강제(축약형 ~하였음 금지), 감정·느낌·분위기 추측 배제
- 폐기: 따뜻한 공감형(warm), 담백한 요약형(concise) — 사용 빈도 낮고 차별화 약해 제거
- ⚠️ 말투 추가/수정 시 api/generate.js TONE_MAP + index.html 라디오버튼(value)/작성예시 모달 3곳 동기화 필수

## 날짜 형식 주의
- 로그 날짜는 `new Date().toLocaleDateString('ko-KR')` 형식으로 저장됨
- 저장 형식: `2026. 3. 16.` (한국어, 점+공백 구분)
- 날짜 비교 시 반드시 `parseKoreanDate()` 함수로 Date 객체 변환 후 비교해야 함
- ISO 형식(`YYYY-MM-DD`)과 직접 문자열 비교하면 안 됨

## SaaS 전환 프로젝트 (진행 중)
- **목표**: 복서방 시리즈를 포트원 V2 결제 기반 구독형 SaaS로 전환
- **요금제**: 무료체험 10일 → 월간 6,000원 / 연간 60,000원
- **작업 브랜치**: `feature/saas` (main은 현재 운영 중인 안정 버전)
- **안전 태그**: `v1.0-stable` (롤백 지점)
- **핵심 원칙**:
  1. 무중단 서비스 - 선생님들 사용 중, 서비스 중단 절대 불가
  2. 하위 호환 - 기존 기능 깨뜨리지 않고 점진적 추가
  3. 롤백 가능 - Phase별 git tag, Vercel 롤백 이중 안전망
- **Phase**: 보안 기반 → DB 스키마 → 포트원 결제 → 정기결제 → 법적 요구사항 → 레거시 제거
- **결제**: 포트원(PortOne) V2
- **추가 패키지**: bcryptjs, jsonwebtoken (Phase 1에서 추가)

## 포트원 V2 결제 연동 (Phase 3)
- **PG사**: KG이니시스 (테스트 채널)
- **채널명**: 복서방-KG이니시스-테스트
- **MID**: INIBillTst (정기결제 테스트용)
- **결제 모듈**: V2 (inicis_v2)
- **SDK**: https://cdn.portone.io/v2/browser-sdk.js
- **환경변수** (Vercel에 설정 필요):
  - `PORTONE_STORE_ID`: 포트원 상점아이디 (store-xxxx 형식)
  - `PORTONE_CHANNEL_KEY`: 채널키 (channel-key-xxxx 형식, 포트원 콘솔 > 결제 연동 > 연동 정보에서 확인)
  - `PORTONE_API_SECRET`: 포트원 API 시크릿 (포트원 콘솔 > API & Webhook > API Keys)
  - `PORTONE_WEBHOOK_SECRET`: 웹훅 시크릿 (선택, 포트원 콘솔 > API & Webhook > Webhooks)
- **API 엔드포인트**:
  - `/api/payment?action=saveBillingKey` - 빌링키 저장 + 첫 결제
  - `/api/payment?action=status` - 구독/결제 상태 조회
  - `/api/payment?action=cancel` - 구독 해지
  - `/api/webhook` - 포트원 웹훅 수신
- **결제 흐름**: 프론트(SDK) → 빌링키 발급 → 서버 검증 + 저장 → 빌링키로 결제 → 구독 활성화

## 주의사항
- git push로 `.github/workflows/` 파일 수정 시 OAuth 토큰에 `workflow` scope 필요
  - 현재 토큰에 해당 권한 없음 → Chrome 브라우저에서 GitHub 직접 편집 필요
  - 또는 `gh auth refresh -s workflow` 실행 (터미널에서 직접)
- 일지 작성 시 객관적 사실만 기록 (주관적 표현 사용 금지)
- 센터 선생님들 노안 고려하여 UI 가독성 중요
