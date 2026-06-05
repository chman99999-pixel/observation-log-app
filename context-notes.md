# 복서방 수동 입금 결제 전환 — 컨텍스트 노트

## 배경
- 포트원(PG) 심사 미승인 → 자동결제 연동 불가
- 결제 모듈 없이 계좌이체/카카오페이 입금 안내 + 관리자 수동 활성화로 전환
- SaaS 전환 전 운영하던 수동 입금 방식에 + 앱 내 안내·추적을 결합한 형태

## 확정 결정 & 이유
1. 입금 확인 = 사용자 "입금완료" 신청 → 관리자 승인
   - 이유: 입금 내역이 DB에 추적되어 관리 편함, 동명이인/누락 방지
2. 결제수단 = 계좌이체 + 카카오페이 둘 다
   - 이유: 50대+ 선생님 대상, 편한 방식 선택지 제공
3. 수취 계좌 = 개인 계좌 (기존 국민은행 등)
   - 사용자 선택. ⚠️ 세무상 사업/개인 자금 혼재 → 매출 증가 시 사업자계좌 전환 권장
   - 계좌/카카오페이 정보는 settings 테이블에 저장해 관리자가 수정 가능하게 (하드코딩 X)

## 설계 메모
- 포트원 코드(api/payment.js verify, api/webhook.js, api/_utils/portone.js)는 삭제 금지 → 비활성화/보존. 포트원 승인되면 빠르게 복구
- payments 테이블 재활용: method='bank_transfer'|'kakaopay', status='pending'|'confirmed'|'rejected', depositor_name, requested_at, confirmed_at, confirmed_by
- subscriptions 테이블 활성화 로직 재활용 (end_date 연장: 월 +30일 / 연 +365일)
- 자동결제가 없으므로 만료 전 알림(Resend 이메일 / 앱내 배너)이 중요

## 미해결 / 필요 정보
- 실제 입금 계좌 (은행/계좌번호/예금주) — 입력 필요
- 카카오페이 송금 링크 또는 QR/안내 방식 — 입력 필요
- 입금자 식별 방식 (가입자명 매칭 vs 사용자별 식별코드) — 구현 시 확정

## 법적/세무 체크포인트
- 현금영수증: 요청 시 발급 안내 문구 필요 (간이과세자)
- 개인계좌 수취 → 사업/개인 자금 혼재 주의 (1회 안내함, 사용자가 개인계좌 선택)
- 통신판매업 신고번호: 2026-전북군산-00231 (기존)
- 환불: refund.html 정책 + 수동 환불 프로세스

## 관련 파일
- 프론트: public/index.html (renderSubscription, 신규 renderDepositGuide, 관리자 구독 관리 탭)
- 백엔드: api/payment.js (입금신청/승인/반려), api/db.js (settings/subscriptions)
- 보존(비활성화): api/webhook.js, api/_utils/portone.js
