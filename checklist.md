# 복서방 수동 입금 결제 전환 — 체크리스트

## 확정 결정
- 입금 확인: 사용자 "입금완료" 신청 → 관리자 승인
- 결제수단: 계좌이체 + 카카오페이 둘 다
- 수취 계좌: 개인 계좌 (기존 국민은행 등) — ⚠️ 세무상 사업/개인 자금 혼재 주의, 추후 사업자계좌 권장

## Phase 1 — DB
- [ ] payments 테이블 입금신청 컬럼 정비 (method, status, depositor_name, requested_at, confirmed_at, confirmed_by)
- [ ] 입금 계좌/카카오페이 정보를 settings 테이블에 저장 (관리자 수정 가능, 하드코딩 X)
- [ ] verify: 신청 레코드 생성/조회 테스트

## Phase 2 — 백엔드 API
- [ ] api/payment.js: requestDeposit (입금 신청 등록, status=pending)
- [ ] api/payment.js: approveDeposit (관리자 확인 → 구독 기간 연장 + status=confirmed)
- [ ] api/payment.js: rejectDeposit (반려)
- [ ] 포트원 verify/webhook/portone.js 비활성화(삭제 금지, 보존)
- [ ] verify: curl로 신청→승인→구독연장 확인

## Phase 3 — 사용자 화면 (index.html)
- [ ] renderSubscription: "결제하기" → "입금하고 이용하기"
- [ ] renderDepositGuide: 계좌/카카오페이 안내 + 복사버튼 + 금액 + 입금자명 안내
- [ ] "입금 완료했어요" 버튼 → requestDeposit 호출
- [ ] 신청 후 "확인 대기중" 상태 표시
- [ ] 포트원 SDK 호출부(startPayment/requestPayment) 비활성화
- [ ] verify: 신청 시 대기 상태 노출

## Phase 4 — 관리자
- [ ] 구독 관리 탭: "입금 신청 대기" 목록
- [ ] "확인 & 활성화" / "반려" 버튼
- [ ] 활성화 시 구독 기간 연장(월 +30일 / 연 +365일) + 매출 반영
- [ ] 설정: 입금 계좌/카카오페이 정보 수정 UI
- [ ] verify: 승인 시 구독 활성화 + 사용자 화면 반영 확인

## Phase 5 — 운영/마무리
- [ ] 만료 전 알림 (이메일/앱내 배너) 점검
- [ ] 현금영수증 안내 문구 추가
- [ ] 환불 안내 점검 (refund.html)
- [ ] 배포 + 실제 입금 1건 E2E 테스트
- [ ] 메모리(project_saas_progress.md) 업데이트

## 필요 정보
- [x] 실제 입금 계좌: 국민은행 / 452-21-1127-429 / 예금주 천만석
- [ ] 카카오페이: QR 이미지 받음 → public/images/kakaopay_qr.png 저장 필요(사용자) 또는 송금 링크 URL(qr.kakaopay.com/...)
