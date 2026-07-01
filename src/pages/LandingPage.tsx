import React from 'react';
import { Link } from 'react-router-dom';
import {
  audienceSignals,
  capabilityHighlights,
  landingStats,
  workflowSteps,
} from '../content/publicSite';
import {
  CtaBanner,
  DetailCard,
  PageHero,
  SectionHeading,
} from '../components/PublicSiteLayout';

import Footer from "../components/Footer";

const LandingPage: React.FC = () => {
  return (
    <>
      <PageHero
        eyebrow="Assessment platform"
        title="Assessment operations for teams that need trust, speed, and proof."
        description="Levroxen LLC unifies secure exam delivery, live proctoring, coding evaluation, and review-ready reporting so institutions can run high-stakes assessments with less friction."
        primaryLabel="Explore the platform"
        primaryHref="/platform"
        secondaryLabel="Secure sign in"
        secondaryHref="/auth"
        aside={
          <div className="relative overflow-hidden rounded-[36px] border border-white/70 bg-white/80 p-6 shadow-[0_35px_90px_rgba(16,34,45,0.12)] backdrop-blur">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(201,91,47,0.15),_transparent_35%),radial-gradient(circle_at_bottom_left,_rgba(23,107,104,0.14),_transparent_42%)]" />
            <div className="relative space-y-5">
              <div className="rounded-[28px] bg-[#10222d] p-5 text-white">
                <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#d5e1de]">Mission control</p>
                <h3 className="mt-3 font-display text-3xl font-semibold text-white">One operating layer for the full exam lifecycle.</h3>
                <p className="mt-3 text-sm leading-7 text-[#c7d5da]">
                  From candidate readiness to flagged-event review, each step stays connected.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {landingStats.slice(0, 2).map((item) => (
                  <div key={item.label} className="rounded-[24px] border border-[#10222d]/8 bg-[#fffaf5] p-4">
                    <p className="font-display text-3xl font-semibold text-[#10222d]">{item.value}</p>
                    <p className="mt-2 text-xs font-bold uppercase tracking-[0.22em] text-[#8a7863]">{item.label}</p>
                    <p className="mt-3 text-sm leading-6 text-[#55646c]">{item.note}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-[28px] border border-[#10222d]/8 bg-white p-5">
                <div className="flex flex-wrap gap-2">
                  {audienceSignals.map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-[#10222d]/10 bg-[#f4efe6] px-3 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#4f5f68]"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        }
      />

      <section className="px-6 py-8 md:px-10">
        <div className="mx-auto max-w-7xl rounded-[32px] border border-white/70 bg-white/70 px-6 py-5 shadow-[0_25px_70px_rgba(16,34,45,0.06)] backdrop-blur">
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-center">
            {audienceSignals.map((signal) => (
              <span
                key={signal}
                className="text-xs font-bold uppercase tracking-[0.32em] text-[#7b6b58]"
              >
                {signal}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-20 md:px-10">
        <div className="mx-auto max-w-7xl space-y-12">
          <SectionHeading
            eyebrow="What ships"
            title="A complete public story around the product, not just a login screen."
            description="The platform pages highlight the workflows already present in the application today: candidate delivery, institute administration, coding execution, live proctoring, and post-exam reporting."
            align="center"
          />
          <div className="grid gap-6 lg:grid-cols-2">
            {capabilityHighlights.map((feature) => (
              <DetailCard
                key={feature.title}
                icon={feature.icon}
                title={feature.title}
                description={feature.description}
                points={feature.points}
                accent={feature.accent}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-20 md:px-10">
        <div className="mx-auto max-w-7xl space-y-12">
          <SectionHeading
            eyebrow="Flow of work"
            title="From setup to review, the exam lifecycle stays legible."
            description="Each phase is designed to keep operators oriented and candidates supported, even when the assessment includes live monitoring or coding tasks."
          />
          <div className="grid gap-5 lg:grid-cols-4">
            {workflowSteps.map((step) => (
              <article
                key={step.stage}
                className="rounded-[28px] border border-white/70 bg-white/75 p-6 shadow-[0_20px_65px_rgba(16,34,45,0.06)] backdrop-blur"
              >
                <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#c95b2f]">{step.stage}</p>
                <h3 className="mt-4 font-display text-2xl font-semibold text-[#10222d]">{step.title}</h3>
                <p className="mt-4 text-sm leading-7 text-[#55646c]">{step.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-20 md:px-10">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-4">
          {landingStats.map((stat) => (
            <article
              key={stat.label}
              className="rounded-[30px] border border-[#10222d]/8 bg-[#10222d] p-6 text-white shadow-[0_25px_70px_rgba(16,34,45,0.12)]"
            >
              <p className="font-display text-4xl font-semibold">{stat.value}</p>
              <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.26em] text-[#d7e1dd]">{stat.label}</p>
              <p className="mt-4 text-sm leading-7 text-[#c5d3d8]">{stat.note}</p>
            </article>
          ))}
        </div>
      </section>

      <CtaBanner
        title="Need a stronger front door for the assessment product?"
        description="The new public site now introduces the product properly, routes users to secure sign-in, and gives buyers or stakeholders a clear place to understand the platform."
        primaryLabel="Review contact options"
        primaryHref="/contact"
        secondaryLabel="Open secure sign in"
        secondaryHref="/auth"
      />
      <Footer/>
    </>
  );
};

export default LandingPage;
