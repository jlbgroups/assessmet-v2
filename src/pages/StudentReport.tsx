import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Award,
  Clock,
  Calendar,
  ShieldAlert,
  CheckCircle,
  XCircle,
  ChevronLeft,
  ArrowRight,
  Printer,
  Code2,
  Terminal
} from 'lucide-react';
import { apiFetch, parseUTCDate } from '../utils/api';
import Editor from '@monaco-editor/react';

export const StudentReport: React.FC = () => {
  const { attempt_id } = useParams<{ attempt_id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [codeSubmissions, setCodeSubmissions] = useState<any[]>([]);
  const [selectedSubIndex, setSelectedSubIndex] = useState<number>(0);
  const isAdmin = localStorage.getItem('user_role') === 'admin';

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const report = await apiFetch(`/api/reports/candidate/${attempt_id}`);
        setData(report);
        const role = localStorage.getItem('user_role');
        if (role === 'admin') {
          try {
            const subs = await apiFetch(`/api/reports/admin/code-submissions/${attempt_id}`);
            setCodeSubmissions(subs || []);
          } catch (err) {
            console.error('Failed to load code submissions for admin view:', err);
          }
        }
      } catch (err: any) {
        setError(err.message || 'Failed to retrieve assessment session report');
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [attempt_id]);
  const handleReturn = () => {
    const role = localStorage.getItem('user_role');
    if (role === 'admin') navigate('/admin/reports');
    else navigate('/candidate');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="text-slate-450 font-semibold text-sm">Compiling exam telemetry results...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background text-dark flex items-center justify-center p-6">
        <div className="bg-white border border-border p-6 rounded-card max-w-md w-full shadow-lg text-center space-y-4">
          <XCircle className="w-12 h-12 text-rose-500 mx-auto" />
          <h2 className="text-lg font-bold text-dark">Report Retrieval Failed</h2>
          <p className="text-xs text-slate-500">{error || 'Data packet empty'}</p>
          <button
            onClick={handleReturn}
            className="w-full h-10 bg-indigo-650 hover:bg-indigo-600 text-white rounded-btn text-xs font-bold transition-all"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const { candidate, assessment, attempt, violations } = data;
  const isPassed = attempt.passed;

  return (
    <div className="min-h-screen bg-background text-dark py-12 px-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex justify-between items-center shrink-0">
          <button
            onClick={handleReturn}
            className="h-9 px-3.5 border border-slate-200 text-slate-600 rounded-btn text-xs font-semibold hover:bg-white flex items-center gap-1.5 transition-all"
          >
            <ChevronLeft className="w-4 h-4" /> Exit Report
          </button>
          <button
            onClick={() => window.print()}
            className="h-9 px-3.5 bg-white border border-slate-200 text-slate-600 rounded-btn text-xs font-semibold hover:bg-slate-50 flex items-center gap-1.5 transition-all shadow-sm"
          >
            <Printer className="w-4 h-4" /> Print Results
          </button>
        </div>

        <div className="bg-white border border-border p-8 rounded-card shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full filter blur-[50px]"></div>

          <div className="space-y-2 text-left">
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Exam Telemetry Receipt</span>
            <h1 className="text-2xl font-bold text-dark">{assessment.name}</h1>
            <div className="flex flex-wrap gap-4 text-[10px] text-slate-500 font-medium">
              <span>Candidate: <strong className="text-dark">{candidate.name}</strong></span>
              <span>Email: <strong className="text-dark">{candidate.email}</strong></span>
            </div>
          </div>

          <div className="flex items-center gap-3 self-stretch md:self-auto border-t md:border-t-0 border-slate-100 pt-4 md:pt-0">
            {isPassed ? (
              <div className="bg-emerald-50 border border-emerald-250/20 text-emerald-600 px-4 py-2.5 rounded-2xl flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-500" />
                <div>
                  <span className="text-[9px] font-bold block uppercase tracking-wider">Status</span>
                  <span className="text-xs font-bold">Passed</span>
                </div>
              </div>
            ) : (
              <div className="bg-rose-50 border border-rose-250/20 text-rose-600 px-4 py-2.5 rounded-2xl flex items-center gap-2">
                <XCircle className="w-5 h-5 text-rose-500" />
                <div>
                  <span className="text-[9px] font-bold block uppercase tracking-wider">Status</span>
                  <span className="text-xs font-bold">Failed</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          <div className="bg-white border border-border p-5 rounded-card shadow-sm">
            <span className="text-[9px] font-bold text-slate-450 uppercase tracking-wider block mb-1">Absolute Score</span>
            <h3 className="text-2xl font-extrabold text-slate-800">{attempt.score ?? 'N/A'}</h3>
            <span className="text-[9px] text-slate-450">of {assessment.total_marks} Marks</span>
          </div>

          <div className="bg-white border border-border p-5 rounded-card shadow-sm">
            <span className="text-[9px] font-bold text-slate-450 uppercase tracking-wider block mb-1">Percentage</span>
            <h3 className="text-2xl font-extrabold text-slate-800">{Math.round(attempt.percentage)}%</h3>
            <span className="text-[9px] text-slate-450">Passing threshold: {Math.round((assessment.passing_marks / assessment.total_marks) * 100)}%</span>
          </div>

          <div className="bg-white border border-border p-5 rounded-card shadow-sm">
            <span className="text-[9px] font-bold text-slate-450 uppercase tracking-wider block mb-1">Global Rank</span>
            <h3 className="text-2xl font-extrabold text-indigo-650">#{attempt.rank}</h3>
            <span className="text-[9px] text-slate-450">among snapshot sessions</span>
          </div>

          <div className="bg-white border border-border p-5 rounded-card shadow-sm">
            <span className="text-[9px] font-bold text-slate-450 uppercase tracking-wider block mb-1">Exam Duration</span>
            <div className="flex items-center gap-1 text-slate-700 font-bold text-base mt-1.5">
              <Clock className="w-4 h-4 text-slate-400" /> {assessment.duration_minutes} Mins
            </div>
            <span className="text-[9px] text-slate-450">Completed exam window</span>
          </div>
        </div>

        <div className="bg-white border border-border p-6 rounded-card shadow-sm space-y-4">
          <h3 className="font-bold text-dark text-sm border-b border-border pb-3 mb-4">Proctoring Telemetry Audits</h3>

          {violations.length === 0 ? (
            <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-semibold rounded-xl flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-500" /> Integrity Audit Successful: 0 Policy Violations Detected.
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-4 bg-rose-50 border border-rose-150/40 text-rose-700 text-xs font-semibold rounded-xl flex items-center gap-2 mb-4">
                <ShieldAlert className="w-4.5 h-4.5 text-rose-500" /> System Check logged {violations.length} policy infractions.
              </div>

              <div className="divide-y divide-border border border-border rounded-xl overflow-hidden text-xs">
                {violations.map((v: any, idx: number) => (
                  <div key={v.id} className="p-4 flex justify-between items-center hover:bg-slate-50/50 transition-all">
                    <div className="space-y-1 text-left">
                      <div className="font-bold text-slate-750">{v.details || v.type.replace('_', ' ')}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {v.type.toUpperCase()} • {parseUTCDate(v.timestamp).toLocaleTimeString()}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="px-2 py-0.5 bg-rose-50 border border-rose-100 text-rose-600 rounded-full font-bold text-[8px] uppercase">
                        {v.severity}
                      </span>
                      {v.screenshot_url && (
                        <button
                          onClick={() => setSelectedImage(v.screenshot_url)}
                          className="h-8 px-3 border border-slate-200 hover:border-indigo-300 text-slate-500 hover:text-indigo-650 hover:bg-indigo-50 rounded-lg transition-all text-[10px] font-bold"
                        >
                          View Image
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {isAdmin && codeSubmissions && codeSubmissions.length > 0 && (
          <div className="bg-white border border-border p-6 rounded-card shadow-sm space-y-4 text-left">
            <h3 className="font-bold text-dark text-sm border-b border-border pb-3 mb-4 flex items-center gap-1.5">
              <Code2 className="w-5 h-5 text-indigo-600" /> Candidate Programming Submissions ({codeSubmissions.length})
            </h3>

            <div className="flex flex-col md:flex-row gap-6">
              <div className="w-full md:w-1/3 border border-border rounded-xl overflow-hidden divide-y divide-border h-[400px] overflow-y-auto bg-slate-50/50">
                {codeSubmissions.map((sub, idx) => {
                  const qInfo = (data.questions || []).find((q: any) => q.id === sub.question_id);
                  const qTitle = qInfo ? qInfo.title : `Question ID ${sub.question_id}`;
                  const isSelected = idx === selectedSubIndex;
                  return (
                    <button
                      key={sub.id}
                      onClick={() => setSelectedSubIndex(idx)}
                      className={`w-full p-4 text-left transition-all flex flex-col gap-1.5 ${isSelected
                          ? 'bg-indigo-50 border-l-4 border-l-indigo-650'
                          : 'hover:bg-slate-100/70'
                        }`}
                    >
                      <span className="text-xs font-bold text-slate-800 line-clamp-1">{qTitle}</span>
                      <div className="flex justify-between items-center text-[10px] text-slate-400 font-semibold uppercase">
                        <span className="capitalize">{sub.language}</span>
                        <span className={sub.passed_cases === sub.total_cases ? 'text-emerald-600' : 'text-rose-600'}>
                          {sub.passed_cases}/{sub.total_cases} Passed
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex-1 flex flex-col gap-4">
                {(() => {
                  const sub = codeSubmissions[selectedSubIndex];
                  if (!sub) return <p className="text-xs text-slate-400 text-center py-10">Select a submission from the list to review</p>;
                  return (
                    <>
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-750 uppercase tracking-wide">
                          Language: <strong className="capitalize text-slate-900">{sub.language}</strong>
                        </span>
                        <div className="flex gap-4 text-slate-500 font-semibold">
                          <span>Execution: <strong>{(sub.execution_time || 0).toFixed(3)}s</strong></span>
                          <span>Score: <strong>{sub.score} Marks</strong></span>
                        </div>
                      </div>

                      <div className="border border-border rounded-xl overflow-hidden bg-[#1e1e1e]">
                        <div className="bg-[#252526] px-4 py-2 border-b border-[#3c3c3c] flex justify-between items-center text-[10px] text-slate-450 font-bold uppercase font-mono">
                          <span>solution.{sub.language === 'javascript' ? 'js' : sub.language === 'cpp' ? 'cpp' : sub.language === 'java' ? 'java' : 'py'}</span>
                          <span className={sub.status === 'Accepted' ? 'text-emerald-500 font-bold' : 'text-rose-500 font-bold'}>{sub.status}</span>
                        </div>
                        <Editor
                          height="250px"
                          language={sub.language}
                          theme="vs-dark"
                          value={sub.source_code}
                          options={{
                            readOnly: true,
                            minimap: { enabled: false },
                            fontSize: 12,
                            fontFamily: "'Fira Code', 'Courier New', monospace",
                            scrollBeyondLastLine: false,
                            automaticLayout: true,
                            padding: { top: 8, bottom: 8 }
                          }}
                        />
                      </div>

                      {(sub.stdout || sub.stderr || sub.compile_output) && (
                        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl text-left font-mono">
                          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 font-sans flex items-center gap-1">
                            <Terminal className="w-3.5 h-3.5 text-slate-450" /> Submission Output / Error Details
                          </h4>
                          <pre className="max-h-40 overflow-y-auto text-[10px] text-slate-300 leading-relaxed whitespace-pre-wrap break-all">
                            {sub.compile_output && `[Compilation Error/Warning]:\n${sub.compile_output}\n\n`}
                            {sub.stderr && `[Standard Error]:\n${sub.stderr}\n\n`}
                            {sub.stdout && `[Standard Output]:\n${sub.stdout}`}
                          </pre>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {selectedImage && (
          <div className="fixed inset-0 bg-slate-950/45 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white border border-border w-full max-w-xl rounded-card shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="px-6 py-4 border-b border-border bg-slate-50 flex justify-between items-center">
                <h3 className="font-bold text-dark text-sm flex items-center gap-1.5">
                  <ShieldAlert className="w-4.5 h-4.5 text-amber-500" /> Telemetry Infraction Evidence
                </h3>
                <button
                  onClick={() => setSelectedImage(null)}
                  className="text-slate-400 hover:text-dark font-bold text-base"
                >
                  ✕
                </button>
              </div>
              <div className="p-6 bg-slate-950 flex items-center justify-center">
                <img
                  src={selectedImage}
                  alt="Audit Capture Evidence"
                  className="max-h-[60vh] object-contain border border-slate-800 rounded-xl"
                />
              </div>
              <div className="px-6 py-4 border-t border-border flex justify-end">
                <button
                  onClick={() => setSelectedImage(null)}
                  className="h-10 px-5 bg-primary hover:bg-indigo-500 text-white rounded-btn text-xs font-bold transition-all"
                >
                  Close Viewer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
export default StudentReport;
