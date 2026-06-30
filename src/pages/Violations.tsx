import React, { useEffect, useState, useMemo } from 'react';
import { ShieldAlert, Search, Filter, Calendar, Eye, AlertTriangle } from 'lucide-react';
import { apiFetch, parseUTCDate } from '../utils/api';
import AdminLayout from '../components/AdminLayout';

export const Violations: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [violations, setViolations] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [loadingImage, setLoadingImage] = useState(false);

  const [activeCandidateId, setActiveCandidateId] = useState<number | null>(null);
  const [activeCandidateName, setActiveCandidateName] = useState<string>('');
  const [activeCandidateViolations, setActiveCandidateViolations] = useState<any[]>([]);
  const [violationsPage, setViolationsPage] = useState(1);
  const [violationsTotal, setViolationsTotal] = useState(0);
  const [loadingCandidateViolations, setLoadingCandidateViolations] = useState(false);

  const fetchViolations = async () => {
    try {
      const data = await apiFetch('/api/proctoring/violations');
      setViolations(data.reverse());
    } catch (err: any) {
      setError(err.message || 'Failed to sync violations log database');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchViolations();
  }, []);

  const fetchCandidateViolations = async (candidateId: number, page: number, append: boolean = false) => {
    setLoadingCandidateViolations(true);
    try {
      const data = await apiFetch(`/api/proctoring/violations/candidate/${candidateId}?page=${page}&limit=25`);
      if (append) {
        setActiveCandidateViolations(prev => [...prev, ...data.results]);
      } else {
        setActiveCandidateViolations(data.results);
      }
      setViolationsTotal(data.total);
      setViolationsPage(page);
    } catch (err: any) {
      alert(err.message || 'Failed to fetch candidate violations');
    } finally {
      setLoadingCandidateViolations(false);
    }
  };

  const handleCandidateClick = (candidateId: number, name: string) => {
    setActiveCandidateId(candidateId);
    setActiveCandidateName(name);
    setActiveCandidateViolations([]);
    setViolationsTotal(0);
    fetchCandidateViolations(candidateId, 1, false);
  };

  const handleLoadMoreViolations = () => {
    if (activeCandidateId) {
      fetchCandidateViolations(activeCandidateId, violationsPage + 1, true);
    }
  };

  const handleViewScreenshot = async (violationId: number) => {
    setLoadingImage(true);
    try {
      const res = await apiFetch(`/api/proctoring/violations/${violationId}/image`);
      if (res && res.url) {
        setSelectedImage(res.url);
      } else {
        alert('No URL returned for this screenshot');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to retrieve temporary secure access URL for screenshot.');
    } finally {
      setLoadingImage(false);
    }
  };

  const filteredViolations = useMemo(() => {
    return violations.filter(v => {
      const matchesSearch =
        v.candidate_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.assessment_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (v.details && v.details.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesType = typeFilter ? v.type === typeFilter : true;
      const matchesSeverity = severityFilter ? v.severity === severityFilter : true;

      return matchesSearch && matchesType && matchesSeverity;
    });
  }, [violations, searchTerm, typeFilter, severityFilter]);

  const groupedCandidates = useMemo(() => {
    return Array.from(
      filteredViolations.reduce((acc, current) => {
        const key = current.candidate_id || current.candidate_name;
        if (!acc.has(key)) {
          acc.set(key, {
            id: current.id,
            candidate_id: current.candidate_id,
            candidate_name: current.candidate_name,
            institute_name: current.institute_name,
            violation_count: 0,
            latest_timestamp: current.timestamp,
            latest_details: current.details || current.type.replace('_', ' '),
            latest_severity: current.severity,
            latest_screenshot: current.screenshot_url,
            assessment_name: current.assessment_name,
          });
        }
        const existing = acc.get(key);
        existing.violation_count += 1;
        if (new Date(current.timestamp) > new Date(existing.latest_timestamp)) {
          existing.id = current.id;
          existing.latest_timestamp = current.timestamp;
          existing.latest_details = current.details || current.type.replace('_', ' ');
          existing.latest_severity = current.severity;
          existing.latest_screenshot = current.screenshot_url;
          existing.assessment_name = current.assessment_name;
        }
        return acc;
      }, new Map<any, any>()).values()
    );
  }, [filteredViolations]);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center bg-white border border-border p-6 rounded-card shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-dark">Violation Telemetry Log</h2>
              <p className="text-xs text-slate-400">Review, audit, and analyze recorded academic integrity incidents</p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-border p-5 rounded-card shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-450" />
            <input
              type="text"
              placeholder="Search by candidate, assessment, details..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-10 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-input text-xs focus:bg-white focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full h-10 bg-slate-50 border border-slate-200 rounded-input px-3 text-xs focus:bg-white focus:outline-none"
            >
              <option value="">All Violation Types</option>
              <option value="no_face">No Face Detected</option>
              <option value="multiple_faces">Multiple Faces Detected</option>
              <option value="mobile_phone">Mobile Phone Usage</option>
              <option value="voice">Voice Detection Threshold Exceeded</option>
              <option value="tab_switch">Tab Switched</option>
              <option value="fullscreen_exit">Exited Fullscreen</option>
            </select>
          </div>

          <div>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="w-full h-10 bg-slate-50 border border-slate-200 rounded-input px-3 text-xs focus:bg-white focus:outline-none"
            >
              <option value="">All Severities</option>
              <option value="low">Low Severity</option>
              <option value="medium">Medium Severity</option>
              <option value="high">High Severity</option>
              <option value="critical">Critical Severity</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-card text-xs font-semibold">
            {error}
          </div>
        )}

        <div className="bg-white border border-border rounded-card shadow-sm overflow-hidden">
          {loading ? (
            <div className="text-center py-12 text-slate-500 text-xs font-semibold">
              Loading incident audit databases...
            </div>
          ) : groupedCandidates.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              No recorded violations match the filter options.
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
                  <th className="px-6 py-4">Examinee Name</th>
                  <th className="px-6 py-4">Institute Name</th>
                  <th className="px-6 py-4">Latest Assessment</th>
                  <th className="px-6 py-4">Latest Incident</th>
                  <th className="px-6 py-4">Latest Timestamp</th>
                  <th className="px-6 py-4 text-center">Severity</th>
                  <th className="px-6 py-4 text-center">Total Incidents</th>
                  <th className="px-6 py-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {groupedCandidates.map((v: any) => {
                  let sevColor = 'bg-slate-100 border-slate-200 text-slate-600';
                  if (v.latest_severity === 'low') sevColor = 'bg-emerald-50 border-emerald-100 text-emerald-600';
                  if (v.latest_severity === 'medium') sevColor = 'bg-amber-50 border-amber-100 text-amber-600';
                  if (v.latest_severity === 'high') sevColor = 'bg-orange-50 border-orange-100 text-orange-600';
                  if (v.latest_severity === 'critical') sevColor = 'bg-rose-50 border-rose-100 text-rose-600';

                  return (
                    <tr key={v.candidate_id || v.candidate_name} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-bold text-dark text-sm">
                        {v.candidate_name}
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-600">
                        {v.institute_name || 'Direct to Candidates'}
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-700">
                        {v.assessment_name}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-700">
                        {v.latest_details}
                      </td>
                      <td className="px-6 py-4 text-slate-500 font-medium">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {parseUTCDate(v.latest_timestamp).toLocaleDateString()} {parseUTCDate(v.latest_timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[9px] font-bold border ${sevColor}`}>
                          {v.latest_severity.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center font-bold text-slate-700 text-sm">
                        {v.violation_count}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {v.latest_screenshot ? (
                            <button
                              onClick={() => handleViewScreenshot(v.id)}
                              disabled={loadingImage}
                              className="p-1.5 border border-slate-200 text-slate-500 hover:text-indigo-650 hover:bg-indigo-50 rounded-lg transition-all disabled:opacity-50 cursor-pointer"
                              title="View Latest Screenshot"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          ) : (
                            <span className="text-slate-400 font-mono text-[9px]">-</span>
                          )}
                          <button
                            onClick={() => handleCandidateClick(v.candidate_id, v.candidate_name)}
                            disabled={!v.candidate_id}
                            className="inline-flex items-center justify-center h-8 px-3 border border-indigo-200 hover:border-indigo-300 hover:bg-indigo-50 text-indigo-600 rounded-lg transition-all font-semibold text-[10px] cursor-pointer disabled:opacity-50 disabled:hover:bg-transparent"
                            title="See all violations for this candidate"
                          >
                            See All Violations
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {activeCandidateId && (
          <div className="fixed inset-0 bg-slate-950/45 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white border border-border w-full max-w-4xl rounded-card shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
              <div className="px-6 py-4 border-b border-border bg-slate-50 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-rose-500" />
                  <h3 className="font-bold text-dark text-sm">
                    Violations Registry: {activeCandidateName}
                  </h3>
                  <span className="text-[10px] font-bold bg-rose-50 text-rose-600 px-2 py-0.5 rounded-full border border-rose-200">
                    {violationsTotal} Incidents
                  </span>
                </div>
                <button
                  onClick={() => setActiveCandidateId(null)}
                  className="text-slate-400 hover:text-dark font-bold text-base"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-4 flex-1">
                {activeCandidateViolations.length === 0 && !loadingCandidateViolations ? (
                  <div className="text-center py-12 text-slate-400 text-xs">
                    No violation events logged for this candidate.
                  </div>
                ) : (
                  <div className="border border-border rounded-xl overflow-hidden">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-border bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
                          <th className="px-6 py-3.5">Assessment Name</th>
                          <th className="px-6 py-3.5">Incident Details</th>
                          <th className="px-6 py-3.5">Timestamp</th>
                          <th className="px-6 py-3.5">Severity</th>
                          <th className="px-6 py-3.5 text-center">Screenshot</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {activeCandidateViolations.map((cv) => {
                          let sevColor = 'bg-slate-100 border-slate-200 text-slate-600';
                          if (cv.severity === 'low') sevColor = 'bg-emerald-50 border-emerald-100 text-emerald-600';
                          if (cv.severity === 'medium') sevColor = 'bg-amber-50 border-amber-100 text-amber-600';
                          if (cv.severity === 'high') sevColor = 'bg-orange-50 border-orange-100 text-orange-600';
                          if (cv.severity === 'critical') sevColor = 'bg-rose-50 border-rose-100 text-rose-600';

                          return (
                            <tr key={cv.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-6 py-3.5 font-semibold text-slate-700">{cv.assessment_name}</td>
                              <td className="px-6 py-3.5 font-medium text-slate-700">{cv.details || cv.type.replace('_', ' ')}</td>
                              <td className="px-6 py-3.5 text-slate-500 font-medium">
                                <div className="flex items-center gap-1">
                                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                  {parseUTCDate(cv.timestamp).toLocaleDateString()} {parseUTCDate(cv.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                              </td>
                              <td className="px-6 py-3.5">
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${sevColor}`}>
                                  {cv.severity.toUpperCase()}
                                </span>
                              </td>
                              <td className="px-6 py-3.5 text-center">
                                {cv.screenshot_url ? (
                                  <button
                                    onClick={() => handleViewScreenshot(cv.id)}
                                    disabled={loadingImage}
                                    className="p-1 border border-slate-200 text-slate-500 hover:text-indigo-650 hover:bg-indigo-50 rounded-lg transition-all"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                ) : (
                                  <span className="text-slate-400 font-mono text-[9px]">-</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {loadingCandidateViolations && (
                  <div className="text-center py-4 text-slate-450 font-semibold text-xs animate-pulse">
                    Syncing candidate violation registry logs...
                  </div>
                )}

                {activeCandidateViolations.length < violationsTotal && !loadingCandidateViolations && (
                  <div className="flex justify-center pt-2">
                    <button
                      onClick={handleLoadMoreViolations}
                      className="h-9 px-5 border border-indigo-200 hover:border-indigo-400 text-indigo-600 hover:bg-indigo-50/50 rounded-btn text-xs font-bold transition-all"
                    >
                      Load More
                    </button>
                  </div>
                )}
              </div>

              <div className="px-6 py-4 border-t border-border flex justify-end shrink-0 bg-slate-50">
                <button
                  onClick={() => setActiveCandidateId(null)}
                  className="h-10 px-5 bg-primary hover:bg-indigo-500 text-white rounded-btn text-xs font-bold transition-all shadow-md shadow-indigo-600/10"
                >
                  Close Registry
                </button>
              </div>
            </div>
          </div>
        )}

        {selectedImage && (
          <div className="fixed inset-0 bg-slate-950/45 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white border border-border w-full max-w-xl rounded-card shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="px-6 py-4 border-b border-border bg-slate-50 flex justify-between items-center">
                <h3 className="font-bold text-dark text-sm flex items-center gap-1.5">
                  <AlertTriangle className="w-4.5 h-4.5 text-amber-500" /> Security Snapshot Capture
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
                  alt="Telemetry Infraction Screenshot"
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
    </AdminLayout>
  );
};

export default Violations;
