import http from 'k6/http';
import { check, sleep } from 'k6';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';

const BASE_URL = __ENV.BASE_URL || 'http://127.0.0.1:8000';
const LOAD_TEST_ASSESSMENT_ID = parseInt(__ENV.LOAD_TEST_ASSESSMENT_ID || '1', 10);

function randomRange(min, max) {
  return Math.random() * (max - min) + min;
}

export const options = {
  vus: parseInt(__ENV.VUS || '10', 10),
  duration: '180s',

  thresholds: {
    http_req_failed: ['rate<0.02'],
    http_req_duration: ['avg<2000', 'p(95)<5000'],
  }
};

let token = null;

export default function () {
  const pad = __VU.toString().padStart(3, '0');
  const email = `k6_student_${pad}@example.com`;
  const password = 'password123';

  if (!token) {
    const loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
      email: email,
      password: password,
    }), {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: '01_login' }
    });

    if (!check(loginRes, { 'login status is 200': (r) => r.status === 200 })) {
      console.error(`[VU ${__VU}] Login failed for ${email}: ${loginRes.status} - ${loginRes.body}`);
      sleep(2);
      return;
    }

    token = JSON.parse(loginRes.body).access_token;
    sleep(randomRange(1, 2));
  }

  const detailRes = http.get(`${BASE_URL}/api/assessments/${LOAD_TEST_ASSESSMENT_ID}`, {
    headers: { 'Authorization': `Bearer ${token}` },
    tags: { name: '02_get_assessment_detail' }
  });

  if (!check(detailRes, { 'get assessment status is 200': (r) => r.status === 200 })) {
    return;
  }
  sleep(randomRange(1, 2));

  const startRes = http.post(`${BASE_URL}/api/assessments/${LOAD_TEST_ASSESSMENT_ID}/start`, null, {
    headers: { 'Authorization': `Bearer ${token}` },
    tags: { name: '03_start_assessment' }
  });

  if (!check(startRes, { 'start exam status is 200': (r) => r.status === 200 })) {
    console.error(`[VU ${__VU}] Start exam failed: ${startRes.status} - ${startRes.body}`);
    sleep(2);
    return;
  }

  const startData = JSON.parse(startRes.body);
  const attemptId = startData.attempt.id;
  const examSessionToken = startData.exam_session_token;
  const questions = startData.snapshot_data.questions || [];

  sleep(randomRange(1, 2));

  const checkRes = http.post(`${BASE_URL}/api/proctoring/system-check-passed`, JSON.stringify({
    attempt_id: attemptId,
    exam_session_token: examSessionToken
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    tags: { name: '04_system_check_passed' }
  });
  check(checkRes, { 'system check status is 200': (r) => r.status === 200 });

  sleep(randomRange(2, 4));

  const iterationCount = questions.length > 0 ? Math.min(questions.length, 3) : 2;
  for (let i = 0; i < iterationCount; i++) {
    const question = questions[i] || { id: 1, type: 'mcq' };
    const questionId = question.id;

    const telemetryRes = http.post(`${BASE_URL}/api/code/telemetry/event`, JSON.stringify({
      attempt_id: attemptId,
      question_id: questionId,
      event_type: 'run'
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      tags: { name: '05_log_telemetry' }
    });
    check(telemetryRes, { 'telemetry update status is 200': (r) => r.status === 200 });

    if (question.type === 'coding') {
      const saveRes = http.post(`${BASE_URL}/api/code/save`, JSON.stringify({
        attempt_id: attemptId,
        question_id: questionId,
        language: 'python',
        source_code: `# Draft solution for Q ${questionId}\ndef solution():\n    return True\n`
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        tags: { name: '06_save_code_draft' }
      });
      check(saveRes, { 'save code draft status is 200': (r) => r.status === 200 });
    }

    if (Math.random() < 0.2) {
      const eventRes = http.post(
        `${BASE_URL}/api/proctoring/event?exam_session_token=${examSessionToken}&attempt_id=${attemptId}`,
        JSON.stringify({
          type: 'tab_switch',
          severity: 'medium',
          details: 'Candidate switched browser tab'
        }), {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        tags: { name: '07_log_proctoring_event' }
      }
      );
      check(eventRes, { 'violation log status is 200': (r) => r.status === 200 });
    }

    sleep(randomRange(2, 5));
  }

  const answers = {};
  questions.forEach(q => {
    if (q.type === 'coding') {
      answers[q.id.toString()] = {
        source_code: 'def solution():\n    return True\n',
        language: 'python'
      };
    } else {
      answers[q.id.toString()] = 'a';
    }
  });

  const submitUrl = `${BASE_URL}/api/assessments/${LOAD_TEST_ASSESSMENT_ID}/submit?exam_session_token=${examSessionToken}&attempt_id=${attemptId}`;
  const submitRes = http.post(submitUrl, JSON.stringify({
    answers: answers,
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    tags: { name: '08_submit_assessment' }
  });

  if (!check(submitRes, { 'submit exam status is 200 or 202': (r) => r.status === 200 || r.status === 202 })) {
    console.error(`[VU ${__VU}] Submit exam failed: ${submitRes.status} - ${submitRes.body}`);
    sleep(2);
    return;
  }

  sleep(randomRange(1, 3));

  const feedbackRes = http.post(`${BASE_URL}/api/attempts/${attemptId}/feedback`, JSON.stringify({
    rating: 5,
    comments: 'Awesome online assessment platform!'
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    tags: { name: '09_submit_feedback' }
  });
  check(feedbackRes, { 'submit feedback status is 200': (r) => r.status === 200 });

  sleep(randomRange(2, 5));
}

export function handleSummary(data) {
  console.log('[SUMMARY] Writing load test summary outputs...');
  return {
    'summary.html': htmlReport(data),
    'summary.json': JSON.stringify(data, null, 2),
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
  };
}
