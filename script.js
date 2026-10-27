
/*
 * 52-р сургуулийн МХХТ-ийн шалгалтын систем
 * Frontend: Vercel
 * Backend: Google Apps Script
 * Database: Google Sheets
 *
 * Файл: script.js
 * API endpoint: /api/exam
 */

'use strict';

const $ = id => document.getElementById(id);

const EXAM_DURATION = 40 * 60;

let examData = null;
let student = null;
let startedAt = 0;
let timerInterval = null;
let submitting = false;
let scoreChart = null;
let gradeChart = null;

/* ==========================================
   1. Хуудас ачаалахад ажиллах
========================================== */

document.addEventListener('DOMContentLoaded', async () => {
  bindEvents();

  try {
    showMessage('loginMessage', 'Шалгалтын асуулт ачаалж байна...');

    const response = await api('getExamData');

    console.log('getExamData хариу:', response);

    // API өгөгдлийг data дотор давхар буцаасан эсэхийг шалгана.
    const receivedData = response?.data ?? response;

    if (
      !receivedData ||
      !Array.isArray(receivedData.questions) ||
      receivedData.questions.length === 0
    ) {
      throw new Error(
        'Асуултын жагсаалт хоосон байна. ' +
        'Code.gs доторх getExamData() функцийг шалгана уу.'
      );
    }

    examData = receivedData;

    showMessage(
      'loginMessage',
      `${examData.questions.length} асуулт амжилттай ачааллаа.`
    );

    console.log('Ачаалсан асуултын тоо:', examData.questions.length);

  } catch (error) {
    console.error('Асуулт ачаалах алдаа:', error);

    showMessage(
      'loginMessage',
      `Асуулт ачаалж чадсангүй: ${error.message}`,
      true
    );
  }

  await loadResults();
});

/* ==========================================
   2. Товчнуудтай холбох
========================================== */

function bindEvents() {
  $('startBtn')?.addEventListener('click', startExam);

  $('examForm')?.addEventListener('submit', event => {
    event.preventDefault();
    finishExam(false);
  });

  $('backBtn')?.addEventListener('click', resetToLogin);
  $('refreshBtn')?.addEventListener('click', loadResults);
  $('grantBtn')?.addEventListener('click', grantRetake);
}

/* ==========================================
   3. Vercel API холболт
========================================== */

async function api(action, payload = {}) {
  const response = await fetch('/api/exam', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      action,
      ...payload
    })
  });

  let result;

  try {
    result = await response.json();
  } catch {
    throw new Error(
      `Сервер JSON хариу буцаасангүй. HTTP ${response.status}`
    );
  }

  if (!response.ok || result?.ok === false) {
    throw new Error(
      result?.message ||
      `API хүсэлт амжилтгүй. HTTP ${response.status}`
    );
  }

  /*
   * Code.gs-ийн doPost(e) амжилттай үед:
   * { ok: true, data: ... }
   *
   * Зарим API шууд өгөгдөл буцааж болох тул
   * хоёр хэлбэрийг хоёуланг нь дэмжинэ.
   */
  return Object.prototype.hasOwnProperty.call(result, 'data')
    ? result.data
    : result;
}

/* ==========================================
   4. Мэдэгдэл харуулах
========================================== */

function showMessage(id, message, isError = false) {
  const element = $(id);

  if (!element) {
    console.warn(`HTML элемент олдсонгүй: ${id}`);
    return;
  }

  element.textContent = message;
  element.classList.toggle('error-text', isError);
}

/* ==========================================
   5. Сурагчийн нэвтрэлт, шалгалт эхлүүлэх
========================================== */

