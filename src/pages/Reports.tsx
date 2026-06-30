import React, { useEffect, useState } from 'react';
import { FileBarChart2, GraduationCap, School, Users, CheckCircle, Percent, AlertCircle, Search, ExternalLink, Download } from 'lucide-react';
import { apiFetch, getAuthToken, BASE_URL } from '../utils/api';
import AdminLayout from '../components/AdminLayout';

export const Reports: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [assessments, setAssessments] = useState<any[]>([]);
  const [institutes, setInstitutes] = useState<any[]>([]);

  const [selectedAssessId, setSelectedAssessId] = useState('');
  const [selectedInstId, setSelectedInstId] = useState('');

  const [assessReport, setAssessReport] = useState<any | null>(null);
  const [instReport, setInstReport] = useState<any | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadFilters = async () => {
      try {
        const assess = await apiFetch('/api/assessments');
        setAssessments(assess);

        const insts = await apiFetch('/api/institutes');
        setInstitutes(insts);
      } catch (err: any) {
        setError(err.message || 'Failed to initialize report filters');
      } finally {
        setLoading(false);
      }
    };
    loadFilters();
  }, []);

  const handleSelectAssessment = async (id: string) => {
    setSelectedAssessId(id);
    setSelectedInstId('');
    setInstReport(null);
    setSearchTerm('');
    if (!id) {
      setAssessReport(null);
      return;
    }

    setLoading(true);
    try {
      const data = await apiFetch(`/api/reports/assessment/${id}`);
      setAssessReport(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load assessment analytical report');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectInstitute = async (id: string) => {
    setSelectedInstId(id);
    setSelectedAssessId('');
    setAssessReport(null);
    setSearchTerm('');
    if (!id) {
      setInstReport(null);
      return;
    }

    setLoading(true);
    try {
      const data = await apiFetch(`/api/reports/institute/${id}`);
      setInstReport(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load institute analytical report');
    } finally {
      setLoading(false);
    }
  };

  const downloadCSV = async (endpoint: string, defaultFilename: string) => {
    try {
      const token = getAuthToken();
      const response = await fetch(`${BASE_URL}${endpoint}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.detail || 'Failed to download report.');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = defaultFilename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err: any) {
      alert(err.message || 'Failed to download report.');
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white border border-border p-6 rounded-card shadow-sm gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
              <FileBarChart2 className="w-5 h-5" />
            </div>
            <div className="text-left">
              <h2 className="text-base font-bold text-dark">Data Storytelling & Reports</h2>
              <p className="text-xs text-slate-400">Generate, review, and evaluate exam metrics and institute statistics</p>
            </div>
          </div>
          <button
            onClick={() => downloadCSV('/api/reports/all/csv', 'all_attempts_reports.csv')}
            className="inline-flex items-center gap-1.5 h-10 px-4 bg-indigo-600 hover:bg-indigo-555 text-white rounded-btn text-xs font-bold transition-all shadow-md shadow-indigo-600/10 cursor-pointer shrink-0"
          >
            <Download className="w-4 h-4" /> Bulk Download All Reports
          </button>
        </div>

        <div className="bg-white border border-border p-5 rounded-card shadow-sm grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Analyze Assessment Results</label>
            <select
              value={selectedAssessId}
              onChange={(e) => handleSelectAssessment(e.target.value)}
              className="w-full h-11 bg-slate-50 border border-slate-200 rounded-input px-3.5 text-xs focus:bg-white focus:outline-none"
            >
              <option value="">Select assessment to generate metrics...</option>
              {assessments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} (V{a.active_version})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Analyze Institute Performance</label>
            <select
              value={selectedInstId}
              onChange={(e) => handleSelectInstitute(e.target.value)}
              className="w-full h-11 bg-slate-50 border border-slate-200 rounded-input px-3.5 text-xs focus:bg-white focus:outline-none"
            >
              <option value="">Select institute to generate metrics...</option>
              {institutes.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({i.code})
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-card text-xs font-semibold">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-slate-500 text-xs font-semibold">
            Aggregating performance analytical records...
          </div>
        ) : (
          <>
            {assessReport && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                  <div className="bg-white border border-border p-5 rounded-card shadow-sm">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Pass Ratio</span>
                    <div className="flex items-baseline gap-1.5">
                      <h3 className="text-2xl font-extrabold text-indigo-600">{Math.round(assessReport.pass_rate_percentage)}%</h3>
                      <span className="text-[10px] text-slate-400 font-semibold">Target: {assessReport.passing_marks} marks</span>
                    </div>
                  </div>
                  <div className="bg-white border border-border p-5 rounded-card shadow-sm">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Average Score</span>
                    <div className="flex items-baseline gap-1.5">
                      <h3 className="text-2xl font-extrabold text-slate-800">{Math.round(assessReport.average_score)}</h3>
                      <span className="text-[10px] text-slate-450 font-semibold">Total: {assessReport.total_marks} marks</span>
                    </div>
                  </div>
                  <div className="bg-white border border-border p-5 rounded-card shadow-sm">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Total Completed</span>
                    <div className="flex items-baseline gap-1.5">
                      <h3 className="text-2xl font-extrabold text-slate-800">{assessReport.completed_count}</h3>
                      <span className="text-[10px] text-slate-450 font-semibold">Started: {assessReport.total_candidates}</span>
                    </div>
                  </div>
                  <div className="bg-white border border-border p-5 rounded-card shadow-sm">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Pass / Fail</span>
                    <div className="flex items-baseline gap-1.5">
                      <h3 className="text-2xl font-extrabold text-slate-800">{assessReport.passed_count} / {assessReport.failed_count}</h3>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-border p-6 rounded-card shadow-sm">
                  <h3 className="font-bold text-dark text-sm border-b border-border pb-3 mb-4">Security Incident Infractions Breakdown</h3>
                  {Object.keys(assessReport.violations_summary).length === 0 ? (
                    <p className="text-slate-400 text-xs py-4 text-center">No proctoring violations recorded for this assessment. Complete integrity achieved.</p>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {Object.entries(assessReport.violations_summary).map(([type, count]: any) => (
                        <div key={type} className="bg-slate-50 border border-slate-150 p-4 rounded-xl text-center">
                          <span className="text-[9px] text-slate-455 font-bold uppercase block mb-1">{type.replace('_', ' ')}</span>
                          <span className="text-2xl font-extrabold text-rose-500">{count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-white border border-border rounded-card shadow-sm overflow-hidden flex flex-col">
                  <div className="p-6 border-b border-border bg-slate-50/50 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
                    <div className="text-left">
                      <h3 className="font-bold text-dark text-sm">Individual Candidate Performance Registry</h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">Audit candidate score receipts and proctoring telemetry data</p>
                    </div>
                    <div className="flex items-center gap-3 self-end md:self-auto">
                      <button
                        onClick={() => downloadCSV(`/api/reports/assessment/${selectedAssessId}/csv`, `bulk_report_assessment_${selectedAssessId}.csv`)}
                        className="inline-flex items-center gap-1.5 h-9 px-4 bg-indigo-600 hover:bg-indigo-550 text-white rounded-btn text-[10px] font-bold transition-all shadow-md shadow-indigo-600/10 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" /> Bulk Download CSV
                      </button>
                      <div className="relative max-w-xs w-full">
                        <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search candidates by name or email..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-full h-9 pl-9 pr-4 bg-white border border-slate-200 rounded-input text-xs focus:border-indigo-500 focus:outline-none transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    {!assessReport.attempts || assessReport.attempts.length === 0 ? (
                      <p className="text-slate-400 text-xs py-8 text-center">No individual attempts recorded for this assessment.</p>
                    ) : (
                      (() => {
                        const filteredAttempts = assessReport.attempts.filter((a: any) =>
                          a.candidate_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          a.email?.toLowerCase().includes(searchTerm.toLowerCase())
                        );

                        if (filteredAttempts.length === 0) {
                          return <p className="text-slate-400 text-xs py-8 text-center">No matches found for "{searchTerm}"</p>;
                        }

                        return (
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="border-b border-border bg-slate-50/50 text-slate-500 font-bold uppercase tracking-wider">
                                <th className="px-6 py-3.5">Candidate</th>
                                <th className="px-6 py-3.5">Status</th>
                                <th className="px-6 py-3.5">Score</th>
                                <th className="px-6 py-3.5">Result</th>
                                <th className="px-6 py-3.5">Violations</th>
                                <th className="px-6 py-3.5 text-center">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {filteredAttempts.map((a: any) => {
                                let statusColor = 'bg-slate-100 text-slate-600 border-slate-200';
                                if (a.status === 'completed') statusColor = 'bg-emerald-50 text-emerald-600 border-emerald-100';
                                else if (a.status === 'active') statusColor = 'bg-indigo-50 text-indigo-700 border-indigo-150';
                                else if (a.status === 'terminated') statusColor = 'bg-rose-50 text-rose-600 border-rose-100';

                                return (
                                  <tr key={a.attempt_id} className="hover:bg-slate-50/30 transition-colors">
                                    <td className="px-6 py-4 text-left">
                                      <div className="font-bold text-dark">{a.candidate_name}</div>
                                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">{a.email}</div>
                                    </td>
                                    <td className="px-6 py-4 text-left">
                                      <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold border ${statusColor}`}>
                                        {a.status.toUpperCase()}
                                      </span>
                                    </td>
                                    <td className="px-6 py-4 text-left font-mono">
                                      {a.score !== null ? (
                                        <div>
                                          <span className="font-bold text-dark">{a.score}</span>
                                          <span className="text-[10px] text-slate-450 ml-1">({Math.round(a.percentage)}%)</span>
                                        </div>
                                      ) : (
                                        <span className="text-slate-400">-</span>
                                      )}
                                    </td>
                                    <td className="px-6 py-4 text-left">
                                      {a.status === 'completed' ? (
                                        a.passed ? (
                                          <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-md font-bold text-[9px] uppercase">Pass</span>
                                        ) : (
                                          <span className="px-2 py-0.5 bg-rose-50 border border-rose-200 text-rose-600 rounded-md font-bold text-[9px] uppercase">Fail</span>
                                        )
                                      ) : (
                                        <span className="text-slate-400 font-mono">-</span>
                                      )}
                                    </td>
                                    <td className="px-6 py-4 text-left">
                                      {a.violation_count > 0 ? (
                                        <span className="font-bold text-rose-500">{a.violation_count} warning{a.violation_count !== 1 ? 's' : ''}</span>
                                      ) : (
                                        <span className="text-slate-455">0 violations</span>
                                      )}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                      <div className="flex items-center justify-center gap-2">
                                        <a
                                          href={`/report/${a.attempt_id}`}
                                          className="inline-flex items-center gap-1 h-7 px-3 border border-slate-200 hover:border-indigo-300 text-slate-500 hover:text-indigo-650 hover:bg-indigo-50 rounded-lg transition-all font-semibold text-[10px]"
                                        >
                                          <ExternalLink className="w-3 h-3" /> Audit
                                        </a>
                                        {a.status === 'completed' && (
                                          <button
                                            onClick={() => downloadCSV(`/api/reports/attempt/${a.attempt_id}/csv`, `attempt_report_${a.candidate_name.toLowerCase().replace(/ /g, '_')}_${a.attempt_id}.csv`)}
                                            className="inline-flex items-center justify-center h-7 w-7 border border-slate-200 hover:border-indigo-350 text-slate-500 hover:text-indigo-650 hover:bg-indigo-50 rounded-lg transition-all cursor-pointer"
                                            title="Download Attempt CSV Report"
                                          >
                                            <Download className="w-3 h-3" />
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        );
                      })()
                    )}
                  </div>
                </div>
              </div>
            )}

            {instReport && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                  <div className="bg-white border border-border p-5 rounded-card shadow-sm">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1 font-semibold">Registered Examinees</span>
                    <h3 className="text-2xl font-extrabold text-slate-800">{instReport.total_registered_candidates}</h3>
                  </div>
                  <div className="bg-white border border-border p-5 rounded-card shadow-sm">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1 font-semibold">Total Attempts</span>
                    <h3 className="text-2xl font-extrabold text-slate-800">{instReport.total_exam_attempts}</h3>
                  </div>
                  <div className="bg-white border border-border p-5 rounded-card shadow-sm">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1 font-semibold">Completed Exams</span>
                    <h3 className="text-2xl font-extrabold text-slate-800">{instReport.completed_exams}</h3>
                  </div>
                  <div className="bg-white border border-border p-5 rounded-card shadow-sm">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1 font-semibold">Average Pass Rate</span>
                    <h3 className="text-2xl font-extrabold text-indigo-650">{Math.round(instReport.pass_rate_percentage)}%</h3>
                  </div>
                </div>

                <div className="bg-white border border-border rounded-card shadow-sm overflow-hidden flex flex-col">
                  <div className="p-6 border-b border-border bg-slate-50/50 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
                    <div className="text-left">
                      <h3 className="font-bold text-dark text-sm">Institute Examinee Directory</h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">Performance index and integrity analysis for candidates registered in this institute</p>
                    </div>
                    <div className="flex items-center gap-3 self-end md:self-auto">
                      <button
                        onClick={() => downloadCSV(`/api/reports/institute/${selectedInstId}/csv`, `bulk_report_institute_${selectedInstId}.csv`)}
                        className="inline-flex items-center gap-1.5 h-9 px-4 bg-indigo-600 hover:bg-indigo-550 text-white rounded-btn text-[10px] font-bold transition-all shadow-md shadow-indigo-600/10 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" /> Bulk Download CSV
                      </button>
                      <div className="relative max-w-xs w-full">
                        <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search examinees by name or email..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-full h-9 pl-9 pr-4 bg-white border border-slate-200 rounded-input text-xs focus:border-indigo-500 focus:outline-none transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    {!instReport.candidates || instReport.candidates.length === 0 ? (
                      <p className="text-slate-400 text-xs py-8 text-center">No candidates registered under this institute.</p>
                    ) : (
                      (() => {
                        const filteredCandidates = instReport.candidates.filter((c: any) =>
                          c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          c.email?.toLowerCase().includes(searchTerm.toLowerCase())
                        );

                        if (filteredCandidates.length === 0) {
                          return <p className="text-slate-400 text-xs py-8 text-center">No matches found for "{searchTerm}"</p>;
                        }

                        return (
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="border-b border-border bg-slate-50/50 text-slate-500 font-bold uppercase tracking-wider">
                                <th className="px-6 py-3.5">Examinee</th>
                                <th className="px-6 py-3.5 text-center">Total/Completed Attempts</th>
                                <th className="px-6 py-3.5 text-center">Avg. Percentage</th>
                                <th className="px-6 py-3.5 text-center">Security Warning Audits</th>
                                <th className="px-6 py-3.5">Attempt Logs & Telemetry Audit Links</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {filteredCandidates.map((c: any) => (
                                <tr key={c.candidate_id} className="hover:bg-slate-50/30 transition-colors">
                                  <td className="px-6 py-4 text-left">
                                    <div className="font-bold text-dark">{c.name}</div>
                                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">{c.email}</div>
                                  </td>
                                  <td className="px-6 py-4 text-center font-semibold text-slate-700">
                                    {c.total_attempts} / {c.completed_attempts}
                                  </td>
                                  <td className="px-6 py-4 text-center font-mono">
                                    {c.completed_attempts > 0 ? (
                                      <span className="font-bold text-indigo-600">{Math.round(c.avg_percentage)}%</span>
                                    ) : (
                                      <span className="text-slate-400">-</span>
                                    )}
                                  </td>
                                  <td className="px-6 py-4 text-center">
                                    {c.total_violations > 0 ? (
                                      <span className="font-bold text-rose-500 px-2 py-0.5 bg-rose-50 border border-rose-100 rounded-full text-[10px]">
                                        {c.total_violations} warning{c.total_violations !== 1 ? 's' : ''}
                                      </span>
                                    ) : (
                                      <span className="text-slate-455">0 violations</span>
                                    )}
                                  </td>
                                  <td className="px-6 py-4 text-left">
                                    {c.attempts && c.attempts.length > 0 ? (
                                      <div className="flex flex-wrap gap-2">
                                        {c.attempts.map((a: any) => {
                                          let badgeColor = 'bg-slate-100 text-slate-600 border-slate-200';
                                          if (a.status === 'completed') {
                                            badgeColor = a.passed
                                              ? 'bg-emerald-50 text-emerald-700 border-emerald-150'
                                              : 'bg-rose-50 text-rose-700 border-rose-150';
                                          } else if (a.status === 'active') {
                                            badgeColor = 'bg-indigo-50 text-indigo-700 border-indigo-150';
                                          }

                                          return (
                                            <div key={a.attempt_id} className="flex items-center gap-1">
                                              <a
                                                href={`/report/${a.attempt_id}`}
                                                className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold border hover:opacity-85 transition-opacity ${badgeColor}`}
                                                title={`Audit attempt telemetry of ${a.assessment_name}`}
                                              >
                                                <span className="truncate max-w-[120px]">{a.assessment_name}</span>
                                                <span className="font-mono">
                                                  {a.status === 'completed'
                                                    ? `(${Math.round(a.percentage)}%)`
                                                    : `(${a.status})`}
                                                </span>
                                                <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                                              </a>
                                              {a.status === 'completed' && (
                                                <button
                                                  onClick={() => downloadCSV(`/api/reports/attempt/${a.attempt_id}/csv`, `attempt_report_${c.name.toLowerCase().replace(/ /g, '_')}_${a.attempt_id}.csv`)}
                                                  className="inline-flex items-center justify-center h-6 w-6 border border-slate-200 hover:border-indigo-305 text-slate-500 hover:text-indigo-650 hover:bg-indigo-50 rounded-md transition-all cursor-pointer bg-white"
                                                  title="Download Attempt CSV"
                                                >
                                                  <Download className="w-2.5 h-2.5" />
                                                </button>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    ) : (
                                      <span className="text-slate-400 text-[10px]">No session attempts yet</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        );
                      })()
                    )}
                  </div>
                </div>
              </div>
            )}

            {!assessReport && !instReport && (
              <div className="bg-white border border-border p-8 rounded-card shadow-sm text-center text-slate-400 text-xs">
                Select an Assessment or Institute above to load detailed analytical summaries.
              </div>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
};

export default Reports;
