# Google Sheets MVP v1 (Director-only 운영 OS)

## 목적
원장 1인이 “입력 최소화 → 이벤트 발생 → 업무(TASK) 묶음 생성 → 완료 체크로 누락 방지” 방식으로 운영할 수 있는 최소 시트 설계.

## MVP 시작 시트(4개)
- CHILD (원아 마스터)
- TASKS (업무 큐/체크리스트)
- CLASS_ASSIGNMENT (반배정 이력)
- ROSTER (원아명단 출력용)  ※ “명단 TASK 완료 기준” 때문에 MVP부터 포함 권장

---

## 1) SHEET: CHILD (원아 마스터)

### 컬럼 정의
| column | type | example | notes |
|---|---|---|---|
| child_id | text | CH-20260222-001 | 고유 ID(자동 생성 추천) |
| name | text | 김하늘 |  |
| birth_date | date | 2021-05-10 |  |
| admission_confirmed | checkbox | TRUE/FALSE | **입학확정 트리거** |
| admission_date | date | 2026-03-03 | 없으면 빈칸 가능 |
| state | dropdown | 상담중/입학확정/재원/퇴소/종료 | 기본값: 상담중 |
| current_class | text | 5세반 | 입학확정 시 채움 |
| monthly_fee | number | 350000 | 월 원비 |
| memo | text | 알레르기… | 선택 |

### 데이터 유효성(Validation)
- state: `상담중,입학확정,재원,퇴소,종료`
- admission_confirmed: 체크박스
- birth_date/admission_date: 날짜 형식

### 예시 행(2개)
| child_id | name | birth_date | admission_confirmed | admission_date | state | current_class | monthly_fee | memo |
|---|---|---|---|---|---|---|---:|---|
| CH-20260222-001 | 김하늘 | 2021-05-10 | FALSE |  | 상담중 |  | 350000 |  |
| CH-20260222-002 | 이도윤 | 2020-02-03 | TRUE | 2026-03-03 | 재원 | 6세반 | 350000 |  |

---

## 2) SHEET: TASKS (업무 큐/체크리스트)

### 목적
이벤트 발생 시 업무가 자동으로 생성되고, 원장이 완료 체크로 누락을 방지한다.

### 컬럼 정의
| column | type | example | notes |
|---|---|---|---|
| task_id | text | T-001 | UUID/자동 생성 추천 |
| child_id | text | CH-20260222-002 | 연결(없을 수도 있음) |
| related_event | dropdown | 입학확정/정기상담(4월)/정기상담(10월)/수시상담/퇴소/진급(3/1) | |
| category | dropdown | 명단/원비/안내문자/급식일지/교재주문/입퇴원처리부/정기상담-일정확정/정기상담-기록완료/수시상담-일정확정/수시상담-기록완료/환불-정산/증서-번호입력/진급-반배정 | MVP는 6대 업무부터 |
| status | dropdown | 대기/완료 | 기본값: 대기 |
| sms_status | dropdown | (빈칸)/미발송/예약/발송완료 | **안내문자 전용** |
| scheduled_at | datetime | 2026-03-02 10:00 | 상담/문자 예약 |
| due_date | date | 2026-03-02 | 선택 |
| created_at | datetime | 2026-02-22 11:30 | 자동 추천(NOW) |
| completed_at | datetime | 2026-02-22 12:10 | 완료 시 입력(수동/자동) |
| memo | text |  | 선택 |

### 데이터 유효성(Validation)
- related_event: `입학확정,정기상담(4월),정기상담(10월),수시상담,퇴소,진급(3/1)`
- category: `명단,원비,안내문자,급식일지,교재주문,입퇴원처리부,정기상담-일정확정,정기상담-기록완료,수시상담-일정확정,수시상담-기록완료,환불-정산,증서-번호입력,진급-반배정`
- status: `대기,완료`
- sms_status: `(빈칸),미발송,예약,발송완료`

### 예시 행(입학확정으로 생성되는 6개 TASK)
| task_id | child_id | related_event | category | status | sms_status | scheduled_at | due_date | created_at | completed_at | memo |
|---|---|---|---|---|---|---|---|---|---|---|
| T-001 | CH-20260222-002 | 입학확정 | 명단 | 대기 |  |  |  | 2026-02-22 11:30 |  |  |
| T-002 | CH-20260222-002 | 입학확정 | 원비 | 대기 |  |  |  | 2026-02-22 11:30 |  |  |
| T-003 | CH-20260222-002 | 입학확정 | 안내문자 | 대기 | 미발송 |  |  | 2026-02-22 11:30 |  |  |
| T-004 | CH-20260222-002 | 입학확정 | 급식일지 | 대기 |  |  |  | 2026-02-22 11:30 |  |  |
| T-005 | CH-20260222-002 | 입학확정 | 교재주문 | 대기 |  |  |  | 2026-02-22 11:30 |  |  |
| T-006 | CH-20260222-002 | 입학확정 | 입퇴원처리부 | 대기 |  |  |  | 2026-02-22 11:30 |  |  |

### 완료 기준(원장 확정 사항)
- **명단 TASK 완료 조건**
  - ROSTER 시트에 해당 `child_id` 행이 존재
  - `class_name`이 채워져 있음
  - TASKS의 해당 행 `status=완료`로 체크
- **안내문자 TASK 완료 조건**
  - TASKS의 해당 행 `sms_status`가 `예약` 또는 `발송완료`
  - TASKS의 해당 행 `status=완료`로 체크

> MVP에서는 자동 완료 처리 없이 “원장 체크”로 운영(누락 방지 우선).

---

## 3) SHEET: CLASS_ASSIGNMENT (반배정 이력)

### 컬럼 정의
| column | type | example | notes |
|---|---|---|---|
| assignment_id | text | A-001 | UUID/자동 생성 추천 |
| child_id | text | CH-20260222-002 | |
| effective_date | date | 2026-03-03 | |
| class_name | text | 6세반 | |
| reason | dropdown | 입학/진급/변경 | |
| memo | text |  | 선택 |

### 데이터 유효성(Validation)
- reason: `입학,진급,변경`

### 예시 행(2개)
| assignment_id | child_id | effective_date | class_name | reason | memo |
|---|---|---|---|---|---|
| A-001 | CH-20260222-002 | 2026-03-03 | 6세반 | 입학 |  |
| A-002 | CH-20260222-002 | 2027-03-01 | 7세반 | 진급 | 원장 수동 반배정 |

---

## 4) SHEET: ROSTER (원아명단 출력용)

### 컬럼 정의
| column | type | example | notes |
|---|---|---|---|
| class_name | text | 6세반 | |
| child_name | text | 이도윤 | |
| child_id | text | CH-20260222-002 | |

### 예시 행(2개)
| class_name | child_name | child_id |
|---|---|---|
| 6세반 | 이도윤 | CH-20260222-002 |
| 5세반 | 김하늘 | CH-20260222-001 |

---

## 5) 운영 팁(필수 아님, 추천)
- TASKS에 필터 뷰 2개 생성:
  - “대기 TASK만”: status=대기
  - “안내문자만”: category=안내문자
