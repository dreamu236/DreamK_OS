# Google Sheets MVP v1 (Director-only 운영 OS)

## 목적
원장 1인이 **입력 최소화 → 이벤트 발생 → TASK 묶음 자동 생성 → 완료 체크로 누락 방지** 흐름으로 운영할 수 있도록, Google Sheets 기반 MVP 시트/컬럼/검증 규칙을 정의한다.

## 범위
- 대상 시트: `CHILD`, `TASKS`, `CLASS_ASSIGNMENT`, `ROSTER`
- 필수 산출물:
  - 시트 정의
  - 컬럼 정의
  - 예시 행
  - 데이터 유효성 규칙
  - `명단(ROSTER)`/`안내문자(SMS)` TASK 완료 기준

---

## 공통 규칙

### ID 규칙
- `child_id`: `CH-YYYYMMDD-###` (예: `CH-20260222-001`)
- `task_id`: `T-YYYYMMDD-###` (예: `T-20260222-001`)
- `assignment_id`: `A-YYYYMMDD-###` (예: `A-20260303-001`)

### 날짜/시간 규칙
- Date: `YYYY-MM-DD`
- Datetime: `YYYY-MM-DD HH:mm` (24시간)

### 값 표준화 규칙
- 드롭다운 값은 본 문서의 **정의된 enum만** 사용
- 빈값 허용 여부는 각 컬럼의 `required`로 통제

---

## 1) SHEET: `CHILD` (원아 마스터)

### 시트 목적
원아 기본 정보 및 재원 상태를 단일 소스로 관리한다.

### 컬럼 정의
| column | type | required | example | notes |
|---|---|---:|---|---|
| child_id | text | Y | CH-20260222-001 | 원아 고유 ID (중복 불가) |
| name | text | Y | 김하늘 | 원아명 |
| birth_date | date | Y | 2021-05-10 | 생년월일 |
| admission_confirmed | checkbox | Y | TRUE | 입학확정 트리거 플래그 |
| admission_date | date | N | 2026-03-03 | 입학예정/입학일 |
| state | dropdown | Y | 상담중 | 기본값 `상담중` |
| current_class | text | N | 5세반 | 최신 반 정보 |
| monthly_fee | number | Y | 350000 | 월 원비(원) |
| memo | text | N | 알레르기 주의 | 비고 |

### 데이터 유효성
- `child_id`: 사용자 지정 수식 `=REGEXMATCH(A2,"^CH-[0-9]{8}-[0-9]{3}$")`
- `state`: `상담중,입학확정,재원,퇴소,종료`
- `admission_confirmed`: 체크박스(TRUE/FALSE)
- `birth_date`, `admission_date`: 날짜 형식
- `monthly_fee`: 숫자, `>=0`

### 예시 행
| child_id | name | birth_date | admission_confirmed | admission_date | state | current_class | monthly_fee | memo |
|---|---|---|---|---|---|---|---:|---|
| CH-20260222-001 | 김하늘 | 2021-05-10 | FALSE |  | 상담중 |  | 350000 |  |
| CH-20260222-002 | 이도윤 | 2020-02-03 | TRUE | 2026-03-03 | 재원 | 6세반 | 350000 | 적응 완료 |

---

## 2) SHEET: `TASKS` (업무 큐/체크리스트)

### 시트 목적
이벤트에 따라 생성되는 운영 업무를 추적하고, 완료 체크로 누락을 방지한다.

### 컬럼 정의
| column | type | required | example | notes |
|---|---|---:|---|---|
| task_id | text | Y | T-20260222-001 | TASK 고유 ID (중복 불가) |
| child_id | text | N | CH-20260222-002 | 대상 원아 ID |
| related_event | dropdown | Y | 입학확정 | TASK 발생 이벤트 |
| category | dropdown | Y | 명단 | 업무 카테고리 |
| status | dropdown | Y | 대기 | 기본값 `대기` |
| sms_status | dropdown | N | 미발송 | 안내문자 TASK에서만 사용 |
| scheduled_at | datetime | N | 2026-03-02 10:00 | 예약 실행/발송 시간 |
| due_date | date | N | 2026-03-02 | 마감일 |
| created_at | datetime | Y | 2026-02-22 11:30 | 생성 시각 |
| completed_at | datetime | N | 2026-02-22 12:10 | 완료 시각 |
| memo | text | N | 보호자 발송 전 확인 | 비고 |

### Enum 정의
- `related_event`: `입학확정,정기상담(4월),정기상담(10월),수시상담,퇴소,진급(3/1)`
- `category`: `명단,원비,안내문자,급식일지,교재주문,입퇴원처리부,정기상담-일정확정,정기상담-기록완료,수시상담-일정확정,수시상담-기록완료,환불-정산,증서-번호입력,진급-반배정`
- `status`: `대기,완료`
- `sms_status`: `(빈칸),미발송,예약,발송완료`

