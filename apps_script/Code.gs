/**
 * DreamK_OS Apps Script (installable onEdit)
 * - CHILD.admission_confirmed 가 TRUE로 변경될 때만 동작
 * - 입학확정 6개 TASK 생성, CLASS_ASSIGNMENT 생성, CHILD 상태 업데이트
 */

const SHEETS = {
  CHILD: 'CHILD',
  TASKS: 'TASKS',
  CLASS_ASSIGNMENT: 'CLASS_ASSIGNMENT',
  RULES: 'RULES',
};

const ADMISSION_TASK_CATEGORIES = [
  '명단',
  '원비',
  '안내문자',
  '급식일지',
  '교재주문',
  '입퇴원처리부',
];

function onEdit(e) {
  if (!e || !e.range || !e.source) return;

  const range = e.range;
  const sheet = range.getSheet();
  if (sheet.getName() !== SHEETS.CHILD) return;

  const headers = getHeaderMap_(sheet);
  const admissionConfirmedCol = headers.admission_confirmed;
  if (!admissionConfirmedCol || range.getColumn() !== admissionConfirmedCol) return;
  if (range.getRow() <= 1) return;

  const newValue = normalizeBoolean_(e.value);
  if (newValue !== true) return;

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    processAdmissionConfirmed_(e.source, sheet, range.getRow(), headers);
  } finally {
    lock.releaseLock();
  }
}

function processAdmissionConfirmed_(ss, childSheet, row, childHeaders) {
  const childRow = readRowByHeader_(childSheet, row, childHeaders);
  const childId = valueOrEmpty_(childRow.child_id);
  if (!childId) return;

  const admissionDate = asDate_(childRow.admission_date);
  if (!admissionDate) {
    throw new Error('CHILD.admission_date가 필요합니다.');
  }

  const birthDate = asDate_(childRow.birth_date);
  if (!birthDate) {
    throw new Error('CHILD.birth_date가 필요합니다.');
  }

  const schoolYear = computeSchoolYear_(admissionDate);
  const birthYear = birthDate.getFullYear();
  const classDecision = resolveClassByRules_(ss, schoolYear, birthYear);

  const bundleKey = computeBundleKey_(childId, admissionDate, schoolYear, birthYear);

  const taskSheet = mustGetSheet_(ss, SHEETS.TASKS);
  const taskHeaders = getHeaderMap_(taskSheet);
  const existingBundleCount = countBundleTasks_(taskSheet, taskHeaders, bundleKey);

  if (existingBundleCount === 0) {
    createAdmissionTasks_(taskSheet, taskHeaders, childId, bundleKey);
    if (classDecision.className === '미배정') {
      appendRowByHeader_(taskSheet, taskHeaders, {
        task_id: generateId_('T'),
        child_id: childId,
        related_event: '입학확정',
        category: '반배정-수동',
        status: '대기',
        created_at: new Date(),
        memo: `bundle_key=${bundleKey}; class_map_not_found`,
      });
    }
  }

  const classSheet = mustGetSheet_(ss, SHEETS.CLASS_ASSIGNMENT);
  const classHeaders = getHeaderMap_(classSheet);
  ensureClassAssignment_(classSheet, classHeaders, {
    childId,
    admissionDate,
    className: classDecision.className,
    reason: '입학',
    memo: `school_year=${schoolYear}, birth_year=${birthYear}, bundle_key=${bundleKey}`,
  });

  updateChildAfterAssignment_(childSheet, row, childHeaders, classDecision.className);

  if (classDecision.usedRoundRobinPointer) {
    persistRoundRobinPointer_(ss, classDecision.usedRoundRobinPointer.key, schoolYear, classDecision.usedRoundRobinPointer.nextIndex);
  }
}

function resolveClassByRules_(ss, schoolYear, birthYear) {
  const rulesSheet = mustGetSheet_(ss, SHEETS.RULES);
  const headers = getHeaderMap_(rulesSheet);
  const rows = readDataRows_(rulesSheet, headers);

  const classMaps = rows.filter((r) =>
    valueOrEmpty_(r.key) === 'class_map' &&
    toNumber_(r.school_year) === schoolYear &&
    toNumber_(r.birth_year) === birthYear &&
    normalizeBoolean_(r.active) === true
  );

  if (classMaps.length === 0) {
    return { className: '미배정', usedRoundRobinPointer: null };
  }

  if (classMaps.length === 1) {
    return { className: valueOrEmpty_(classMaps[0].class_name) || '미배정', usedRoundRobinPointer: null };
  }

  const rrKey = valueOrEmpty_(classMaps[0].round_robin_key);
  if (!rrKey) {
    return { className: valueOrEmpty_(classMaps[0].class_name) || '미배정', usedRoundRobinPointer: null };
  }

  const pointerRow = rows.find((r) =>
    valueOrEmpty_(r.key) === rrKey &&
    toNumber_(r.school_year) === schoolYear &&
    normalizeBoolean_(r.active) === true
  );

  const currentIndex = pointerRow ? Math.max(0, toNumber_(pointerRow.value_text) || 0) : 0;
  const chosenIndex = currentIndex % classMaps.length;
  const chosenClass = valueOrEmpty_(classMaps[chosenIndex].class_name) || '미배정';

  return {
    className: chosenClass,
    usedRoundRobinPointer: {
      key: rrKey,
      nextIndex: (chosenIndex + 1) % classMaps.length,
    },
  };
}