async function startExam() {
  if (submitting) return;

  const name = $('studentName')?.value
    .trim()
    .replace(/\s+/g, ' ') || '';

  const studentClass = $('studentClass')?.value || '';

  if (name.length < 2) {
    showMessage(
      'loginMessage',
      'Овог, нэрээ зөв оруулна уу.',
      true
    );
    return;
  }

  if (!studentClass) {
    showMessage(
      'loginMessage',
      'Ангиа сонгоно уу.',
      true
    );
    return;
  }

  if (
    !examData ||
    !Array.isArray(examData.questions) ||
    examData.questions.length === 0
  ) {
    showMessage(
      'loginMessage',
      'Асуултууд ачаалагдаагүй байна. ' +
      'Хуудас шинэчилж, серверийн холболтоо шалгана уу.',
      true
    );
    return;
  }

  const startBtn = $('startBtn');

  if (startBtn) startBtn.disabled = true;

  showMessage('loginMessage', 'Шалгалтын эрх шалгаж байна...');

  try {
    const access = await api('checkStudentAccess', {
      name,
      studentClass
    });

    if (!access || access.allowed !== true) {
      showMessage(
        'loginMessage',
        access?.message ||
          'Шалгалт өгөх эрхгүй байна. Админтай холбогдоно уу.',
        true
      );
      return;
    }

    student = {
      name,
      studentClass
    };

    startedAt = Date.now();
    submitting = false;

    if ($('studentLabel')) {
      $('studentLabel').textContent =
        `${name} · ${studentClass}`;
    }

    renderQuestions();

    $('loginPanel')?.classList.add('hidden');
    $('resultPanel')?.classList.add('hidden');
    $('examPanel')?.classList.remove('hidden');

    startTimer();
    updateProgress();

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });

  } catch (error) {
    console.error('Нэвтрэх алдаа:', error);

    showMessage(
      'loginMessage',
      error.message || 'Шалгалт эхлүүлэхэд алдаа гарлаа.',
      true
    );
  } finally {
    if (startBtn) startBtn.disabled = false;
  }
}

/* ==========================================
   6. Асуултуудыг дэлгэцэнд гаргах
========================================== */

function renderQuestions() {
  const questionList = $('questionList');

  if (!questionList) {
    throw new Error(
      'index.html дотор id="questionList" элемент алга.'
    );
  }

  questionList.innerHTML = examData.questions.map(
    (question, index) => {
      const questionId = String(question.id ?? index + 1);
      const questionText = escapeHtml(question.q ?? '');

      const options = Array.isArray(question.options)
        ? question.options
        : [];

      return `
        <article class="question">
          <h3>${index + 1}. ${questionText}</h3>

          <div class="options">
            ${options.map((option, optionIndex) => `
              <label class="option">
                <input
                  type="radio"
                  name="q${escapeHtml(questionId)}"
                  value="${optionIndex}"
                >

                <span>
                  <b>${String.fromCharCode(65 + optionIndex)}.</b>
                  ${escapeHtml(option)}
                </span>
              </label>
            `).join('')}
          </div>
        </article>
      `;
    }
  ).join('');

  questionList.onchange = updateProgress;
}

/* ==========================================
   7. Хариултын явц
========================================== */

function updateProgress() {
  if (!examData) return;

  const questions = examData.questions;

  const answered = questions.filter(question => {
    const id = String(question.id);

    return document.querySelector(
      `input[name="${CSS.escape(`q${id}`)}"]:checked`
    );
  }).length;

  if ($('progressText')) {
    $('progressText').textContent =
      `${answered} / ${questions.length} асуулт хариулсан`;
  }

  if ($('progressBar')) {
    const percentage = questions.length
      ? answered / questions.length * 100
      : 0;

    $('progressBar').style.width = `${percentage}%`;
  }
}

/* ==========================================
   8. 40 минутын таймер
========================================== */

function startTimer() {
  clearInterval(timerInterval);

  const deadline = startedAt + EXAM_DURATION * 1000;

  function tick() {
    const secondsLeft = Math.max(
      0,
      Math.ceil((deadline - Date.now()) / 1000)
    );

    const minutes = String(
      Math.floor(secondsLeft / 60)
    ).padStart(2, '0');

    const seconds = String(
      secondsLeft % 60
    ).padStart(2, '0');

    if ($('timer')) {
      $('timer').textContent = `${minutes}:${seconds}`;
    }

    if (secondsLeft <= 0) {
      clearInterval(timerInterval);
      finishExam(true);
    }
  }

  tick();
  timerInterval = setInterval(tick, 1000);
}