### 데이터 유효성
- `task_id`: 사용자 지정 수식 `=REGEXMATCH(A2,"^T-[0-9]{8}-[0-9]{3}$")`
- `status=완료`이면 `completed_at` 필수 (권장 수식 검사)
- `category=안내문자`이면 `sms_status`는 빈값 불가
- `category!=안내문자`이면 `sms_status`는 빈값 유지 권장

### 입학확정 이벤트 기본 TASK 템플릿(6개)
| category | 기본 status | 기본 sms_status | 비고 |
|---|---|---|---|
| 명단 | 대기 |  | ROSTER 반영 대상 |
| 원비 | 대기 |  | 원비 등록/확인 |
| 안내문자 | 대기 | 미발송 | 예약/발송 후 완료 |
| 급식일지 | 대기 |  | 시스템 반영 |
| 교재주문 | 대기 |  | 교재 발주 |
| 입퇴원처리부 | 대기 |  | 행정 기록 |

### 예시 행(입학확정으로 생성된 TASK)
| task_id | child_id | related_event | category | status | sms_status | scheduled_at | due_date | created_at | completed_at | memo |
|---|---|---|---|---|---|---|---|---|---|---|
| T-20260222-001 | CH-20260222-002 | 입학확정 | 명단 | 대기 |  |  |  | 2026-02-22 11:30 |  |  |
| T-20260222-002 | CH-20260222-002 | 입학확정 | 원비 | 완료 |  |  | 2026-02-23 | 2026-02-22 11:30 | 2026-02-22 12:10 | 등록 완료 |
| T-20260222-003 | CH-20260222-002 | 입학확정 | 안내문자 | 완료 | 예약 | 2026-02-23 09:00 | 2026-02-23 | 2026-02-22 11:30 | 2026-02-22 12:00 | 입학 안내 발송 예약 |

---

## 3) SHEET: `CLASS_ASSIGNMENT` (반배정 이력)

### 시트 목적
원아의 반배정 변경 이력을 관리한다.

### 컬럼 정의
| column | type | required | example | notes |
|---|---|---:|---|---|
| assignment_id | text | Y | A-20260303-001 | 배정 이력 고유 ID |
| child_id | text | Y | CH-20260222-002 | 원아 ID |
| effective_date | date | Y | 2026-03-03 | 적용일 |
| class_name | text | Y | 6세반 | 배정 반 |
| reason | dropdown | Y | 입학 | 변경 사유 |
| memo | text | N | 원장 수동 확정 | 비고 |

### 데이터 유효성
- `assignment_id`: 사용자 지정 수식 `=REGEXMATCH(A2,"^A-[0-9]{8}-[0-9]{3}$")`
- `reason`: `입학,진급,변경`
- `effective_date`: 날짜 형식

### 예시 행
| assignment_id | child_id | effective_date | class_name | reason | memo |
|---|---|---|---|---|---|
| A-20260303-001 | CH-20260222-002 | 2026-03-03 | 6세반 | 입학 |  |
| A-20270301-001 | CH-20260222-002 | 2027-03-01 | 7세반 | 진급 | 원장 수동 반배정 |

---

## 4) SHEET: `ROSTER` (원아명단 출력용)

### 시트 목적
반별 원아명단 출력/확인을 위한 뷰 데이터 관리.

### 컬럼 정의
| column | type | required | example | notes |
|---|---|---:|---|---|
| class_name | text | Y | 6세반 | 반 이름 |
| child_name | text | Y | 이도윤 | 원아명 |
| child_id | text | Y | CH-20260222-002 | 원아 ID |

### 데이터 유효성
- `child_id`: 사용자 지정 수식 `=REGEXMATCH(C2,"^CH-[0-9]{8}-[0-9]{3}$")`
- `class_name`, `child_name`: 빈값 불가

### 예시 행
| class_name | child_name | child_id |
|---|---|---|
| 6세반 | 이도윤 | CH-20260222-002 |
| 5세반 | 김하늘 | CH-20260222-001 |

---

## 5) TASK 완료 기준 (MVP 필수)

### A. 명단 TASK (`category=명단`) 완료 조건
아래 **모든 조건** 충족 시 완료 처리:
1. `ROSTER` 시트에 해당 `child_id` 행이 존재한다.
2. 해당 행의 `class_name`이 비어있지 않다.
3. `TASKS.status=완료`로 체크한다.
4. `TASKS.completed_at`이 기록된다.

### B. 안내문자 TASK (`category=안내문자`) 완료 조건
아래 **모든 조건** 충족 시 완료 처리:
1. `TASKS.sms_status`가 `예약` 또는 `발송완료` 중 하나다.
2. `TASKS.status=완료`로 체크한다.
3. `TASKS.completed_at`이 기록된다.

> MVP 원칙: 자동 완료 처리 없이 원장 수동 체크를 기본으로 하되, 유효성 규칙으로 누락을 최소화한다.

---

## 6) 운영 권장 필터 뷰
- `대기 TASK`: `status=대기`
- `안내문자 TASK`: `category=안내문자`
- `완료 누락 점검`: `status=완료 AND completed_at is blank`
