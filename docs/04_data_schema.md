# 데이터 스키마 (MVP)

## 개요
MVP는 Google Sheets 4개 시트(`CHILD`, `TASKS`, `CLASS_ASSIGNMENT`, `ROSTER`)를 논리 테이블로 사용한다. 이 문서는 테이블 관계, 키, 제약 조건을 정의한다.

## 논리 ER 관계
- `CHILD (1) ── (N) TASKS`
- `CHILD (1) ── (N) CLASS_ASSIGNMENT`
- `CHILD (1) ── (N) ROSTER` *(운영상 최신 1건이 일반적이나, 출력 이력 유지 시 N건 가능)*

---

## 1) TABLE: CHILD

### Primary Key
- `child_id`

### 컬럼
| column | type | null | key | notes |
|---|---|---|---|---|
| child_id | text | N | PK | `CH-YYYYMMDD-###` |
| name | text | N |  | 원아명 |
| birth_date | date | N |  | 생년월일 |
| admission_confirmed | boolean | N |  | 입학확정 플래그 |
| admission_date | date | Y |  | 입학예정/입학일 |
| state | enum | N |  | `상담중,입학확정,재원,퇴소,종료` |
| current_class | text | Y |  | 최신 반 |
| monthly_fee | number | N |  | 0 이상 |
| memo | text | Y |  | 비고 |

---

## 2) TABLE: TASKS

### Primary Key
- `task_id`

### Foreign Key
- `child_id` → `CHILD.child_id` (nullable)

### 컬럼
| column | type | null | key | notes |
|---|---|---|---|---|
| task_id | text | N | PK | `T-YYYYMMDD-###` |
| child_id | text | Y | FK | 원아 대상 업무일 때 필수 |
| related_event | enum | N |  | 이벤트 종류 |
| category | enum | N |  | 업무 카테고리 |
| status | enum | N |  | `대기,완료` |
| sms_status | enum | Y |  | 안내문자 전용 상태 |
| scheduled_at | datetime | Y |  | 예약 시각 |
| due_date | date | Y |  | 마감일 |
| created_at | datetime | N |  | 생성시각 |
| completed_at | datetime | Y |  | 완료시각 |
| memo | text | Y |  | 비고 |

### CHECK 제약(운영 규칙)
- `status='완료'` 이면 `completed_at IS NOT NULL`
- `category='안내문자'` 이면 `sms_status IN ('미발송','예약','발송완료')`
- `category!='안내문자'` 이면 `sms_status IS NULL` 권장

---

## 3) TABLE: CLASS_ASSIGNMENT

### Primary Key
- `assignment_id`

### Foreign Key
- `child_id` → `CHILD.child_id`

### 컬럼
| column | type | null | key | notes |
|---|---|---|---|---|
| assignment_id | text | N | PK | `A-YYYYMMDD-###` |
| child_id | text | N | FK | 원아 ID |
| effective_date | date | N |  | 반배정 적용일 |
| class_name | text | N |  | 배정 반 |
| reason | enum | N |  | `입학,진급,변경` |
| memo | text | Y |  | 비고 |

---

## 4) TABLE: ROSTER

### Candidate Key
- `(class_name, child_id)`

### Foreign Key
- `child_id` → `CHILD.child_id`

### 컬럼
| column | type | null | key | notes |
|---|---|---|---|---|
| class_name | text | N | CK | 반명 |
| child_name | text | N |  | 표시명 |
| child_id | text | N | FK/CK | 원아 ID |

---

## Enum 사전
- `CHILD.state`: `상담중,입학확정,재원,퇴소,종료`
- `TASKS.related_event`: `입학확정,정기상담(4월),정기상담(10월),수시상담,퇴소,진급(3/1)`
- `TASKS.category`: `명단,원비,안내문자,급식일지,교재주문,입퇴원처리부,정기상담-일정확정,정기상담-기록완료,수시상담-일정확정,수시상담-기록완료,환불-정산,증서-번호입력,진급-반배정`
- `TASKS.status`: `대기,완료`
- `TASKS.sms_status`: `미발송,예약,발송완료`
- `CLASS_ASSIGNMENT.reason`: `입학,진급,변경`

## 정합성 점검 쿼리(개념)
- 완료 누락: `status='완료' AND completed_at IS NULL`
- 고아 TASK: `TASKS.child_id IS NOT NULL` 이지만 `CHILD` 미존재
- 반정보 불일치: `CHILD.current_class`와 최신 `CLASS_ASSIGNMENT.class_name` 불일치
