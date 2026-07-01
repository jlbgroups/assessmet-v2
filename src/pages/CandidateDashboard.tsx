import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock,
  Calendar,
  CheckCircle2,
  AlertCircle,
  User,
  ArrowRight,
  Shield
} from 'lucide-react';
import { apiFetch, clearAuthSession, parseUTCDate } from '../utils/api';

export const CandidateDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [assessments, setAssessments] = useState<any[]>([]);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const studentName = localStorage.getItem('user_name') || 'Candidate';

  const fetchData = async () => {
    try {
      const data = await apiFetch('/api/assessments');
      setAssessments(data);

    } catch (err: any) {
      setError(err.message || 'Failed to load assessments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleLogout = () => {
    clearAuthSession();
    navigate('/auth');
  };

  const handleStartExamFlow = (assess: any) => {
    localStorage.setItem('active_exam_id', String(assess.id));
    localStorage.setItem('active_exam_name', assess.name);
    navigate('/system-check');
  };

  const now = new Date();

  const activeExams = assessments.filter(a => {
    const start = parseUTCDate(a.start_date);
    const end = parseUTCDate(a.end_date);
    return now >= start && now <= end;
  });

  const upcomingExams = assessments.filter(a => {
    return parseUTCDate(a.start_date) > now;
  });

  const pastExams = assessments.filter(a => {
    return parseUTCDate(a.end_date) < now;
  });

  return (
    <div className="min-h-screen bg-background text-dark">
      <header className="sticky top-0 z-30 w-full bg-[#f4efe6]/80 border-b border-[#10222d]/8 text-[#10222d] shadow-sm backdrop-blur-xl h-20 px-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#ffffff] text-white shadow-lg shadow-[#10222d]/15">
            <img src="/logo.png" alt="Logo" className="h-11 w-11 object-contain" />
          </div>
          <div>
            <h2 className="font-bold text-[#10222d] tracking-wide text-sm leading-none">Levroxen LLC</h2>
            <span className="text-[9px] text-[#8a7863] font-bold uppercase tracking-wider block mt-0.5">Candidate Terminal</span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#10222d] flex items-center justify-center font-bold text-white text-xs shadow-sm">
              {studentName[0]}
            </div>
            <span className="text-xs font-semibold text-[#10222d]">{studentName}</span>
          </div>
          <button
            onClick={handleLogout}
            className="text-[#5f6c73] hover:text-rose-600 text-xs font-semibold flex items-center transition-colors"
          >
            Sign Out
          </button>
        </div>
      </header>

      <main className="p-content max-w-5xl mx-auto py-10 space-y-8">
        <div className="bg-white border border-border p-6 rounded-card shadow-sm">
          <h2 className="text-lg font-bold text-dark mb-1">Hello, {studentName}</h2>
          <p className="text-xs text-slate-400">Please review your assigned examinations below. You must complete a pre-exam system check before starting any assessment.</p>
        </div>

        {error && (
          <div className="p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-card text-xs font-semibold">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Active Examinations</h3>
          {loading ? (
            <div className="p-8 text-center text-slate-500 text-xs bg-white border border-border rounded-card">
              Synchronizing assigned examination databases...
            </div>
          ) : activeExams.length === 0 ? (
            <div className="p-6 text-center text-slate-400 text-xs bg-white border border-border rounded-card">
              No active assessments assigned at this time.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {activeExams.map((assess) => (
                <div
                  key={assess.id}
                  className="bg-white border border-border p-5 rounded-card shadow-sm hover:shadow-md transition-all duration-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <h4 className="font-bold text-dark text-base">{assess.name}</h4>
                    <p className="text-xs text-slate-500 max-w-2xl">{assess.description || 'No description provided.'}</p>
                    <div className="flex flex-wrap gap-4 text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                      <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {assess.duration_minutes} Minutes</span>
                      <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Closes: {parseUTCDate(assess.end_date).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {assess.user_attempt_status === 'completed' ? (
                    <span className="h-10 px-5 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-btn text-xs font-bold flex items-center justify-center shrink-0">
                      Attempt Completed
                    </span>
                  ) : assess.user_attempt_status === 'terminated' ? (
                    <span className="h-10 px-5 bg-rose-50 border border-rose-100 text-rose-600 rounded-btn text-xs font-bold flex items-center justify-center shrink-0">
                      Disqualified / Terminated
                    </span>
                  ) : (
                    <button
                      onClick={() => handleStartExamFlow(assess)}
                      className="h-10 px-5 bg-primary hover:bg-indigo-500 text-white rounded-btn text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 shadow-lg shadow-indigo-550/10"
                    >
                      <span>{assess.user_attempt_status === 'active' ? 'Resume Exam Session' : 'Begin Exam Session'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Upcoming Assessments</h3>
          {loading ? null : upcomingExams.length === 0 ? (
            <div className="p-6 text-center text-slate-400 text-xs bg-slate-50 border border-border rounded-card border-dashed">
              No upcoming scheduled assessments.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {upcomingExams.map((assess) => (
                <div
                  key={assess.id}
                  className="bg-white border border-border p-5 rounded-card shadow-sm flex flex-col justify-between"
                >
                  <div>
                    <h4 className="font-bold text-dark text-sm mb-1.5">{assess.name}</h4>
                    <p className="text-xs text-slate-450 line-clamp-2 mb-4">{assess.description}</p>
                  </div>
                  <div className="flex items-center justify-between border-t border-border pt-4 mt-auto text-[10px] text-slate-450 font-bold uppercase tracking-wider">
                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {assess.duration_minutes} Mins</span>
                    <span className="text-indigo-600 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-full">
                      Starts {parseUTCDate(assess.start_date).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Past / Closed Examinations</h3>
          {loading ? null : pastExams.length === 0 ? (
            <div className="p-6 text-center text-slate-400 text-xs bg-slate-50 border border-border rounded-card border-dashed">
              No past or expired assessments.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pastExams.map((assess) => {
                let statusBadge = (
                  <span className="text-rose-600 bg-rose-50 border border-rose-100 px-2.5 py-1 rounded-full font-bold">
                    Missed — Exam closed before attempt
                  </span>
                );
                let actionBtn = null;

                if (assess.user_attempt_status === 'completed') {
                  statusBadge = (
                    <span className="text-emerald-600 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full font-bold">
                      Attempt Completed
                    </span>
                  );
                  actionBtn = null;
                } else if (assess.user_attempt_status === 'active') {
                  statusBadge = (
                    <span className="text-amber-600 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-full font-bold">
                      Incomplete — Time expired before submission
                    </span>
                  );
                } else if (assess.user_attempt_status === 'terminated') {
                  statusBadge = (
                    <span className="text-rose-600 bg-rose-50 border border-rose-100 px-2.5 py-1 rounded-full font-bold">
                      Disqualified — Terminated due to violations
                    </span>
                  );
                }

                return (
                  <div
                    key={assess.id}
                    className="bg-white border border-border p-5 rounded-card shadow-sm flex flex-col justify-between hover:shadow-md transition-all duration-200"
                  >
                    <div>
                      <div className="flex justify-between items-start mb-1.5">
                        <h4 className="font-bold text-slate-700 text-sm">{assess.name}</h4>
                        <span className="text-[10px] text-slate-400">ID: #{assess.id}</span>
                      </div>
                      <p className="text-xs text-slate-400 line-clamp-2 mb-4">{assess.description || 'No description provided.'}</p>
                    </div>
                    <div className="border-t border-slate-100 pt-4 mt-auto">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 text-[10px]">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="flex items-center gap-1 text-slate-450 uppercase font-bold tracking-wider">
                            <Clock className="w-3.5 h-3.5 text-slate-400" /> {assess.duration_minutes} Mins
                          </span>
                          {statusBadge}
                        </div>
                        {actionBtn}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
export default CandidateDashboard;
