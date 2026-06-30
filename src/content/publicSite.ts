import {
  Activity,
  BadgeCheck,
  BookOpenCheck,
  BrainCircuit,
  Building2,
  ChartNoAxesCombined,
  ClipboardCheck,
  Cpu,
  FileLock2,
  GraduationCap,
  Headset,
  Layers3,
  MessagesSquare,
  SearchCheck,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  UserRoundCheck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
}

export interface StatItem {
  value: string;
  label: string;
  note: string;
}

export interface DetailItem {
  title: string;
  description: string;
  icon: LucideIcon;
  accent: string;
  points: string[];
}

export interface SolutionItem {
  title: string;
  audience: string;
  summary: string;
  outcomes: string[];
  icon: LucideIcon;
}

export interface AssuranceItem {
  stage: string;
  title: string;
  description: string;
}

export interface ContactItem {
  title: string;
  description: string;
  actionLabel: string;
  actionHref: string;
  icon: LucideIcon;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export const navItems: NavItem[] = [
  { label: 'Platform', href: '/platform' },
  { label: 'Contact', href: '/contact' },
];

export const audienceSignals = [
  'Universities',
  'Certification bodies',
  'Hiring teams',
  'Training academies',
  'Enterprise L&D',
];

export const landingStats: StatItem[] = [
  {
    value: '30 sec',
    label: 'draft protection',
    note: 'Auto-save shields candidate progress across coding and quiz flows.',
  },
  {
    value: '4 modes',
    label: 'question coverage',
    note: 'MCQ, multiselect, true-false, and coding live in one assessment engine.',
  },
  {
    value: '1 stream',
    label: 'audit narrative',
    note: 'Telemetry, proctoring flags, and submissions stay connected for review.',
  },
  {
    value: '24/7',
    label: 'operator visibility',
    note: 'Admins can monitor exams, reports, institutes, and violations in one place.',
  },
];

export const capabilityHighlights: DetailItem[] = [
  {
    title: 'Integrity by design',
    description: 'AI-assisted proctoring, event tracking, and exam controls help teams intervene before incidents compound.',
    icon: ShieldCheck,
    accent: 'from-[#176b68] to-[#0f403f]',
    points: [
      'Candidate identity, camera, and system checks before launch',
      'Live proctoring streams with violation review',
      'Actionable audit trail for disputed attempts',
    ],
  },
  {
    title: 'Coding built into assessments',
    description: 'Judge0-backed execution, Monaco editor tooling, and hidden test evaluation bring technical exams into the same workflow.',
    icon: TerminalSquare,
    accent: 'from-[#c95b2f] to-[#8e3f1f]',
    points: [
      'Python, Java, C++, and JavaScript in phase one',
      'Sample runs, hidden tests, scoring, and persisted drafts',
      'Admin-side code review and execution telemetry',
    ],
  },
  {
    title: 'Operator-ready administration',
    description: 'Institutes, assessments, reports, and real-time dashboards reduce the handoffs that usually slow exam operations.',
    icon: Layers3,
    accent: 'from-[#d5a24c] to-[#9a7230]',
    points: [
      'Institute onboarding and deadline controls',
      'Assessment scheduling and candidate assignment',
      'Centralized reports across candidates and attempts',
    ],
  },
  {
    title: 'Candidate experience that stays calm',
    description: 'Clear pre-flight checks, resumable flows, and focused exam screens help reduce noise during high-stakes sessions.',
    icon: UserRoundCheck,
    accent: 'from-[#2a5b8a] to-[#193554]',
    points: [
      'Pre-exam system validation before launch',
      'Resume handling for active attempts',
      'End-of-attempt feedback and reporting hooks',
    ],
  },
];

export const workflowSteps = [
  {
    stage: '01',
    title: 'Configure the assessment',
    description: 'Admins define institutes, windows, question types, coding cases, and evaluation rules from a single control surface.',
  },
  {
    stage: '02',
    title: 'Prepare the candidate',
    description: 'Candidates authenticate, review assignment details, and complete the system check before the exam environment unlocks.',
  },
  {
    stage: '03',
    title: 'Monitor the live sitting',
    description: 'Telemetry, proctoring indicators, and coding run activity flow into the platform while the attempt is active.',
  },
  {
    stage: '04',
    title: 'Review with context',
    description: 'Reports combine score outputs, timeline events, and flagged behavior so reviewers are not reconstructing events manually.',
  },
];

export const platformModules: DetailItem[] = [
  {
    title: 'Assessment orchestration',
    description: 'Create assessment windows, map question types, and keep delivery rules aligned with institute schedules.',
    icon: ClipboardCheck,
    accent: 'from-[#c95b2f] to-[#8e3f1f]',
    points: [
      'Timed exam windows and status handling',
      'Multi-format question support',
      'Candidate-specific assignment views',
    ],
  },
  {
    title: 'Live proctoring console',
    description: 'Track active sessions and surface incidents in real time for high-attention exam events.',
    icon: Activity,
    accent: 'from-[#176b68] to-[#0f403f]',
    points: [
      'Live monitoring workspace',
      'Violation queues and review states',
      'Escalation-ready evidence capture',
    ],
  },
  {
    title: 'Coding sandbox',
    description: 'Deliver technical assessments without executing untrusted code on your app server.',
    icon: Cpu,
    accent: 'from-[#2a5b8a] to-[#193554]',
    points: [
      'Judge0-backed remote execution',
      'Starter code, boilerplates, and language control',
      'Visible sample runs plus hidden-case scoring',
    ],
  },
  {
    title: 'Reporting and analytics',
    description: 'Give faculty, coordinators, and reviewers a tighter feedback loop after the exam closes.',
    icon: ChartNoAxesCombined,
    accent: 'from-[#d5a24c] to-[#9a7230]',
    points: [
      'Attempt reports and candidate drill-downs',
      'Submission telemetry for coding tasks',
      'Operational visibility across cohorts',
    ],
  },
  {
    title: 'Security operations layer',
    description: 'Keep sensitive workflows under guardrails without forcing candidates through a confusing experience.',
    icon: FileLock2,
    accent: 'from-[#3e4855] to-[#1f2937]',
    points: [
      'Token-based auth flows',
      'Role-specific access paths',
      'Session refresh and controlled logout handling',
    ],
  },
];

export const solutionTracks: SolutionItem[] = [
  {
    title: 'Universities and colleges',
    audience: 'Academic operations',
    summary: 'Run entrance exams, internal assessments, and remedial testing with a platform designed for institutional oversight.',
    outcomes: [
      'Manage multiple institutes and exam windows cleanly',
      'Reduce manual coordination between invigilation and reporting teams',
      'Offer candidates a guided pre-check before the exam begins',
    ],
    icon: GraduationCap,
  },
  {
    title: 'Hiring and talent teams',
    audience: 'Recruitment operations',
    summary: 'Blend objective screening with coding evaluation and misconduct review for high-volume technical pipelines.',
    outcomes: [
      'Keep coding and objective rounds in one attempt flow',
      'Review suspicious behavior with linked evidence',
      'Export decision-ready reports for recruiters and interviewers',
    ],
    icon: SearchCheck,
  },
  {
    title: 'Certification programs',
    audience: 'Credential integrity',
    summary: 'Support high-trust credentialing programs where exam legitimacy matters as much as the score itself.',
    outcomes: [
      'Standardize identity and environment checks',
      'Maintain an audit trail around violations and completions',
      'Scale repeatable exam sessions across multiple cohorts',
    ],
    icon: BadgeCheck,
  },
];

export const securityPillars: DetailItem[] = [
  {
    title: 'Controlled execution boundaries',
    description: 'The coding workflow keeps execution outside the FastAPI server while preserving evaluation fidelity.',
    icon: BrainCircuit,
    accent: 'from-[#176b68] to-[#0f403f]',
    points: [
      'Judge0 handles untrusted runtime execution',
      'Frontend never receives secret execution credentials',
      'Hidden tests stay reserved for submit-time scoring',
    ],
  },
  {
    title: 'Role-aware application surfaces',
    description: 'Admins and candidates operate in dedicated experiences shaped by their permissions and responsibilities.',
    icon: Building2,
    accent: 'from-[#c95b2f] to-[#8e3f1f]',
    points: [
      'Protected routes gate admin and candidate areas',
      'Session refresh keeps authorized work alive when possible',
      'Expired sessions return users to a secure sign-in path',
    ],
  },
  {
    title: 'Evidence-rich monitoring',
    description: 'Operational teams get more than a raw score; they get context about how the attempt unfolded.',
    icon: Sparkles,
    accent: 'from-[#d5a24c] to-[#9a7230]',
    points: [
      'Violation logging and review-ready signals',
      'Coding telemetry including run count and error patterns',
      'Connected reports across attempts and candidates',
    ],
  },
  {
    title: 'Candidate trust and clarity',
    description: 'Security is visible, but the experience stays understandable for candidates under pressure.',
    icon: BookOpenCheck,
    accent: 'from-[#2a5b8a] to-[#193554]',
    points: [
      'System checks communicate readiness before launch',
      'Draft persistence protects work against interruptions',
      'Feedback loops close the experience after submission',
    ],
  },
];

export const assuranceTimeline: AssuranceItem[] = [
  {
    stage: 'Before exam',
    title: 'Identity and environment readiness',
    description: 'Authentication, institute assignment, and system checks establish whether the candidate can begin safely.',
  },
  {
    stage: 'During exam',
    title: 'Observation without platform sprawl',
    description: 'Monitoring, telemetry, and coding execution stay connected instead of scattering across separate systems.',
  },
  {
    stage: 'After exam',
    title: 'Review backed by evidence',
    description: 'Scores, outputs, and flagged events remain linked so reviewers can defend decisions with context.',
  },
];

export const contactOptions: ContactItem[] = [
  {
    title: 'Book a product walkthrough',
    description: 'Ideal for teams evaluating the full assessment, proctoring, and coding workflow together.',
    actionLabel: 'Request a walkthrough',
    actionHref: 'mailto:hello@assesspro.ai?subject=AssessPro%20Walkthrough',
    icon: MessagesSquare,
  },
  {
    title: 'Plan an implementation',
    description: 'Work through institute setup, assessment migration, and operational rollout with implementation guidance.',
    actionLabel: 'Talk implementation',
    actionHref: 'mailto:implementation@assesspro.ai?subject=AssessPro%20Implementation',
    icon: Headset,
  },
  {
    title: 'Access the secure app',
    description: 'Existing admins and candidates can jump directly to the protected login experience.',
    actionLabel: 'Open secure sign in',
    actionHref: '/auth',
    icon: ShieldCheck,
  },
];

export const faqs: FaqItem[] = [
  {
    question: 'Can the platform handle both objective and coding assessments?',
    answer: 'Yes. The current product story supports objective formats alongside coding questions with remote execution and hidden-case scoring.',
  },
  {
    question: 'How does the platform reduce dispute resolution time?',
    answer: 'Reports are connected to attempt status, telemetry, and violation records so reviewers do not have to stitch together separate tools.',
  },
  {
    question: 'What happens if a candidate session expires or gets interrupted?',
    answer: 'Draft persistence, resumable attempt logic, and controlled sign-in recovery help candidates return without starting from zero.',
  },
  {
    question: 'Who is the platform built for?',
    answer: 'The public positioning fits institutions, certification teams, and hiring organizations that need both exam delivery and integrity controls.',
  },
];
