# 자동화 트리거 정의 (MVP)

## 목적
Google Sheets + Apps Script 기준으로 이벤트 감지, TASK 생성, 중복 방지, 상태 보정 규칙을 정의한다.

## 범위
- 입력 원본: `CHILD`, `TASKS`, `CLASS_ASSIGNMENT`, `ROSTER`
- 자동화 대상: `TASKS` 생성/보정, 최소 유효성 검증

---

## 공통 정책
- **Idempotency(멱등성)**: 동일 이벤트 재실행 시 중복 TASK를 만들지 않는다.
- **Manual-first**: 자동 완료는 하지 않으며, 완료 체크는 사용자가 수행한다.
- **Auditability**: 생성 시 `created_at` 필수 기록, 가능하면 `memo`에 생성근거를 남긴다.

---

## Trigger 1 — 입학확정 TASK 자동 생성

### 이벤트
- `CHILD.admission_confirmed`가 `FALSE → TRUE`로 변경

### 조건
- `CHILD.child_id` 존재
- 대상 원아에 대해 `related_event=입학확정` TASK가 아직 없거나 일부만 존재

### 액션
- 아래 카테고리 TASK를 누락분만 생성
  - `명단`, `원비`, `안내문자`, `급식일지`, `교재주문`, `입퇴원처리부`
- 기본값
  - `status=대기`
  - `sms_status=미발송` (category=안내문자인 경우)
  - `created_at=now`

### 중복 방지 키(권장)
- `(child_id, related_event, category)` 유니크 취급

---

## Trigger 2 — 안내문자 TASK 상태 보정

### 이벤트
- `TASKS` 행 수정

### 조건 및 액션
1. `category=안내문자` 이고 `sms_status`가 비어있으면 `미발송`으로 보정
2. `category!=안내문자` 이고 `sms_status` 값이 있으면 경고(또는 빈값으로 정리)
3. `status=완료`로 바뀌면 `completed_at` 자동 타임스탬프 기록 *(선택 적용)*

> 정책상 수동 입력 선호 시 3번은 비활성화 가능.

---

## Trigger 3 — 명단 TASK 완료 전 점검

### 이벤트
- `TASKS`에서 `category=명단` 행을 `status=완료`로 변경 시도

### 검증
- `ROSTER`에 해당 `child_id` 존재 여부 확인
- 존재하더라도 `class_name` 빈값이면 완료 거부(또는 경고 후 대기 유지)

### 액션
- 검증 통과 시 완료 유지
- 실패 시 `status=대기` 롤백 + `memo`에 사유 기록

---

## Trigger 4 — 진급 시즌 작업 생성 (배치)

### 이벤트
- 스케줄러(시간 기반 트리거) 매년 3월 1일 06:00 실행

### 조건
- `CHILD.state=재원` 원아 대상

### 액션
- 원아별 `related_event=진급(3/1)`, `category=진급-반배정` TASK 생성
- 기존 동일 TASK 존재 시 건너뜀

---

## 오류/예외 처리
- 필수 키(`child_id`, `task_id`) 누락 행은 자동화 제외 + 로그 기록
- 스크립트 실패 시 재실행 가능하도록 멱등 키 기반으로 설계
- 사용자 수동 수정 내용은 자동화가 덮어쓰지 않도록 최소 필드만 갱신

## 운영 모니터링 권장
- 일일: 생성 실패 로그 0건 확인
- 주간: 중복 TASK(동일 유니크 키) 점검
- 월간: 완료 누락(`status=완료`, `completed_at` 공란) 점검
