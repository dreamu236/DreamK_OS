#!/usr/bin/env bash
set -euo pipefail

FILE="docs/06_google_sheets_mvp.md"

[[ -f "$FILE" ]] || { echo "Missing $FILE"; exit 1; }

required_terms=(
  "SHEET: \`CHILD\`"
  "SHEET: \`TASKS\`"
  "SHEET: \`CLASS_ASSIGNMENT\`"
  "SHEET: \`ROSTER\`"
  "컬럼 정의"
  "예시 행"
  "데이터 유효성"
  "명단 TASK"
  "안내문자 TASK"
)

for term in "${required_terms[@]}"; do
  if ! grep -Fq "$term" "$FILE"; then
    echo "Validation failed: missing term '$term' in $FILE"
    exit 1
  fi
done

echo "validate.sh: PASS"
