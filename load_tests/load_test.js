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
  duration: '90s',

  thresholds: {
    http_req_failed: ['rate<0.01'],
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
      tags: { name: 'login' }
    });

    if (!check(loginRes, { 'login status is 200': (r) => r.status === 200 })) {
      console.error(`[VU ${__VU}] Login failed for ${email}: ${loginRes.status} - ${loginRes.body}`);
      sleep(2);
      return;
    }

    token = JSON.parse(loginRes.body).access_token;
    sleep(randomRange(1, 3));
  }

  const detailRes = http.get(`${BASE_URL}/api/assessments/${LOAD_TEST_ASSESSMENT_ID}`, {
    headers: { 'Authorization': `Bearer ${token}` },
    tags: { name: 'get_assessment_detail' }
  });
  //check(detailRes, { 'open assessment status is 200': (r) => r.status === 200 });
  if (!check(detailRes, {
    'open assessment status is 200': (r) => r.status === 200
  })) {
    return;
  }
  sleep(randomRange(1, 3));

  const startRes = http.post(`${BASE_URL}/api/assessments/${LOAD_TEST_ASSESSMENT_ID}/start`, null, {
    headers: { 'Authorization': `Bearer ${token}` },
    tags: { name: 'start_assessment' }
  });

  if (!check(startRes, { 'start exam status is 200': (r) => r.status === 200 })) {
    console.error(`[VU ${__VU}] Start exam failed for ${email}: ${startRes.status} - ${startRes.body}`);
    sleep(2);
    return;
  }

  const startData = JSON.parse(startRes.body);
  const attemptId = startData.attempt.id;
  const examSessionToken = startData.exam_session_token;
  const questions = startData.snapshot_data.questions || [];

  sleep(randomRange(1, 3));

  const answers = {};
  questions.forEach(q => {
    answers[q.id.toString()] = 'a';
  });

  const submitUrl = `${BASE_URL}/api/assessments/${LOAD_TEST_ASSESSMENT_ID}/submit?exam_session_token=${examSessionToken}&attempt_id=${attemptId}`;
  const submitRes = http.post(submitUrl, JSON.stringify({
    answers: answers,
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    tags: { name: 'submit_assessment' }
  });
  if (!check(submitRes, {
    'submit exam status is 200': (r) => r.status === 200
  })) {
    return;
  }
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