function createAdmissionTasks_(taskSheet, headers, childId, bundleKey) {
  const now = new Date();

  ADMISSION_TASK_CATEGORIES.forEach((category) => {
    const rowObj = {
      task_id: generateId_('T'),
      child_id: childId,
      related_event: '입학확정',
      category: category,
      status: '대기',
      sms_status: category === '안내문자' ? '미발송' : '',
      created_at: now,
      memo: `bundle_key=${bundleKey}`,
    };

    appendRowByHeader_(taskSheet, headers, rowObj);
  });
}

function ensureClassAssignment_(classSheet, headers, payload) {
  const values = classSheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (
      valueAt_(row, headers.child_id) === payload.childId &&
      sameDate_(valueAt_(row, headers.effective_date), payload.admissionDate) &&
      valueAt_(row, headers.reason) === payload.reason
    ) {
      return;
    }
  }

  appendRowByHeader_(classSheet, headers, {
    assignment_id: generateId_('A'),
    child_id: payload.childId,
    effective_date: payload.admissionDate,
    class_name: payload.className,
    reason: payload.reason,
    memo: payload.memo,
  });
}

function updateChildAfterAssignment_(childSheet, row, headers, className) {
  if (headers.state) {
    childSheet.getRange(row, headers.state).setValue('입학확정');
  }
  if (headers.current_class) {
    childSheet.getRange(row, headers.current_class).setValue(className);
  }
}

function persistRoundRobinPointer_(ss, rrKey, schoolYear, nextIndex) {
  const rulesSheet = mustGetSheet_(ss, SHEETS.RULES);
  const headers = getHeaderMap_(rulesSheet);
  const values = rulesSheet.getDataRange().getValues();

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const sameKey = valueAt_(row, headers.key) === rrKey;
    const sameYear = toNumber_(valueAt_(row, headers.school_year)) === schoolYear;
    const active = normalizeBoolean_(valueAt_(row, headers.active)) === true;
    if (sameKey && sameYear && active) {
      rulesSheet.getRange(i + 1, headers.value_text).setValue(String(nextIndex));
      return;
    }
  }

  appendRowByHeader_(rulesSheet, headers, {
    key: rrKey,
    school_year: schoolYear,
    active: true,
    value_text: String(nextIndex),
    memo: '자동 생성된 round-robin 포인터',
  });
}

function countBundleTasks_(taskSheet, headers, bundleKey) {
  const values = taskSheet.getDataRange().getValues();
  let count = 0;
  for (let i = 1; i < values.length; i++) {
    const memo = String(valueAt_(values[i], headers.memo) || '');
    if (memo.indexOf(`bundle_key=${bundleKey}`) >= 0) count++;
  }
  return count;
}

function computeBundleKey_(childId, admissionDate, schoolYear, birthYear) {
  return [childId, formatDate_(admissionDate), schoolYear, birthYear, '입학확정'].join('|');
}

function getHeaderMap_(sheet) {
  const headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const map = {};
  headerRow.forEach((h, idx) => {
    map[String(h).trim()] = idx + 1;
  });
  return map;
}

function readDataRows_(sheet, headers) {
  const values = sheet.getDataRange().getValues();
  const keys = Object.keys(headers);
  const rows = [];
  for (let i = 1; i < values.length; i++) {
    const row = {};
    keys.forEach((k) => {
      row[k] = valueAt_(values[i], headers[k]);
    });
    rows.push(row);
  }
  return rows;
}

function readRowByHeader_(sheet, rowIndex, headers) {
  const rowValues = sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0];
  const out = {};
  Object.keys(headers).forEach((k) => {
    out[k] = valueAt_(rowValues, headers[k]);
  });
  return out;
}

function appendRowByHeader_(sheet, headers, rowObj) {
  const row = new Array(sheet.getLastColumn()).fill('');
  Object.keys(rowObj).forEach((key) => {
    if (headers[key]) {
      row[headers[key] - 1] = rowObj[key];
    }
  });
  sheet.appendRow(row);
}

function mustGetSheet_(ss, name) {
  const sh = ss.getSheetByName(name);
  if (!sh) throw new Error(`시트를 찾을 수 없습니다: ${name}`);
  return sh;
}

function normalizeBoolean_(v) {
  if (v === true || v === 'TRUE' || v === 'true' || v === 1) return true;
  if (v === false || v === 'FALSE' || v === 'false' || v === 0) return false;
  return null;
}

function asDate_(v) {
  if (!v) return null;
  if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v)) return v;
  const d = new Date(v);
  return isNaN(d) ? null : d;
}

function computeSchoolYear_(admissionDate) {
  const y = admissionDate.getFullYear();
  const m = admissionDate.getMonth() + 1;
  return m >= 3 ? y : y - 1;
}

function toNumber_(v) {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function valueOrEmpty_(v) {
  return v == null ? '' : String(v).trim();
}

function valueAt_(rowValues, oneBasedCol) {
  if (!oneBasedCol) return '';
  return rowValues[oneBasedCol - 1];
}

function formatDate_(d) {
  return Utilities.formatDate(d, Session.getScriptTimeZone() || 'Asia/Seoul', 'yyyy-MM-dd');
}

function sameDate_(a, b) {
  const da = asDate_(a);
  const db = asDate_(b);
  if (!da || !db) return false;
  return formatDate_(da) === formatDate_(db);
}

function generateId_(prefix) {
  const now = new Date();
  const datePart = Utilities.formatDate(now, Session.getScriptTimeZone() || 'Asia/Seoul', 'yyyyMMdd');
  const seqPart = Utilities.getUuid().slice(0, 6).toUpperCase();
  return `${prefix}-${datePart}-${seqPart}`;
}