/* ==========================================
   9. Шалгалт дуусгаж, дүн илгээх
========================================== */

async function finishExam(timeExpired = false) {
  if (submitting || !student || !examData) return;

  if (!timeExpired) {
    const confirmed = confirm(
      'Шалгалтаа дуусгаж, хариултаа илгээх үү?'
    );

    if (!confirmed) return;
  }

  submitting = true;
  clearInterval(timerInterval);

  const answers = {};

  examData.questions.forEach((question, index) => {
    const questionId = String(question.id ?? index + 1);

    const selected = document.querySelector(
      `input[name="${CSS.escape(`q${questionId}`)}"]:checked`
    );

    if (selected) {
      answers[questionId] = Number(selected.value);
    }
  });

  $('examPanel')?.classList.add('hidden');
  $('resultPanel')?.classList.remove('hidden');

  if ($('resultTitle')) {
    $('resultTitle').textContent = timeExpired
      ? 'Шалгалтын хугацаа дууслаа'
      : 'Шалгалт дууслаа';
  }

  showMessage(
    'saveMessage',
    'Хариултыг шалгаж, дүнг хадгалж байна...'
  );

  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });

  try {
    const result = await api('submitExam', {
      name: student.name,
      studentClass: student.studentClass,
      startedAt,
      answers
    });

    if (!result || typeof result !== 'object') {
      throw new Error('Серверээс дүнгийн мэдээлэл ирсэнгүй.');
    }

    if ($('scorePercent')) {
      $('scorePercent').textContent =
        `${Number(result.percent) || 0}%`;
    }

    if ($('correctCount')) {
      const correct = Number(result.correct) || 0;
      const total = Number(result.total) || examData.questions.length;

      $('correctCount').textContent = `${correct}/${total}`;
    }

    if ($('grade')) {
      $('grade').textContent = result.grade || '-';
    }

    showMessage(
      'saveMessage',
      'Дүн хадгалах хүсэлт амжилттай дууслаа.'
    );

    await loadResults();

  } catch (error) {
    console.error('Дүн хадгалах алдаа:', error);

    showMessage(
      'saveMessage',
      `Дүн хадгалахад алдаа гарлаа: ${error.message}`,
      true
    );
  } finally {
    submitting = false;
  }
}

/* ==========================================
   10. Google Sheets-ийн дүнг ачаалах
========================================== */

async function loadResults() {
  if (!$('dashboardMessage')) return;

  showMessage('dashboardMessage', 'Дүн ачаалж байна...');

  try {
    const response = await api('getResults');
    const data = response?.data ?? response;

    const rows = Array.isArray(data?.rows)
      ? data.rows
      : [];

    if ($('totalStudents')) {
      $('totalStudents').textContent =
        data?.count ?? rows.length;
    }

    if ($('averageScore')) {
      $('averageScore').textContent =
        `${Number(data?.average) || 0}%`;
    }

    if ($('over80')) {
      $('over80').textContent =
        data?.over80 ??
        rows.filter(row => Number(row.percent) >= 80).length;
    }

    if ($('resultsBody')) {
      $('resultsBody').innerHTML = rows.map(row => `
        <tr>
          <td>${escapeHtml(row.date)}</td>
          <td>${escapeHtml(row.name)}</td>
          <td>${escapeHtml(row.studentClass)}</td>
          <td>${Number(row.correct) || 0}/${Number(row.total) || 0}</td>
          <td>${Number(row.percent) || 0}%</td>
          <td>${escapeHtml(row.grade)}</td>
        </tr>
      `).join('');
    }

    showMessage(
      'dashboardMessage',
      rows.length
        ? 'Шалгалтын дүн шинэчлэгдлээ.'
        : 'Одоогоор шалгалтын дүн бүртгэгдээгүй байна.'
    );

    drawCharts(rows);

  } catch (error) {
    console.error('Дүн ачаалах алдаа:', error);

    showMessage(
      'dashboardMessage',
      `Дүн ачаалж чадсангүй: ${error.message}`,
      true
    );
  }
}

