import React, { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { ArrowRight, Menu, ShieldCheck, X } from 'lucide-react';
import { navItems } from '../content/publicSite';

interface SectionHeadingProps {
  eyebrow: string;
  title: string;
  description: string;
  align?: 'left' | 'center';
}

interface PageHeroProps {
  eyebrow: string;
  title: string;
  description: string;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel: string;
  secondaryHref: string;
  aside?: React.ReactNode;
}

interface DetailCardProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  points?: string[];
  accent?: string;
}

interface CtaBannerProps {
  title: string;
  description: string;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel?: string;
  secondaryHref?: string;
}

export const SectionHeading: React.FC<SectionHeadingProps> = ({
  eyebrow,
  title,
  description,
  align = 'left',
}) => {
  const alignment = align === 'center' ? 'items-center text-center mx-auto' : 'items-start text-left';

  return (
    <div className={`flex max-w-3xl flex-col gap-4 ${alignment}`}>
      <span className="inline-flex items-center rounded-full border border-[#c95b2f]/20 bg-[#fff6ee] px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.28em] text-[#9a4b2c]">
        {eyebrow}
      </span>
      <h2 className="font-display text-3xl font-semibold leading-tight text-[#10222d] md:text-5xl">
        {title}
      </h2>
      <p className="max-w-2xl text-base leading-7 text-[#4f5f68] md:text-lg">
        {description}
      </p>
    </div>
  );
};

