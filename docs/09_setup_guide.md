# DreamK_OS 설치/셋업 가이드 (원장님용, Windows 친화)

이 문서는 **Google Sheet + Apps Script**를 처음 설정하는 원장님이 그대로 따라할 수 있게 만든 체크리스트형 설치 가이드입니다.

---

## 1) Google Sheet 생성 및 시트(탭) 이름 만들기

1. Chrome(또는 Edge)에서 Google Drive 접속
2. `새로 만들기` → `Google 스프레드시트`
3. 파일명을 예: `DreamK_OS_MVP`로 변경
4. 하단 시트 탭을 아래 **정확한 이름/순서**로 만듭니다.
   1) `CHILD`
   2) `TASKS`
   3) `CLASS_ASSIGNMENT`
   4) `ROSTER`
   5) `RULES`

> 탭 이름이 다르면 스크립트가 동작하지 않습니다. 공백/오탈자 주의.

---

## 2) 각 시트 헤더(1행) 붙여넣기 — 정확한 이름/순서

아래 줄을 각 시트 A1 셀에 붙여넣으세요(탭 구분).

### CHILD (A1)
```text
child_id	name	birth_date	admission_confirmed	admission_date	state	current_class	monthly_fee	memo
```

### TASKS (A1)
```text
task_id	child_id	related_event	category	status	sms_status	scheduled_at	due_date	created_at	completed_at	memo
```

### CLASS_ASSIGNMENT (A1)
```text
assignment_id	child_id	effective_date	class_name	reason	memo
```

### ROSTER (A1)
```text
class_name	child_name	child_id
```

### RULES (A1)
```text
key	school_year	birth_year	class_group	class_name	round_robin_group	round_robin_key	active	value_text	memo
```

---

## 3) 데이터 유효성 설정 (드롭다운/체크박스)

Windows/한글 UI 기준: 범위 선택 → `데이터` 메뉴 → `데이터 유효성`.

### A. 체크박스 컬럼
- `CHILD.admission_confirmed`(D열) → 체크박스
- `RULES.active`(H열) → 체크박스

### B. 드롭다운 목록
- `CHILD.state`(F열):
  - `상담중,입학확정,재원,퇴소,종료`
- `TASKS.status`(E열):
  - `대기,완료`
- `TASKS.sms_status`(F열):
  - `미발송,예약,발송완료`
- `TASKS.related_event`(C열):
  - `입학확정,정기상담(4월),정기상담(10월),수시상담,퇴소,진급(3/1)`
- `CLASS_ASSIGNMENT.reason`(E열):
  - `입학,진급,변경`

> `TASKS.sms_status`는 안내문자 TASK에서만 사용합니다.

---

## 4) RULES 예시 데이터 입력 (2026 기준)

`RULES` 시트 2행부터 아래 예시를 입력하세요.

| key | school_year | birth_year | class_group | class_name | round_robin_group | round_robin_key | active | value_text | memo |
|---|---:|---:|---|---|---|---|---|---|---|
| class_map | 2026 | 2022 | 3세반 | 고운1반 | 고운반군 | rr_2026_2022_next | TRUE |  | 2026 3세반 순환배정 |
| class_map | 2026 | 2022 | 3세반 | 고운2반 | 고운반군 | rr_2026_2022_next | TRUE |  | 2026 3세반 순환배정 |
| class_map | 2026 | 2021 | 4세반 | 누리반 |  |  | TRUE |  | 2026 단일배정 |
| class_map | 2026 | 2020 | 5세반 | 드림반 |  |  | TRUE |  | 2026 단일배정 |
| rr_2026_2022_next | 2026 |  |  |  |  |  | TRUE | 0 | round-robin 포인터(0부터 시작) |

매핑 요약(요구사항):
- `2022 -> 고운1/2` (순환)
- `2021 -> 누리`
- `2020 -> 드림`
- 포인터 키: `rr_2026_2022_next`

---

