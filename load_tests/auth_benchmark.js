import http from 'k6/http';
import { check, sleep } from 'k6';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';

const BASE_URL = __ENV.BASE_URL || 'http://127.0.0.1:8000';

export const options = {
  vus: parseInt(__ENV.VUS || '10', 10),
  duration: '30s',

  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['avg<1000', 'p(95)<2500'],
  }
};

export default function () {
  const pad = __VU.toString().padStart(3, '0');
  const email = `k6_student_${pad}@example.com`;
  const password = 'password123';

  const loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    email: email,
    password: password,
  }), {
    headers: { 'Content-Type': 'application/json' },
    tags: { name: 'auth_login' }
  });

  check(loginRes, { 'login status is 200': (r) => r.status === 200 });
  sleep(1);
}

export function handleSummary(data) {
  console.log('[SUMMARY] Writing auth benchmark summary outputs...');
  return {
    'summary.html': htmlReport(data),
    'summary.json': JSON.stringify(data, null, 2),
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
  };
}
