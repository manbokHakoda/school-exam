
/************************************************************
 * 52-Р СУРГУУЛЬ — 10-Р АНГИЙН МХХТ-ИЙН ШАЛГАЛТ
 * Google Apps Script + Google Sheets
 ************************************************************/

const CONFIG = {
  SPREADSHEET_ID: '1_8iBQYpjdd5wlzZbt5XSkn74FJOSa-atlXW6SIz7m50',
  SHEET_NAME: 'ExamResults',
  DASHBOARD_NAME: 'Dashboard',
  ACCESS_SHEET: 'RetakeAccess',
  TIMEZONE: 'Asia/Ulaanbaatar',
  DURATION_SECONDS: 40 * 60,
  ALLOWED_CLASSES: ['10А', '10Б', '10В', '10Г', '10Д'],

  // ЭНЭ КОДЫГ ӨӨРИЙН 4 ОРОНТОЙ КОДООР СОЛИНО.
  // Сурагчдад админы кодыг нийтэд тарааж болохгүй.
  ADMIN_PIN: '1020'
};

const QUESTIONS = [
  {
    id: 1,
    q: 'HTML-ийн үндсэн үүрэг юу вэ?',
    options: ['Вэб хуудасны бүтцийг тодорхойлох', 'Өнгө тохируулах', 'Өгөгдлийн сан үүсгэх', 'Компьютер унтраах'],
    answer: 0
  },
  {
    id: 2,
    q: 'HTML ямар үгийн товчлол вэ?',
    options: ['HyperText Markup Language', 'HighText Machine Language', 'Home Tool Markup Language', 'Hyper Transfer Main Link'],
    answer: 0
  },
  {
    id: 3,
    q: 'HTML баримтын үндсэн элементийг аль таг тодорхойлдог вэ?',
    options: ['<css>', '<html>', '<javascript>', '<bodyonly>'],
    answer: 1
  },
  {
    id: 4,
    q: 'CSS-ийн үндсэн үүрэг юу вэ?',
    options: ['Вэбийн загвар, өнгө, байрлалыг тохируулах', 'Нууц үг хадгалах', 'Үйлдлийн систем үүсгэх', 'Интернет холболт хийх'],
    answer: 0
  },
  {
    id: 5,
    q: 'Текстийн өнгийг CSS-ээр өөрчлөх шинж чанар аль вэ?',
    options: ['font-size', 'background', 'color', 'text-style-color'],
    answer: 2
  },
  {
    id: 6,
    q: 'JavaScript-ийн үндсэн үүрэг юу вэ?',
    options: ['Зөвхөн зураг зурах', 'Вэб хуудсанд интерактив үйлдэл нэмэх', 'Зөвхөн текст хэвлэх', 'HTML таг устгах'],
    answer: 1
  },
  {
    id: 7,
    q: 'HTML-д холбоос үүсгэхэд ямар таг ашигладаг вэ?',
    options: ['<p>', '<img>', '<a>', '<h1>'],
    answer: 2
  },
  {
    id: 8,
    q: 'Гадаад CSS файлыг HTML-тэй холбох таг аль вэ?',
    options: ['<script>', '<link>', '<stylelink>', '<connect>'],
    answer: 1
  },
  {
    id: 9,
    q: 'JavaScript-д хувьсагч зарлахад аль түлхүүр үгийг ашиглаж болох вэ?',
    options: ['let', 'paint', 'design', 'color'],
    answer: 0
  },
  {
    id: 10,
    q: 'HTML товч үүсгэхэд аль тагийг ашиглах вэ?',
    options: ['<click>', '<button>', '<press>', '<inputbuttontext>'],
    answer: 1
  }
];

