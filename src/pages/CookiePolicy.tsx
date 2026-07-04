import Footer from "../components/Footer";

const CookiePolicy = () => {
  return (
    <>
      {/* Hero Section */}
      <section className="bg-[#10222d] text-white">
        <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8">

          <span className="inline-block rounded-full bg-[#c95b2f]/20 px-4 py-2 text-sm font-semibold text-[#ffb78f]">
            Legal
          </span>

          <h1 className="mt-6 text-5xl font-bold">
            Cookie Policy
          </h1>

          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">
            This Cookie Policy explains how Levroxen LLC uses cookies and
            similar technologies to improve user experience, maintain secure
            authentication and enhance the performance of our Assessment
            Platform.
          </p>

          <p className="mt-6 text-sm text-slate-400">
            Last Updated : July 2026
          </p>

        </div>
      </section>

      {/* Content */}

      <section className="bg-slate-50 py-20">

        <div className="mx-auto max-w-5xl rounded-3xl bg-white p-10 shadow-lg">

          {/* Introduction */}

          <section className="mb-12">

            <h2 className="mb-5 text-3xl font-bold text-[#10222d]">
              What Are Cookies?
            </h2>

            <p className="leading-8 text-slate-600">
              Cookies are small text files that are stored on your device
              when you visit a website. They help websites remember your
              preferences, improve security, maintain active sessions and
              provide a better browsing experience.
            </p>

          </section>

          {/* Why We Use Cookies */}

          <section className="mb-12">

            <h2 className="mb-5 text-3xl font-bold text-[#10222d]">
              Why We Use Cookies
            </h2>

            <p className="leading-8 text-slate-600">
              Levroxen LLC uses cookies to authenticate users, maintain secure
              login sessions, remember user preferences, improve platform
              performance, monitor website usage and ensure reliable delivery
              of online assessments.
            </p>

          </section>

            <section className="mb-12">

            <h2 className="mb-5 text-3xl font-bold text-[#10222d]">
                Essential Cookies
            </h2>

            <p className="leading-8 text-slate-600">
                Essential cookies are required for the proper functioning of our
                Assessment Platform. These cookies enable core features such as secure
                authentication, session management, page navigation and access to
                protected resources. Without these cookies, certain services cannot be
                provided.
            </p>

            </section>
            <section className="mb-12">

            <h2 className="mb-5 text-3xl font-bold text-[#10222d]">
                Authentication & Security Cookies
            </h2>

            <p className="leading-8 text-slate-600">
                Authentication cookies help verify user identity after login and maintain
                secure sessions throughout an assessment. These cookies also assist in
                preventing unauthorized access and protecting user accounts against
                malicious activities.
            </p>

            </section>
            <section className="mb-12">

            <h2 className="mb-5 text-3xl font-bold text-[#10222d]">
                Performance & Analytics Cookies
            </h2>

            <p className="leading-8 text-slate-600">
                We may use performance and analytics cookies to understand how visitors
                interact with our platform. These cookies help us measure website
                performance, identify technical issues and continuously improve user
                experience. Wherever possible, analytical information is collected in an
                aggregated or anonymized manner.
            </p>

            </section>
            <section className="mb-12">

            <h2 className="mb-5 text-3xl font-bold text-[#10222d]">
                Functional Cookies
            </h2>

            <p className="leading-8 text-slate-600">
                Functional cookies remember user preferences such as language settings,
                interface preferences and other personalized configurations. These
                cookies enhance usability by providing a more consistent and convenient
                browsing experience across visits.
            </p>

            </section>
            <section className="mb-12">

            <h2 className="mb-5 text-3xl font-bold text-[#10222d]">
                Third-Party Cookies
            </h2>

            <p className="leading-8 text-slate-600">
                Some features of our platform may rely on trusted third-party service
                providers for hosting, analytics, security, email communications or other
                operational purposes. These providers may place cookies in accordance with
                their own privacy policies and applicable legal requirements.
            </p>

            </section>
            <section className="mb-12">

            <h2 className="mb-5 text-3xl font-bold text-[#10222d]">
                Managing Your Cookie Preferences
            </h2>

            <p className="leading-8 text-slate-600">
                Most web browsers allow you to control or disable cookies through their
                settings. You may choose to block or delete cookies at any time; however,
                doing so may affect the availability, functionality or security of certain
                features of the Assessment Platform, including authentication and
                assessment sessions.
            </p>

            </section>
            <section className="mb-12">

            <h2 className="mb-5 text-3xl font-bold text-[#10222d]">
                Changes to This Cookie Policy
            </h2>

            <p className="leading-8 text-slate-600">
                Levroxen LLC may update this Cookie Policy from time to time to reflect
                changes in legal requirements, technology, or our services. Any updates
                will be published on this page together with the revised "Last Updated"
                date. We encourage users to review this policy periodically.
            </p>

            </section>
            <section>

            <h2 className="mb-5 text-3xl font-bold text-[#10222d]">
                Contact Us
            </h2>

            <p className="leading-8 text-slate-600">
                If you have any questions regarding our use of cookies or this Cookie
                Policy, please contact us using the details below.
            </p>

            <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-6">

                <div className="space-y-3">

                <p>
                    <strong>Levroxen LLC</strong>
                </p>

                <p>
                    Email: admin@levroxen.com
                </p>

                <p>
                    Website: https://assessments.levroxen.com
                </p>

                <p>
                    Address:
                    <br />
                    905 N Pershing Ave
                    <br />
                    Salem, MO 65560-1144
                    <br />
                    United States
                </p>

                </div>

            </div>

            </section>
        </div>

      </section>

      <Footer />

    </>
  );
};

export default CookiePolicy;