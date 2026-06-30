import React from 'react';
import { Link } from 'react-router-dom';
import { platformModules } from '../content/publicSite';
import {
  CtaBanner,
  DetailCard,
  PageHero,
  SectionHeading,
} from '../components/PublicSiteLayout';

const platformChecklist = [
  {
    title: 'Admin command center',
    body: 'Institutes, assessments, live proctoring, violations, and reporting are grouped into a consistent admin workspace.',
  },
  {
    title: 'Candidate journey',
    body: 'Candidates move from sign in to system check to exam launch without needing separate tools or URLs.',
  },
  {
    title: 'Coding evaluations',
    body: 'Monaco-based editing, remote code execution, hidden tests, and draft persistence support technical screening.',
  },
  {
    title: 'Review evidence',
    body: 'Attempt outcomes, coding telemetry, and flagged incidents feed the same post-exam narrative.',
  },
];

const PlatformPage: React.FC = () => {
  return (
    <>
      <PageHero
        eyebrow="Platform overview"
        title="Every critical exam workflow lives in the same product surface."
        description="Instead of stitching together separate portals for login, coding, monitoring, and reporting, AssessPro AI organizes the assessment lifecycle into a single operating system."
        primaryLabel="Talk implementation"
        primaryHref="/contact"
        secondaryLabel="Secure sign in"
        secondaryHref="/auth"
        aside={
          <div className="space-y-4 rounded-[36px] border border-white/70 bg-white/80 p-6 shadow-[0_35px_90px_rgba(16,34,45,0.12)] backdrop-blur">
            {platformChecklist.map((item, index) => (
              <div
                key={item.title}
                className={`rounded-[24px] p-5 ${
                  index === 0 ? 'bg-[#10222d] text-white' : 'border border-[#10222d]/8 bg-[#fffaf5]'
                }`}
              >
                <p className={`text-[11px] font-bold uppercase tracking-[0.28em] ${index === 0 ? 'text-[#d7e1dd]' : 'text-[#8a7863]'}`}>
                  Layer {index + 1}
                </p>
                <h3 className={`mt-3 font-display text-2xl font-semibold ${index === 0 ? 'text-white' : 'text-[#10222d]'}`}>{item.title}</h3>
                <p className={`mt-3 text-sm leading-7 ${index === 0 ? 'text-[#c6d4d9]' : 'text-[#55646c]'}`}>
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        }
      />

      <section className="px-6 py-20 md:px-10">
        <div className="mx-auto max-w-7xl space-y-12">
          <SectionHeading
            eyebrow="Core modules"
            title="Public messaging now matches the actual product depth."
            description="These modules reflect the major areas already present in the application and frame them as a coherent platform story for external visitors."
            align="center"
          />
          <div className="grid gap-6 lg:grid-cols-2">
            {platformModules.map((module) => (
              <DetailCard
                key={module.title}
                icon={module.icon}
                title={module.title}
                description={module.description}
                points={module.points}
                accent={module.accent}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-20 md:px-10">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.85fr)]">
          <div className="space-y-8 rounded-[34px] border border-white/70 bg-white/78 p-8 shadow-[0_30px_80px_rgba(16,34,45,0.08)] backdrop-blur">
            <SectionHeading
              eyebrow="Why it matters"
              title="Teams spend less time reconciling tools and more time managing outcomes."
              description="The landing page and supporting pages now explain how candidate delivery, exam integrity, and technical assessments reinforce each other inside the platform."
            />
            <div className="grid gap-5 md:grid-cols-2">
              {platformChecklist.map((item) => (
                <div key={item.title} className="rounded-[24px] border border-[#10222d]/8 bg-[#f9f4ec] p-5">
                  <h3 className="font-display text-2xl font-semibold text-[#10222d]">{item.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-[#55646c]">{item.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[34px] bg-[#10222d] p-8 text-white shadow-[0_30px_90px_rgba(16,34,45,0.18)]">
            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[#d7e1dd]">Quick route map</p>
            <div className="mt-6 space-y-5">
              {[
                '/ -> public landing experience',
                '/platform -> product overview',
                '/contact -> implementation and demo CTAs',
                '/auth -> secure application entry point',
              ].map((route) => (
                <div key={route} className="rounded-[22px] border border-white/12 bg-white/6 p-4">
                  <p className="text-sm font-semibold leading-7 text-[#d1dde0]">{route}</p>
                </div>
              ))}
            </div>
            <Link
              to="/auth"
              className="mt-8 inline-flex h-12 items-center justify-center rounded-full bg-[#c95b2f] px-6 text-sm font-bold uppercase tracking-[0.16em] text-white transition hover:bg-[#b24c25]"
            >
              Open secure sign in
            </Link>
          </div>
        </div>
      </section>

      <CtaBanner
        title="Need to position the product for institutions and buyers?"
        description="The new platform page gives the app a clearer narrative, so stakeholders can understand what is already built before they ever hit the auth wall."
        primaryLabel="Contact the team"
        primaryHref="/contact"
        secondaryLabel="Open secure sign in"
        secondaryHref="/auth"
      />
    </>
  );
};

export default PlatformPage;