/** Вэб сайт */
function doGet() {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('52-р сургууль | МХХТ-ийн шалгалт')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getSpreadsheet_() {
  if (!CONFIG.SPREADSHEET_ID) {
    throw new Error('Google Sheets ID тохируулаагүй байна.');
  }
  return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
}

/** Анхны хүснэгтүүдийг үүсгэх. Apps Script дээр нэг удаа Run хийнэ. */
function setupExam() {
  const ss = getSpreadsheet_();

  let results = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!results) results = ss.insertSheet(CONFIG.SHEET_NAME);

  if (results.getLastRow() === 0) {
    results.appendRow([
      'Огноо', 'Сурагч', 'Анги', 'Зөв',
      'Нийт', 'Хувь', 'Үнэлгээ', 'Хугацаа (секунд)'
    ]);
  }

  results.setFrozenRows(1);
  results.getRange(1, 1, 1, 8)
    .setFontWeight('bold')
    .setFontColor('#ffffff')
    .setBackground('#29458a');
  results.setColumnWidth(1, 165);
  results.setColumnWidth(2, 180);
  results.setColumnWidth(3, 85);
  results.setColumnWidths(4, 5, 100);

  let access = ss.getSheetByName(CONFIG.ACCESS_SHEET);
  if (!access) access = ss.insertSheet(CONFIG.ACCESS_SHEET);

  if (access.getLastRow() === 0) {
    access.appendRow([
      'Үүсгэсэн огноо', 'Сурагч', 'Анги', 'Эрх ашигласан'
    ]);
  }
  access.setFrozenRows(1);
  access.getRange(1, 1, 1, 4)
    .setFontWeight('bold')
    .setBackground('#29458a')
    .setFontColor('#ffffff');

  createExamDashboard();
  return 'ExamResults, RetakeAccess, Dashboard бэлэн боллоо.';
}

/** Сурагчид асуулт өгөх; зөв хариултыг буцаахгүй. */
function getExamData() {
  return {
    title: 'HTML · CSS · JavaScript',
    durationSeconds: CONFIG.DURATION_SECONDS,
    questions: QUESTIONS.map(q => ({
      id: q.id,
      q: q.q,
      options: q.options
    }))
  };
}

function normalizeName_(name) {
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase();
}

function validateStudent_(name, studentClass) {
  if (name.length < 2 || name.length > 100) {
    throw new Error('Овог, нэрээ зөв оруулна уу.');
  }
  if (!CONFIG.ALLOWED_CLASSES.includes(studentClass)) {
    throw new Error('Ангиа зөв сонгоно уу.');
  }
}

/** Нэг нэр, нэг ангийн сурагчийн өмнөх дүн байгаа эсэх. */
function hasPreviousAttempt_(name, studentClass) {
  const sh = getSpreadsheet_().getSheetByName(CONFIG.SHEET_NAME);
  if (!sh || sh.getLastRow() < 2) return false;

  const key = normalizeName_(name);
  const rows = sh.getRange(2, 1, sh.getLastRow() - 1, 8).getValues();

  return rows.some(r =>
    normalizeName_(r[1]) === key &&
    String(r[2]).trim() === studentClass
  );
}

/** Тухайн сурагчид ашиглаагүй дахин шалгах эрх байгаа эсэх. */
function hasRetakeGrant_(name, studentClass) {
  const sh = getSpreadsheet_().getSheetByName(CONFIG.ACCESS_SHEET);
  if (!sh || sh.getLastRow() < 2) return false;

  const key = normalizeName_(name);
  const rows = sh.getRange(2, 1, sh.getLastRow() - 1, 4).getValues();

  return rows.some(r =>
    normalizeName_(r[1]) === key &&
    String(r[2]).trim() === studentClass &&
    String(r[3]).trim() !== 'Тийм'
  );
}

/** Эхлэхийн өмнө өмнөх оролдлогыг шалгах. */
function checkStudentAccess(payload) {
  const name = String(payload && payload.name || '').trim().replace(/\s+/g, ' ');
  const studentClass = String(payload && payload.studentClass || '').trim();
  validateStudent_(name, studentClass);

  const ss = getSpreadsheet_();
  if (!ss.getSheetByName(CONFIG.SHEET_NAME)) setupExam();

  if (!hasPreviousAttempt_(name, studentClass)) {
    return { allowed: true, retake: false };
  }

  if (hasRetakeGrant_(name, studentClass)) {
    return {
      allowed: true,
      retake: true,
      message: 'Админ дахин шалгалт өгөх эрх нээсэн байна.'
    };
  }

  return {
    allowed: false,
    message: 'Та өмнө нь шалгалт өгсөн байна. Дахин шалгуулах бол багш/админаас эрх нээлгэнэ үү.'
  };
}

