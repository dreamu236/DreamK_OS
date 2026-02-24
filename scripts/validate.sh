#!/usr/bin/env bash
set -euo pipefail

files=(
  "docs/03_workflows.md"
  "docs/04_data_schema.md"
  "docs/06_google_sheets_mvp.md"
  "docs/07_automation_triggers.md"
  "docs/09_setup_guide.md"
  "apps_script/Code.gs"
  "templates/headers_child.csv"
  "templates/headers_tasks.csv"
  "templates/headers_class_assignment.csv"
  "templates/headers_roster.csv"
  "templates/headers_rules.csv"
  "templates/rules_2026.tsv"
  "templates/sample_child_rows.tsv"
)

for f in "${files[@]}"; do
  [[ -s "$f" ]] || { echo "Validation failed: missing or empty $f"; exit 1; }
done

check_contains() {
  local file="$1"
  local term="$2"
  if ! grep -Fq "$term" "$file"; then
    echo "Validation failed: missing term '$term' in $file"
    exit 1
  fi
}

check_contains docs/03_workflows.md "Workflow A — 입학확정"
check_contains docs/03_workflows.md "일일 운영 루틴"

check_contains docs/04_data_schema.md "TABLE: CHILD"
check_contains docs/04_data_schema.md "TABLE: TASKS"
check_contains docs/04_data_schema.md "Enum 사전"

check_contains docs/06_google_sheets_mvp.md 'SHEET: `CHILD`'
check_contains docs/06_google_sheets_mvp.md 'SHEET: `TASKS`'
check_contains docs/06_google_sheets_mvp.md "명단 TASK"
check_contains docs/06_google_sheets_mvp.md "안내문자 TASK"

check_contains docs/07_automation_triggers.md "Trigger 1 — 입학확정 TASK 자동 생성"
check_contains docs/07_automation_triggers.md "Trigger 4 — 진급 시즌 작업 생성"

check_contains docs/09_setup_guide.md "CHILD"
check_contains docs/09_setup_guide.md "TASKS"
check_contains docs/09_setup_guide.md "CLASS_ASSIGNMENT"
check_contains docs/09_setup_guide.md "ROSTER"
check_contains docs/09_setup_guide.md "RULES"

check_contains apps_script/Code.gs "rr_2026_2022_next"
check_contains apps_script/Code.gs "ADMISSION_TASK_CATEGORIES"
check_contains apps_script/Code.gs "CLASS_ASSIGNMENT"

check_contains templates/rules_2026.tsv $'class_map\t2026\t2022\t3세반\t고운1반'
check_contains templates/rules_2026.tsv $'class_map\t2026\t2022\t3세반\t고운2반'
check_contains templates/rules_2026.tsv $'class_map\t2026\t2021\t4세반\t누리반'
check_contains templates/rules_2026.tsv $'class_map\t2026\t2020\t5세반\t드림반'
check_contains templates/rules_2026.tsv $'rr_2026_2022_next\t2026'

echo "scripts/validate.sh: PASS"
