import React, { useState } from 'react';
import { Send, CheckCircle2 } from 'lucide-react';
import { PageHero } from '../components/PublicSiteLayout';

const ContactPage: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('General Inquiry');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
      setName('');
      setEmail('');
      setMessage('');
    }, 800);
  };

  return (
    <>
      <PageHero
        eyebrow="Contact Us"
        title="Get in touch with our team"
        description="Have questions about AssessPro AI? Fill out the form below and our team will get back to you shortly."
        primaryLabel="Explore Platform"
        primaryHref="/platform"
        secondaryLabel="Secure Sign In"
        secondaryHref="/auth"
      />

      <section className="px-6 py-20 md:px-10 relative overflow-hidden">
        <div className="absolute inset-0 -z-10 opacity-40">
          <div className="absolute left-1/4 top-1/4 h-72 w-72 rounded-full bg-[#c95b2f]/10 blur-3xl" />
          <div className="absolute right-1/4 bottom-1/4 h-80 w-80 rounded-full bg-[#176b68]/10 blur-3xl" />
        </div>

        <div className="mx-auto max-w-xl">
          {submitted ? (
            <div className="bg-white/80 border border-white/70 shadow-[0_30px_90px_rgba(16,34,45,0.08)] backdrop-blur-md rounded-[32px] p-8 text-center space-y-6">
              <div className="w-16 h-16 bg-[#176b68]/10 text-[#176b68] rounded-full flex items-center justify-center mx-auto border border-[#176b68]/20">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="font-display text-3xl font-semibold text-[#10222d]">Message Sent!</h3>
                <p className="text-sm leading-7 text-[#55646c]">
                  Thank you for reaching out. We have received your inquiry and will respond within 24 hours.
                </p>
              </div>
              <button
                onClick={() => setSubmitted(false)}
                className="inline-flex h-12 items-center justify-center rounded-full bg-[#c95b2f] px-6 text-sm font-bold uppercase tracking-[0.16em] text-white transition hover:bg-[#b24c25] hover:-translate-y-0.5"
              >
                Send another message
              </button>
            </div>
          ) : (
            <div className="bg-white/80 border border-white/70 shadow-[0_30px_90px_rgba(16,34,45,0.08)] backdrop-blur-md rounded-[32px] p-8 md:p-10 space-y-8">
              <div className="space-y-3 text-center md:text-left">
                <h2 className="font-display text-3xl font-semibold text-[#10222d]">Send a Message</h2>
                <p className="text-xs text-[#5f6c73]">We respond to all inquiries within 1 business day.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="text-[10px] font-bold text-[#5f6c73] uppercase tracking-wider block mb-1.5 font-sans">Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Jane Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full h-12 bg-white/70 hover:bg-white border border-[#10222d]/10 hover:border-[#10222d]/25 focus:border-[#c95b2f] focus:bg-white text-[#10222d] text-sm rounded-xl px-4 focus:outline-none focus:ring-4 focus:ring-[#c95b2f]/10 transition-all duration-200 placeholder-slate-400"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-[#5f6c73] uppercase tracking-wider block mb-1.5 font-sans">Email Address</label>
                  <input
                    type="email"
                    required
                    placeholder="jane@organization.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-12 bg-white/70 hover:bg-white border border-[#10222d]/10 hover:border-[#10222d]/25 focus:border-[#c95b2f] focus:bg-white text-[#10222d] text-sm rounded-xl px-4 focus:outline-none focus:ring-4 focus:ring-[#c95b2f]/10 transition-all duration-200 placeholder-slate-400"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-[#5f6c73] uppercase tracking-wider block mb-1.5 font-sans">Subject</label>
                  <div className="relative">
                    <select
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="w-full h-12 bg-white/70 hover:bg-white border border-[#10222d]/10 hover:border-[#10222d]/25 focus:border-[#c95b2f] focus:bg-white text-[#10222d] text-sm rounded-xl pl-4 pr-10 focus:outline-none focus:ring-4 focus:ring-[#c95b2f]/10 transition-all duration-200 appearance-none cursor-pointer"
                    >
                      <option value="General Inquiry">General Inquiry</option>
                      <option value="Demo Request">Book a Demo</option>
                      <option value="Implementation">Implementation Support</option>
                      <option value="Billing">Billing & Enterprise</option>
                    </select>
                    <div className="absolute right-4 top-4 pointer-events-none text-slate-400">
                      <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                        <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-[#5f6c73] uppercase tracking-wider block mb-1.5 font-sans">Message</label>
                  <textarea
                    required
                    placeholder="Tell us about your needs..."
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full bg-white/70 hover:bg-white border border-[#10222d]/10 hover:border-[#10222d]/25 focus:border-[#c95b2f] focus:bg-white text-[#10222d] text-sm rounded-xl p-4 focus:outline-none focus:ring-4 focus:ring-[#c95b2f]/10 transition-all duration-200 placeholder-slate-400 resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 bg-[#c95b2f] hover:bg-[#b24c25] active:scale-[0.98] disabled:bg-[#c95b2f]/50 disabled:opacity-50 text-white rounded-xl text-sm font-bold tracking-wide transition-all duration-300 flex items-center justify-center gap-2 shadow-lg shadow-[#c95b2f]/20 hover:-translate-y-0.5"
                >
                  {loading ? (
                    <span>Sending message...</span>
                  ) : (
                    <>
                      <span>Send Message</span>
                      <Send className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          )}
        </div>
      </section>
    </>
  );
};

export default ContactPage;