/**
 * АДМИНЫ ҮЙЛДЭЛ:
 * Админ нэр, анги, PIN оруулж тухайн сурагчид нэг удаагийн эрх олгоно.
 */
function grantRetake(payload) {
  const pin = String(payload && payload.pin || '').trim();
  const name = String(payload && payload.name || '').trim().replace(/\s+/g, ' ');
  const studentClass = String(payload && payload.studentClass || '').trim();

  if (pin !== CONFIG.ADMIN_PIN) {
    throw new Error('Админы код буруу байна.');
  }

  validateStudent_(name, studentClass);

  if (!hasPreviousAttempt_(name, studentClass)) {
    throw new Error('Энэ сурагчийн өмнөх шалгалтын дүн олдсонгүй.');
  }

  const ss = getSpreadsheet_();
  let sh = ss.getSheetByName(CONFIG.ACCESS_SHEET);
  if (!sh) {
    setupExam();
    sh = ss.getSheetByName(CONFIG.ACCESS_SHEET);
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    // Нээлттэй эрх байгаа бол давхар эрх үүсгэхгүй.
    if (hasRetakeGrant_(name, studentClass)) {
      return 'Энэ сурагчид ашиглаагүй дахин шалгах эрх аль хэдийн байна.';
    }

    sh.appendRow([
      Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss'),
      safeCell_(name),
      studentClass,
      'Үгүй'
    ]);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }

  return 'Дахин шалгалт өгөх нэг удаагийн эрх нээгдлээ.';
}

/** Хариулт шалгаж, нэг удаагийн эрхийг хэрэглээд дүн хадгалах. */
function submitExam(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Шалгалтын мэдээлэл дутуу байна.');
  }

  const name = String(payload.name || '').trim().replace(/\s+/g, ' ');
  const studentClass = String(payload.studentClass || '').trim();
  validateStudent_(name, studentClass);

  const startedAt = Number(payload.startedAt);
  const now = Date.now();

  if (!Number.isFinite(startedAt) || startedAt <= 0 || startedAt > now + 5000) {
    throw new Error('Шалгалтын эхэлсэн цаг буруу байна.');
  }

  const elapsed = Math.floor((now - startedAt) / 1000);
  if (elapsed > CONFIG.DURATION_SECONDS + 120) {
    throw new Error('Шалгалтын хугацаа дууссан байна.');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const ss = getSpreadsheet_();
    let sh = ss.getSheetByName(CONFIG.SHEET_NAME);
    if (!sh || sh.getLastRow() === 0) {
      setupExam();
      sh = ss.getSheetByName(CONFIG.SHEET_NAME);
    }

    const previouslyTaken = hasPreviousAttempt_(name, studentClass);
    let grantRow = -1;

    if (previouslyTaken) {
      const access = ss.getSheetByName(CONFIG.ACCESS_SHEET);
      if (access && access.getLastRow() >= 2) {
        const accessRows = access.getRange(
          2, 1, access.getLastRow() - 1, 4
        ).getValues();

        for (let i = accessRows.length - 1; i >= 0; i--) {
          const r = accessRows[i];
          if (
            normalizeName_(r[1]) === normalizeName_(name) &&
            String(r[2]).trim() === studentClass &&
            String(r[3]).trim() !== 'Тийм'
          ) {
            grantRow = i + 2;
            break;
          }
        }
      }

      if (grantRow < 0) {
        throw new Error('Та өмнө нь шалгалт өгсөн байна. Дахин шалгалт өгөхийн тулд админ эрх нээх шаардлагатай.');
      }
    }

    const answers = payload.answers || {};
    let correct = 0;

    QUESTIONS.forEach(q => {
      const answer = answers[q.id];
      if (answer !== undefined && answer !== null &&
          answer !== '' && Number(answer) === q.answer) {
        correct++;
      }
    });

    const total = QUESTIONS.length;
    const percent = Math.round(correct / total * 100);
    const grade =
      percent >= 90 ? 'A' :
      percent >= 80 ? 'B' :
      percent >= 70 ? 'C' :
      percent >= 60 ? 'D' : 'F';

    sh.appendRow([
      Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss'),
      safeCell_(name),
      studentClass,
      correct,
      total,
      percent,
      grade,
      Math.min(elapsed, CONFIG.DURATION_SECONDS)
    ]);

    // Зөвшөөрлийг зөвхөн амжилттай дүн хадгалсны дараа хэрэглэсэн болгоно.
    if (grantRow > 0) {
      ss.getSheetByName(CONFIG.ACCESS_SHEET).getRange(grantRow, 4).setValue('Тийм');
    }

    SpreadsheetApp.flush();

    try {
      updateExamDashboard_();
    } catch (err) {
      console.error('Dashboard шинэчлэхэд алдаа гарлаа: ' + err.message);
    }

    return {
      ok: true,
      correct,
      total,
      percent,
      grade,
      elapsedSeconds: Math.min(elapsed, CONFIG.DURATION_SECONDS)
    };
  } finally {
    lock.releaseLock();
  }
}