/* ==========================================
   11. Графикууд
========================================== */

function drawCharts(rows) {
  if (typeof Chart === 'undefined') {
    console.warn('Chart.js ачаалагдаагүй байна.');
    return;
  }

  const scoreCanvas = $('scoreChart');
  const gradeCanvas = $('gradeChart');

  if (!scoreCanvas || !gradeCanvas) return;

  if (scoreChart) {
    scoreChart.destroy();
    scoreChart = null;
  }

  if (gradeChart) {
    gradeChart.destroy();
    gradeChart = null;
  }

  const chartRows = rows.slice().reverse();

  scoreChart = new Chart(scoreCanvas, {
    type: 'bar',
    data: {
      labels: chartRows.map(row => row.name || 'Сурагч'),
      datasets: [{
        label: 'Оноо (%)',
        data: chartRows.map(
          row => Number(row.percent) || 0
        ),
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          max: 100
        }
      }
    }
  });

  const grades = ['A', 'B', 'C', 'D', 'F'];

  gradeChart = new Chart(gradeCanvas, {
    type: 'doughnut',
    data: {
      labels: grades,
      datasets: [{
        label: 'Үнэлгээний тоо',
        data: grades.map(grade =>
          rows.filter(row => row.grade === grade).length
        )
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false
    }
  });
}

/* ==========================================
   12. Админ дахин шалгалтын эрх нээх
========================================== */

async function grantRetake() {
  const name = $('adminName')?.value
    .trim()
    .replace(/\s+/g, ' ') || '';

  const studentClass = $('adminClass')?.value || '';
  const pin = $('adminPin')?.value.trim() || '';

  if (!name || !studentClass || !/^\d{4}$/.test(pin)) {
    showMessage(
      'adminMessage',
      'Нэр, анги болон 4 оронтой PIN кодоо зөв оруулна уу.',
      true
    );
    return;
  }

  const grantBtn = $('grantBtn');

  if (grantBtn) grantBtn.disabled = true;

  showMessage('adminMessage', 'Дахин шалгалтын эрх нээж байна...');

  try {
    const result = await api('grantRetake', {
      name,
      studentClass,
      pin
    });

    const message =
      typeof result === 'string'
        ? result
        : result?.message || 'Дахин шалгалтын эрхийн хүсэлт амжилттай дууслаа.';

    showMessage('adminMessage', message);

    if ($('adminPin')) {
      $('adminPin').value = '';
    }

  } catch (error) {
    console.error('Дахин шалгалтын эрх нээх алдаа:', error);

    showMessage(
      'adminMessage',
      error.message || 'Дахин шалгалтын эрх нээж чадсангүй.',
      true
    );
  } finally {
    if (grantBtn) grantBtn.disabled = false;
  }
}

/* ==========================================
   13. Нэвтрэх дэлгэц рүү буцах
========================================== */

function resetToLogin() {
  clearInterval(timerInterval);

  student = null;
  startedAt = 0;
  submitting = false;

  $('examPanel')?.classList.add('hidden');
  $('resultPanel')?.classList.add('hidden');
  $('loginPanel')?.classList.remove('hidden');

  if ($('studentName')) $('studentName').value = '';
  if ($('studentClass')) $('studentClass').value = '';
  if ($('questionList')) $('questionList').innerHTML = '';
  if ($('timer')) $('timer').textContent = '40:00';

  if ($('progressText')) {
    $('progressText').textContent =
      `0 / ${examData?.questions?.length || 10} асуулт хариулсан`;
  }

  if ($('progressBar')) {
    $('progressBar').style.width = '0%';
  }

  showMessage('loginMessage', '');

  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
}

/* ==========================================
   14. HTML аюулгүй текст хувиргах
========================================== */

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}