export const PageHero: React.FC<PageHeroProps> = ({
  eyebrow,
  title,
  description,
  primaryLabel,
  primaryHref,
  secondaryLabel,
  secondaryHref,
  aside,
}) => {
  return (
    <section className="relative overflow-hidden px-6 pb-18 pt-10 md:px-10 md:pb-24 md:pt-14">
      <div className="absolute inset-x-0 top-0 h-full bg-[radial-gradient(circle_at_top_left,_rgba(201,91,47,0.18),_transparent_42%),radial-gradient(circle_at_85%_20%,_rgba(23,107,104,0.18),_transparent_32%),linear-gradient(180deg,_#f7f1e8_0%,_#f4efe6_60%,_rgba(244,239,230,0)_100%)]" />
      <div className="absolute inset-x-0 top-0 -z-10 h-full bg-[linear-gradient(135deg,_rgba(255,255,255,0.5)_0%,_rgba(255,255,255,0)_55%)]" />

      <div className="relative mx-auto grid max-w-7xl gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)] lg:items-center">
        <div className="animate-fade-rise space-y-8">
          <span className="inline-flex items-center rounded-full border border-[#c95b2f]/20 bg-[#fff6ee] px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.28em] text-[#9a4b2c]">
            {eyebrow}
          </span>
          <div className="space-y-6">
            <h1 className="max-w-4xl font-display text-5xl font-semibold leading-[0.94] text-[#10222d] md:text-7xl">
              {title}
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-[#4f5f68] md:text-xl">
              {description}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              to={primaryHref}
              className="inline-flex h-13 items-center justify-center gap-2 rounded-full bg-[#10222d] px-7 text-sm font-bold uppercase tracking-[0.18em] text-white transition duration-300 hover:-translate-y-0.5 hover:bg-[#0d1a23]"
            >
              {primaryLabel}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to={secondaryHref}
              className="inline-flex h-13 items-center justify-center rounded-full border border-[#10222d]/12 bg-white/70 px-7 text-sm font-bold uppercase tracking-[0.18em] text-[#10222d] backdrop-blur transition duration-300 hover:-translate-y-0.5 hover:border-[#10222d]/25 hover:bg-white"
            >
              {secondaryLabel}
            </Link>
          </div>
        </div>

        {aside ? <div className="animate-float-slow lg:justify-self-end">{aside}</div> : null}
      </div>
    </section>
  );
};

export const DetailCard: React.FC<DetailCardProps> = ({
  icon: Icon,
  title,
  description,
  points = [],
  accent = 'from-[#10222d] to-[#274252]',
}) => {
  return (
    <article className="group rounded-[32px] border border-white/70 bg-white/80 p-7 shadow-[0_30px_80px_rgba(16,34,45,0.08)] backdrop-blur transition duration-300 hover:-translate-y-1 hover:shadow-[0_30px_90px_rgba(16,34,45,0.12)]">
      <div className={`mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${accent} text-white shadow-lg`}>
        <Icon className="h-6 w-6" />
      </div>
      <div className="space-y-4">
        <h3 className="font-display text-2xl font-semibold text-[#10222d]">
          {title}
        </h3>
        <p className="text-sm leading-7 text-[#55646c]">
          {description}
        </p>
      </div>
      {points.length > 0 ? (
        <ul className="mt-6 space-y-3">
          {points.map((point) => (
            <li key={point} className="flex items-start gap-3 text-sm leading-6 text-[#31424b]">
              <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#c95b2f]" />
              <span>{point}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
};

export const CtaBanner: React.FC<CtaBannerProps> = ({
  title,
  description,
  primaryLabel,
  primaryHref,
  secondaryLabel,
  secondaryHref,
}) => {
  return (
    <section className="px-6 pb-20 md:px-10">
      <div className="mx-auto max-w-7xl overflow-hidden rounded-[36px] bg-[#10222d] px-8 py-10 text-white shadow-[0_35px_100px_rgba(16,34,45,0.22)] md:px-12 md:py-14">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="space-y-4">
            <span className="inline-flex rounded-full border border-white/12 bg-white/8 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.28em] text-[#d8e6e2]">
              Ready to launch
            </span>
            <h2 className="max-w-2xl font-display text-3xl font-semibold leading-tight md:text-5xl text-white">
              {title}
            </h2>
            <p className="max-w-2xl text-base leading-7 text-[#c8d5d9] md:text-lg">
              {description}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
            <Link
              to={primaryHref}
              className="inline-flex h-13 items-center justify-center gap-2 rounded-full bg-[#c95b2f] px-7 text-sm font-bold uppercase tracking-[0.18em] text-white transition duration-300 hover:-translate-y-0.5 hover:bg-[#b24c25]"
            >
              {primaryLabel}
              <ArrowRight className="h-4 w-4" />
            </Link>
            {secondaryLabel && secondaryHref ? (
              <Link
                to={secondaryHref}
                className="inline-flex h-13 items-center justify-center rounded-full border border-white/16 bg-white/5 px-7 text-sm font-bold uppercase tracking-[0.18em] text-white transition duration-300 hover:-translate-y-0.5 hover:bg-white/10"
              >
                {secondaryLabel}
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
};

export const PublicSiteLayout: React.FC = () => {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-[#f4efe6] text-[#10222d]">
      <div className="fixed inset-0 -z-10 opacity-70">
        <div className="absolute left-[-8rem] top-12 h-64 w-64 rounded-full bg-[#c95b2f]/14 blur-3xl" />
        <div className="absolute right-[-6rem] top-52 h-72 w-72 rounded-full bg-[#176b68]/14 blur-3xl" />
        <div className="absolute bottom-0 left-1/4 h-60 w-60 rounded-full bg-[#d5a24c]/12 blur-3xl" />
      </div>

      <header className="sticky top-0 z-40 border-b border-white/60 bg-[#f4efe6]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-4 md:px-10">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-lg shadow-[#10222d]/15 overflow-hidden">
              <img src="/logo.png" alt="Logo" className="h-11 w-11 object-contain"/>
            </div>
            <div>
              <p className="font-display text-lg font-semibold tracking-tight text-[#10222d]">Levroxen LLC</p>
              <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-[#8a7863]">Assessment integrity platform</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-2 lg:flex">
            {navItems.map((item) => (
              <NavLink
                key={item.href}
                to={item.href}
                className={({ isActive }) =>
                  `rounded-full px-4 py-2 text-sm font-semibold transition ${
                    isActive
                      ? 'bg-white text-[#10222d] shadow-sm'
                      : 'text-[#5f6c73] hover:bg-white/70 hover:text-[#10222d]'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="hidden items-center gap-3 lg:flex">
            <Link
              to="/auth"
              className="inline-flex h-11 items-center justify-center rounded-full border border-[#10222d]/12 bg-white/70 px-5 text-sm font-semibold text-[#10222d] transition duration-300 hover:border-[#10222d]/20 hover:bg-white"
            >
              Secure sign in
            </Link>
            <Link
              to="/contact"
              className="inline-flex h-11 items-center justify-center rounded-full bg-[#c95b2f] px-5 text-sm font-semibold text-white transition duration-300 hover:bg-[#b24c25]"
            >
              Talk to team
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen((value) => !value)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#10222d]/12 bg-white/70 text-[#10222d] lg:hidden"
            aria-label="Toggle navigation"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {menuOpen ? (
          <div className="border-t border-white/60 px-6 py-4 lg:hidden">
            <div className="mx-auto flex max-w-7xl flex-col gap-2">
              {navItems.map((item) => (
                <NavLink
                  key={item.href}
                  to={item.href}
                  className={({ isActive }) =>
                    `rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                      isActive
                        ? 'bg-white text-[#10222d]'
                        : 'text-[#5f6c73] hover:bg-white/70 hover:text-[#10222d]'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
              <Link
                to="/auth"
                className="mt-2 inline-flex h-12 items-center justify-center rounded-full border border-[#10222d]/12 bg-white px-5 text-sm font-semibold text-[#10222d]"
              >
                Secure sign in
              </Link>
            </div>
          </div>
        ) : null}
      </header>

      <main>
        <Outlet />
      </main>
    </div>
  );
};

export default PublicSiteLayout;