/** Вэб самбарт дүн буцаах. */
function getResults() {
  const sh = getSpreadsheet_().getSheetByName(CONFIG.SHEET_NAME);
  if (!sh || sh.getLastRow() < 2) {
    return { count: 0, average: 0, over80: 0, rows: [] };
  }

  const values = sh.getRange(2, 1, sh.getLastRow() - 1, 8).getValues();
  const rows = values
    .filter(r => r[1] !== '' && r[1] !== null)
    .reverse()
    .map(r => ({
      date: String(r[0]),
      name: String(r[1]),
      studentClass: String(r[2]),
      correct: Number(r[3]),
      total: Number(r[4]),
      percent: Number(r[5]),
      grade: String(r[6])
    }));

  const average = rows.length
    ? Math.round(rows.reduce((s, r) => s + r.percent, 0) / rows.length)
    : 0;

  return {
    count: rows.length,
    average,
    over80: rows.filter(r => r.percent >= 80).length,
    rows: rows.slice(0, 100)
  };
}

/** Google Sheets дотор Dashboard болон график үүсгэх. */
function createExamDashboard() {
  const ss = getSpreadsheet_();
  let dash = ss.getSheetByName(CONFIG.DASHBOARD_NAME);
  if (!dash) dash = ss.insertSheet(CONFIG.DASHBOARD_NAME);
  updateExamDashboard_();
  return 'Dashboard шинэчлэгдлээ.';
}

