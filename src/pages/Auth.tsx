import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Lock, Mail, User, Phone, School, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { apiFetch, setAuthSession, getAuthToken, clearAuthSession } from '../utils/api';

export const Auth: React.FC = () => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [instituteId, setInstituteId] = useState<string>('');
  const [role, setRole] = useState('candidate');

  const [institutes, setInstitutes] = useState<any[]>([]);

  const [passwordStrength, setPasswordStrength] = useState({ score: 0, text: '', color: '' });

  useEffect(() => {
    const currentToken = getAuthToken();
    const currentRole = localStorage.getItem('user_role');
    if (currentToken && currentRole) {
      if (currentRole === 'admin') navigate('/admin');
      else navigate('/candidate');
    }
  }, [navigate]);

  useEffect(() => {
    const fetchInstitutes = async () => {
      try {
        const data = await apiFetch('/api/institutes');
        setInstitutes(data);
      } catch (err) {
        console.error('Failed to load institutes', err);
      }
    };
    fetchInstitutes();
  }, []);

  useEffect(() => {
    if (!password) {
      setPasswordStrength({ score: 0, text: '', color: '' });
      return;
    }
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    let text = 'Weak';
    let color = 'bg-rose-500';
    if (score === 2) {
      text = 'Fair';
      color = 'bg-amber-500';
    } else if (score === 3) {
      text = 'Good';
      color = 'bg-indigo-500';
    } else if (score === 4) {
      text = 'Strong';
      color = 'bg-emerald-500';
    }
    setPasswordStrength({ score, text, color });
  }, [password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (isLogin) {
        const response = await apiFetch('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });

        setAuthSession(
          response.access_token,
          response.refresh_token,
          response.role,
          response.user_id,
          response.name,
        );

        if (response.role === 'admin') {
          navigate('/admin');
        } else {
          navigate('/candidate');
        }
      } else {
        if (password !== confirmPassword) {
          throw new Error("Passwords do not match");
        }
        if (passwordStrength.score < 2) {
          throw new Error("Please use a stronger password (at least 8 chars with varied symbols)");
        }

        await apiFetch('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            email,
            password,
            name,
            role,
            institute_id: instituteId ? parseInt(instituteId) : null
          }),
        });

        setIsLogin(true);
        setSuccess("Account created successfully! Please login.");
        setPassword('');
        setConfirmPassword('');
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4efe6] flex flex-col md:flex-row items-stretch overflow-hidden font-sans relative">
      <div className="fixed inset-0 -z-10 opacity-70">
        <div className="absolute left-[-8rem] top-12 h-64 w-64 rounded-full bg-[#c95b2f]/14 blur-3xl" />
        <div className="absolute right-[-6rem] top-52 h-72 w-72 rounded-full bg-[#176b68]/14 blur-3xl" />
        <div className="absolute bottom-0 left-1/4 h-60 w-60 rounded-full bg-[#d5a24c]/12 blur-3xl" />
      </div>

      <div className="flex-1 bg-[#10222d] p-12 flex flex-col justify-between relative overflow-hidden border-b md:border-b-0 md:border-r border-[#10222d]/20 text-white">
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] bg-[#c95b2f]/10 rounded-full filter blur-[120px] pointer-events-none -z-10"></div>
        <div className="absolute -bottom-40 -left-40 w-[400px] h-[400px] bg-[#176b68]/10 rounded-full filter blur-[100px] pointer-events-none -z-10"></div>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#ffffff] flex items-center justify-center shadow-lg shadow-[#c95b2f]/30">
            <img src="/logo.png" alt="Logo" className="h-11 w-11 object-contain"/>
          </div>
          <div className="text-left">
            <h2 className="font-extrabold text-white tracking-wide text-lg leading-none">Levroxen LLC</h2>
            <span className="text-[9px] text-[#c7d5da] font-bold uppercase tracking-wider mt-0.5 block">Exam Control Network</span>
          </div>
        </div>

        <div className="my-auto py-12 w-full max-w-[650px] lg:ml-24 xl:ml-40">
          <h1 className="text-3xl md:text-4xl font-extrabold text-white leading-tight tracking-tight mb-5 text-left font-display">
            Mission Control for Secure Online Examinations.
          </h1>
          <p className="text-[#c7d5da] text-sm leading-relaxed text-left">
            Levroxen LLC combines localized computer-vision tracking, real-time telemetry pipelines, and snapshot audit versioning to protect assessment integrity for premier learning institutions worldwide.
          </p>

          <div className="mt-10 space-y-4">
            <div className="flex items-center gap-4 bg-white/[0.02] border border-white/[0.05] hover:border-[#c95b2f]/30 hover:bg-[#c95b2f]/[0.03] p-5 rounded-2xl transition-all duration-300 backdrop-blur-sm group">
              <div className="w-10 h-10 rounded-xl bg-[#c95b2f]/15 flex items-center justify-center border border-[#c95b2f]/20 group-hover:scale-105 transition-transform duration-300">
                <Shield className="w-5 h-5 text-[#c95b2f]" />
              </div>
              <div className="text-left">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-0.5">Edge AI Proctoring</h4>
                <p className="text-xs text-[#c7d5da]">Real-time local computer-vision and verification active</p>
              </div>
            </div>
            <div className="flex items-center gap-4 bg-white/[0.02] border border-white/[0.05] hover:border-[#176b68]/30 hover:bg-[#176b68]/[0.03] p-5 rounded-2xl transition-all duration-300 backdrop-blur-sm group">
              <div className="w-10 h-10 rounded-xl bg-[#176b68]/15 flex items-center justify-center border border-[#176b68]/20 group-hover:scale-105 transition-transform duration-300">
                <Lock className="w-5 h-5 text-[#176b68]" />
              </div>
              <div className="text-left">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-0.5">Immutable Auditing</h4>
                <p className="text-xs text-[#c7d5da]">Session metrics frozen via database state snapshots</p>
              </div>
            </div>
          </div>
        </div>

        <div className="text-[10px] text-[#c7d5da]/65 font-semibold uppercase tracking-wider flex justify-between">
          <span>Version 2.0</span>
          <span>© 2026 Levroxen LLC</span>
        </div>
      </div>

      <div className="w-full md:w-[520px] p-8 md:p-12 flex flex-col justify-center relative bg-transparent z-10">
        <div className="absolute top-1/4 right-10 w-[200px] h-[200px] bg-[#c95b2f]/5 rounded-full filter blur-[60px] pointer-events-none -z-10"></div>
        <div className="absolute bottom-1/4 left-10 w-[200px] h-[200px] bg-[#176b68]/5 rounded-full filter blur-[60px] pointer-events-none -z-10"></div>
        
        <div className="max-w-md mx-auto w-full bg-white/80 border border-white/70 shadow-[0_30px_90px_rgba(16,34,45,0.08)] backdrop-blur-md rounded-[32px] p-8 relative z-10">
          <div className="mb-8 text-left">
            <h2 className="text-2xl font-bold text-[#10222d] tracking-tight font-display">
              {isLogin ? 'Sign In' : 'Create Account'}
            </h2>
            <p className="text-xs text-[#5f6c73] mt-1.5 leading-relaxed">
              {isLogin ? 'Access secure examination command center' : 'Register details to start testing sessions'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-4 bg-rose-50 border border-rose-200/50 rounded-xl text-xs text-rose-600 font-semibold leading-relaxed">
                {error}
              </div>
            )}

            {success && (
              <div className="p-4 bg-emerald-50 border border-emerald-200/50 rounded-xl text-xs text-[#176b68] font-semibold leading-relaxed">
                {success}
              </div>
            )}

            {!isLogin && (
              <>
                <div>
                  <label className="text-[10px] font-bold text-[#5f6c73] uppercase tracking-wider block mb-1.5 font-sans">Full Name</label>
                  <div className="relative group">
                    <User className="absolute left-4 top-3.5 w-4 h-4 text-slate-400 group-focus-within:text-[#c95b2f] transition-colors duration-200" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Joe Stan"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full h-12 bg-white/70 hover:bg-white border border-[#10222d]/10 hover:border-[#10222d]/25 focus:border-[#c95b2f] focus:bg-white text-[#10222d] text-sm rounded-xl pl-12 pr-4 focus:outline-none focus:ring-4 focus:ring-[#c95b2f]/10 transition-all duration-200 placeholder-slate-400"
                    />
                  </div>
                </div>

                {role === 'candidate' && (
                  <div>
                    <label className="text-[10px] font-bold text-[#5f6c73] uppercase tracking-wider block mb-1.5 font-sans">Select Institute</label>
                    <div className="relative group">
                      <School className="absolute left-4 top-3.5 w-4 h-4 text-slate-400 group-focus-within:text-[#c95b2f] transition-colors duration-200" />
                      <select
                        required
                        value={instituteId}
                        onChange={(e) => setInstituteId(e.target.value)}
                        className="w-full h-12 bg-white/70 hover:bg-white border border-[#10222d]/10 hover:border-[#10222d]/25 focus:border-[#c95b2f] focus:bg-white text-[#10222d] text-sm rounded-xl pl-12 pr-10 focus:outline-none focus:ring-4 focus:ring-[#c95b2f]/10 transition-all duration-200 appearance-none cursor-pointer"
                      >
                        <option value="" className="bg-[#f4efe6] text-slate-400">Choose your institution...</option>
                        {institutes.map((inst) => {
                          const deadlinePassed = inst.deadline && new Date(inst.deadline) < new Date();
                          return (
                            <option key={inst.id} value={inst.id} disabled={deadlinePassed} className="bg-[#f4efe6] text-[#10222d] disabled:text-slate-400">
                              {inst.name} ({inst.code}){deadlinePassed ? ' - Deadline Passed' : ''}
                            </option>
                          );
                        })}
                      </select>
                      <div className="absolute right-4 top-4 pointer-events-none text-slate-400 group-focus-within:text-[#c95b2f] transition-colors">
                        <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                          <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                        </svg>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            <div>
              <label className="text-[10px] font-bold text-[#5f6c73] uppercase tracking-wider block mb-1.5 font-sans">Email Address</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-3.5 w-4 h-4 text-slate-400 group-focus-within:text-[#c95b2f] transition-colors duration-200" />
                <input
                  type="email"
                  required
                  placeholder="name@institute.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-12 bg-white/70 hover:bg-white border border-[#10222d]/10 hover:border-[#10222d]/25 focus:border-[#c95b2f] focus:bg-white text-[#10222d] text-sm rounded-xl pl-12 pr-4 focus:outline-none focus:ring-4 focus:ring-[#c95b2f]/10 transition-all duration-200 placeholder-slate-400"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-[#5f6c73] uppercase tracking-wider block mb-1.5 font-sans">Password</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-3.5 w-4 h-4 text-slate-400 group-focus-within:text-[#c95b2f] transition-colors duration-200" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-12 bg-white/70 hover:bg-white border border-[#10222d]/10 hover:border-[#10222d]/25 focus:border-[#c95b2f] focus:bg-white text-[#10222d] text-sm rounded-xl pl-12 pr-12 focus:outline-none focus:ring-4 focus:ring-[#c95b2f]/10 transition-all duration-200 placeholder-slate-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-3.5 text-slate-400 hover:text-[#10222d] transition-colors focus:outline-none"
                >
                  {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                </button>
              </div>

              {!isLogin && password && (
                <div className="mt-3 space-y-1.5">
                  <div className="flex justify-between items-center text-[10px] text-[#5f6c73] font-bold uppercase tracking-wider">
                    <span>Password Strength</span>
                    <span className="font-extrabold text-[#10222d]">{passwordStrength.text}</span>
                  </div>
                  <div className="h-1.5 w-full bg-[#10222d]/5 rounded-full overflow-hidden flex gap-1 border border-[#10222d]/10">
                    {[1, 2, 3, 4].map((step) => (
                      <div
                        key={step}
                        className={`h-full flex-1 rounded-full transition-all duration-300 ${step <= passwordStrength.score ? passwordStrength.color : 'bg-slate-200'
                          }`}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {!isLogin && (
              <div>
                <label className="text-[10px] font-bold text-[#5f6c73] uppercase tracking-wider block mb-1.5 font-sans">Confirm Password</label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-3.5 w-4 h-4 text-slate-400 group-focus-within:text-[#c95b2f] transition-colors duration-200" />
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full h-12 bg-white/70 hover:bg-white border border-[#10222d]/10 hover:border-[#10222d]/25 focus:border-[#c95b2f] focus:bg-white text-[#10222d] text-sm rounded-xl pl-12 pr-4 focus:outline-none focus:ring-4 focus:ring-[#c95b2f]/10 transition-all duration-200 placeholder-slate-400"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-[#c95b2f] hover:bg-[#b24c25] active:scale-[0.98] disabled:bg-[#c95b2f]/50 disabled:opacity-50 text-white rounded-xl text-sm font-bold tracking-wide transition-all duration-300 flex items-center justify-center gap-2 shadow-lg shadow-[#c95b2f]/20"
            >
              {loading ? (
                <span>Validating credentials...</span>
              ) : (
                <>
                  <span>{isLogin ? 'Establish Session' : 'Register Secure Profile'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setError(null);
                setSuccess(null);
              }}
              className="text-xs text-[#5f6c73] hover:text-[#c95b2f] transition-colors duration-200 font-semibold"
            >
              {isLogin ? "Don't have an account? Sign Up" : 'Already registered? Sign In'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
export default Auth;
