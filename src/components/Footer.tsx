import { Link } from "react-router-dom";
import { Globe, Mail, Phone, MapPin } from "lucide-react";
import { FaLinkedinIn } from "react-icons/fa";

const Footer = () => {
  return (
    <footer className="mt-24 bg-[#10222d] text-white">
      <div className="mx-auto max-w-7xl px-6 py-16 md:px-10">

        <div className="grid gap-12 lg:grid-cols-4">

          {/* ================= Brand ================= */}

          <div>

            <img
              src="/company-logo.png"
              alt="Levroxen Logo"
              className="mb-5 h-[75px] w-auto object-contain"
            />

            <p className="leading-7 text-gray-300">
              Levroxen LLC provides IT consulting, software
              development, and managed services across the USA.
            </p>

            <div className="mt-8 flex gap-4">

              <a
                href="https://www.levroxen.com/"
                target="_blank"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 transition hover:bg-[#0066FF]"
              >
                <Globe size={18} />
              </a>

              <a
                href="https://www.linkedin.com/company/levroxenllc/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 transition hover:bg-[#0066FF]"
              >
                <FaLinkedinIn size={18} />
              </a>

            </div>

          </div>

          {/* ================= Navigation ================= */}

          <div>

            <h3 className="mb-6 text-lg font-semibold tracking-wide">
              NAVIGATION
            </h3>

            <ul className="space-y-4">

              <li>
                <Link to="/" className="text-gray-300 hover:text-white">
                  Home
                </Link>
              </li>

              <li>
                <Link to="/services" className="text-gray-300 hover:text-white">
                  Services
                </Link>
              </li>

              <li>
                <Link to="/industries" className="text-gray-300 hover:text-white">
                  Industries
                </Link>
              </li>

              <li>
                <Link to="/about" className="text-gray-300 hover:text-white">
                  About Us
                </Link>
              </li>

              <li>
                <Link to="/careers" className="text-gray-300 hover:text-white">
                  Careers
                </Link>
              </li>

              <li>
                <Link to="/contact" className="text-gray-300 hover:text-white">
                  Contact
                </Link>
              </li>

            </ul>

          </div>
                    {/* ================= Expertise ================= */}

          <div>

            <h3 className="mb-6 text-lg font-semibold tracking-wide">
              EXPERTISE
            </h3>

            <ul className="space-y-4">

              <li>
                <a href="#" className="text-gray-300 transition hover:text-white">
                  Cloud Management
                </a>
              </li>

              <li>
                <a href="#" className="text-gray-300 transition hover:text-white">
                  Enterprise Management
                </a>
              </li>

              <li>
                <a href="#" className="text-gray-300 transition hover:text-white">
                  Data & AI
                </a>
              </li>

              <li>
                <a href="#" className="text-gray-300 transition hover:text-white">
                  Consulting & Staffing
                </a>
              </li>

              <li>
                <a href="#" className="text-gray-300 transition hover:text-white">
                  Background Verification
                </a>
              </li>

              <li>
                <a href="#" className="text-gray-300 transition hover:text-white">
                  Network Management
                </a>
              </li>

            </ul>

          </div>

          {/* ================= Contact ================= */}

          <div>

            <h3 className="mb-6 text-lg font-semibold tracking-wide">
              LET'S CONNECT
            </h3>

            <div className="space-y-6">

              <div className="flex items-start gap-4">

                <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-full bg-[#0066FF]/15 text-[#4da3ff]">
                  <Mail size={18} />
                </div>

                <div>
                  <a
                    href="mailto:admin@levroxen.com"
                    className="text-gray-300 transition hover:text-white"
                  >
                    admin@levroxen.com
                  </a>
                </div>

              </div>

              <div className="flex items-start gap-4">

                <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-full bg-[#0066FF]/15 text-[#4da3ff]">
                  <Phone size={18} />
                </div>

                <div>
                  <a
                    href="tel:+919703296994"
                    className="text-gray-300 transition hover:text-white"
                  >
                    +91 9703296994
                  </a>
                </div>

              </div>

              <div className="flex items-start gap-4">

                <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-full bg-[#0066FF]/15 text-[#4da3ff]">
                  <MapPin size={18} />
                </div>

                <div className="leading-7 text-gray-300">
                  905 N Pershing Ave
                  <br />
                  Salem, MO 65560-1144
                  <br />
                  United States
                </div>

              </div>

            </div>

          </div>

        </div>
                {/* ================= Bottom Bar ================= */}

        <div className="mt-14 border-t border-white/10 pt-8">

          <div className="flex flex-col items-center justify-between gap-5 text-center md:flex-row">

            <p className="text-sm text-gray-400">
              © {new Date().getFullYear()}{" "}
              <span className="font-semibold text-white">
                Levroxen LLC
              </span>
              . All Rights Reserved.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-6">

              <Link
                to="/privacy-policy"
                className="text-sm text-gray-400 transition hover:text-white"
              >
                Privacy Policy
              </Link>

              <Link
                to="/terms-and-conditions"
                className="text-sm text-gray-400 transition hover:text-white"
              >
                Terms & Conditions
              </Link>

              <Link
                to="/cookies"
                className="text-sm text-gray-400 transition hover:text-white"
              >
                Cookie Policy
              </Link>

            </div>

          </div>

        </div>

      </div>

    </footer>

  );

};

export default Footer