function updateExamDashboard_() {
  const ss = getSpreadsheet_();
  const results = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!results) throw new Error('ExamResults таб олдсонгүй.');

  let dash = ss.getSheetByName(CONFIG.DASHBOARD_NAME);
  if (!dash) dash = ss.insertSheet(CONFIG.DASHBOARD_NAME);

  // Merge хийхээс өмнө царцаалтыг арилгана.
  dash.setFrozenRows(0);
  dash.setFrozenColumns(0);
  dash.getCharts().forEach(chart => dash.removeChart(chart));
  dash.getRange('A1:O150').breakApart();
  dash.clear();
  dash.setHiddenGridlines(true);

  dash.setColumnWidths(1, 15, 110);
  dash.setColumnWidth(2, 190);
  dash.setColumnWidth(7, 120);
  dash.setColumnWidth(8, 120);
  dash.setRowHeights(1, 3, 34);

  let rows = [];
  if (results.getLastRow() >= 2) {
    rows = results.getRange(2, 1, results.getLastRow() - 1, 8)
      .getValues().filter(r => r[1] !== '' && r[1] !== null);
  }

  const count = rows.length;
  const average = count
    ? Math.round(rows.reduce((s, r) => s + Number(r[5] || 0), 0) / count * 10) / 10
    : 0;
  const over80 = rows.filter(r => Number(r[5]) >= 80).length;
  const highest = count ? Math.max(...rows.map(r => Number(r[5]) || 0)) : 0;

  dash.getRange('A1:O2').merge()
    .setValue('52-Р СУРГУУЛЬ | МХХТ-ИЙН ШАЛГАЛТЫН ДҮН')
    .setBackground('#29458a').setFontColor('#ffffff')
    .setFontSize(17).setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');

  dash.getRange('A3:O3').merge()
    .setValue('HTML · CSS · JavaScript | Сурагчдын амжилтын тайлан')
    .setBackground('#e8edfa').setFontColor('#29458a')
    .setHorizontalAlignment('center');

  const cards = [
    ['A5:C5', 'A6:C7', 'ШАЛГАЛТ ӨГСӨН', count],
    ['D5:F5', 'D6:F7', 'ДУНДАЖ ОНОО (%)', average],
    ['G5:I5', 'G6:I7', '80% БА ТҮҮНЭЭС ДЭЭШ', over80],
    ['J5:L5', 'J6:L7', 'ХАМГИЙН ӨНДӨР ОНОО (%)', highest]
  ];

  cards.forEach(c => {
    dash.getRange(c[0]).merge().setValue(c[2])
      .setBackground('#e8edfa').setFontColor('#29458a')
      .setFontWeight('bold').setHorizontalAlignment('center');
    dash.getRange(c[1]).merge().setValue(c[3])
      .setBackground('#f4f7ff').setFontColor('#29458a')
      .setFontSize(22).setFontWeight('bold')
      .setHorizontalAlignment('center').setVerticalAlignment('middle');
  });

  dash.getRange('A10:E10').setValues([['№', 'Сурагч', 'Анги', 'Зөв', 'Хувь (%)']]);
  const table = rows.map((r, i) => [i + 1, String(r[1]), String(r[2]), Number(r[3]), Number(r[5])]);

  if (table.length) {
    dash.getRange(11, 1, table.length, 5).setValues(table);
    dash.getRange(11, 5, table.length, 1).setNumberFormat('0"%"');
  } else {
    dash.getRange('A11').setValue('Одоогоор дүн алга');
  }

  dash.getRange('A10:E10').setBackground('#dce8fb')
    .setFontColor('#174a8b').setFontWeight('bold');

  const grades = ['A', 'B', 'C', 'D', 'F'];
  dash.getRange('G10:H15').setValues([
    ['Үнэлгээ', 'Сурагчдын тоо'],
    ...grades.map(g => [g, rows.filter(r => String(r[6]) === g).length])
  ]);
  dash.getRange('G10:H10').setBackground('#dce8fb')
    .setFontColor('#174a8b').setFontWeight('bold');

  if (table.length) {
    const scoreChart = dash.newChart()
      .setChartType(Charts.ChartType.BAR)
      .addRange(dash.getRange(10, 2, table.length + 1, 1))
      .addRange(dash.getRange(10, 5, table.length + 1, 1))
      .setPosition(10, 10, 0, 0)
      .setOption('title', 'Сурагчдын шалгалтын оноо')
      .setOption('legend', { position: 'none' })
      .setOption('hAxis', { title: 'Хувь (%)', minValue: 0, maxValue: 100 })
      .build();
    dash.insertChart(scoreChart);
  }

  const gradeChart = dash.newChart()
    .setChartType(Charts.ChartType.BAR)
    .addRange(dash.getRange('G10:H15'))
    .setPosition(25, 1, 0, 0)
    .setOption('title', 'Үнэлгээний тархалт')
    .setOption('legend', { position: 'none' })
    .build();
  dash.insertChart(gradeChart);

  dash.getRange('A1:O40').setVerticalAlignment('middle');
  dash.setFrozenRows(3);
  SpreadsheetApp.flush();
}

function safeCell_(value) {
  return /^[=+\-@]/.test(String(value)) ? "'" + value : value;
}


function doPost(e) {
  try {
    const body = JSON.parse(
      e && e.postData && e.postData.contents ? e.postData.contents : '{}'
    );
    let result;

    switch (body.action) {
      case 'getExamData':
        result = getExamData();
        break;
      case 'checkStudentAccess':
        result = checkStudentAccess(body);
        break;
      case 'submitExam':
        result = submitExam(body);
        break;
      case 'getResults':
        result = getResults();
        break;
      case 'grantRetake':
        result = grantRetake(body);
        break;
      default:
        throw new Error('Үл мэдэгдэх үйлдэл: ' + body.action);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, data: result }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({
        ok: false,
        message: error && error.message ? error.message : 'Алдаа гарлаа.'
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