## 5) Apps Script 열기, 코드 붙여넣기, 권한 승인

1. 스프레드시트 상단 메뉴 `확장 프로그램` → `Apps Script`
2. 기본 `Code.gs` 내용 전체 삭제
3. 저장소의 `apps_script/Code.gs` 내용을 복사해서 붙여넣기
4. 상단 `저장` 클릭
5. 함수 목록에서 임시로 `onEdit` 선택 후 `실행`(또는 트리거 생성 시 최초 승인)
6. 권한 팝업에서 Google 계정 선택 → `고급` → 프로젝트(안전하지 않음) 이동 → 허용

> 처음 1회 권한 승인이 필요합니다.

---

## 6) 설치형 트리거(onEdit) 생성 — admission_confirmed용

1. Apps Script 좌측 `트리거`(알람 아이콘) 클릭
2. `트리거 추가`
3. 아래처럼 설정:
   - 실행할 함수: `onEdit`
   - 배포에서 실행: `Head`
   - 이벤트 소스: `스프레드시트`
   - 이벤트 유형: `수정 시`
4. 저장

스크립트는 내부에서 **`CHILD.admission_confirmed`가 TRUE로 바뀐 경우에만** 동작합니다.

---

## 7) 동작 규칙 요약 (자동 처리)

`CHILD.admission_confirmed`가 TRUE가 되면:
1. `admission_date`의 3월 기준으로 `school_year` 계산
   - 3~12월: 해당 연도
   - 1~2월: 전년도
2. `RULES`에서 `key=class_map AND school_year AND birth_year AND active=TRUE` 조회
3. 2022년생처럼 다건 매핑이면 `rr_2026_2022_next`로 라운드로빈
4. 6개 TASK 자동 생성:
   - 명단 / 원비 / 안내문자 / 급식일지 / 교재주문 / 입퇴원처리부
   - 안내문자 TASK는 `sms_status=미발송`
5. `CLASS_ASSIGNMENT` 1건 추가(`reason=입학`)
6. `CHILD.state`, `CHILD.current_class` 갱신
7. 매핑이 없으면 `current_class=미배정` + `TASKS.category=반배정-수동` 1건 추가

중복 방지:
- `bundle_key` + `LockService`로 동일 입학 이벤트의 6개 TASK 묶음 중복 생성을 차단

---

## 8) 스모크 테스트 체크리스트 (빠른 검증)

### 사전 입력
1. `CHILD`에 테스트 원아 1명 입력 (예: birth_date=2022-04-10, admission_date=2026-03-04)
2. `admission_confirmed`는 FALSE 상태로 저장
3. `RULES` 예시 데이터가 들어있는지 확인

### 실행
1. `CHILD.admission_confirmed`를 TRUE로 변경
2. 2~5초 대기 후 아래 확인

### 기대 결과
- `TASKS`에 해당 child_id로 **6개 행** 생성
- 6개 중 `category=안내문자` 행의 `sms_status=미발송`
- `CLASS_ASSIGNMENT`에 **1개 행** 생성 (`reason=입학`)
- `CHILD.current_class`가 규칙에 맞는 반으로 갱신
- `CHILD.state`가 갱신됨

### 중복 방지 확인
- 같은 셀을 다시 TRUE로 바꿔도(또는 재수정해도) 동일 `bundle_key` 6개 TASK가 중복 생성되지 않음

---

## 9) 자주 발생하는 문제

- 트리거가 동작하지 않음
  - 탭 이름 오탈자 확인 (`CHILD`, `TASKS`, `CLASS_ASSIGNMENT`, `ROSTER`, `RULES`)
  - 설치형 트리거가 `onEdit / 스프레드시트 / 수정 시`인지 확인
  - 권한 승인 완료 여부 확인
- 반배정이 미배정으로 들어감
  - `RULES.active=TRUE`인지 확인
  - `school_year`, `birth_year` 값 타입(숫자) 확인
  - `class_map` 행의 key 오탈자 확인
