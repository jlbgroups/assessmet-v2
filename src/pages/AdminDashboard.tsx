import React, { useEffect, useState } from 'react';
import {
  School,
  GraduationCap,
  Users,
  CheckCircle2,
  ShieldAlert,
  TrendingUp,
  AlertTriangle,
  Plus,
  Trash2
} from 'lucide-react';
import { apiFetch } from '../utils/api';
import AdminLayout from '../components/AdminLayout';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

export const AdminDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assessmentsList, setAssessmentsList] = useState<any[]>([]);
  const [institutesList, setInstitutesList] = useState<any[]>([]);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState('');
  const [selectedInstituteId, setSelectedInstituteId] = useState('');
  const [assignStartDate, setAssignStartDate] = useState('');
  const [assignEndDate, setAssignEndDate] = useState('');
  const [assignRole, setAssignRole] = useState('');
  const [assignJobTitle, setAssignJobTitle] = useState('');
  const [submittingAssign, setSubmittingAssign] = useState(false);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const summary = await apiFetch('/api/reports/admin/summary');
        setData(summary);
      } catch (err: any) {
        setError(err.message || 'Failed to load system metrics summary');
      } finally {
        setLoading(false);
      }
    };
    fetchSummary();

    const fetchDropdowns = async () => {
      try {
        const assessments = await apiFetch('/api/assessments');
        const institutes = await apiFetch('/api/institutes');
        setAssessmentsList(assessments);
        setInstitutesList(institutes);
      } catch (err) {
        console.error('Failed to load assignment dropdown options', err);
      }
    };
    fetchDropdowns();
  }, []);

  const handleAssignTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssessmentId || !selectedInstituteId || !assignStartDate || !assignEndDate) {
      alert('Please select assessment, institute, and schedule window.');
      return;
    }
    setSubmittingAssign(true);
    try {
      await apiFetch(`/api/assessments/${selectedAssessmentId}/assign`, {
        method: 'POST',
        body: JSON.stringify({
          institute_id: parseInt(selectedInstituteId),
          start_date: new Date(assignStartDate).toISOString(),
          end_date: new Date(assignEndDate).toISOString(),
          role: assignRole,
          job_title: assignJobTitle
        })
      });
      const summary = await apiFetch('/api/reports/admin/summary');
      setData(summary);
      setShowAssignModal(false);
      setSelectedAssessmentId('');
      setSelectedInstituteId('');
      setAssignStartDate('');
      setAssignEndDate('');
      setAssignRole('');
      setAssignJobTitle('');
      alert('Test successfully assigned to institute!');
    } catch (err: any) {
      alert(err.message || 'Failed to assign test');
    } finally {
      setSubmittingAssign(false);
    }
  };

  const handleDeassignTest = async (assignmentId: number) => {
    if (!window.confirm('Are you sure you want to de-assign/remove this test from the institute? Candidates from this institute will no longer be able to start this exam.')) {
      return;
    }
    try {
      await apiFetch(`/api/assessments/assignments/${assignmentId}`, {
        method: 'DELETE'
      });
      const summary = await apiFetch('/api/reports/admin/summary');
      setData(summary);
      alert('Assignment successfully removed.');
    } catch (err: any) {
      alert(err.message || 'Failed to remove assignment');
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[500px]">
          <div className="text-slate-500 font-semibold text-sm">Synchronizing operations telemetry...</div>
        </div>
      </AdminLayout>
    );
  }

  if (error || !data) {
    return (
      <AdminLayout>
        <div className="p-6 bg-rose-50/50 border border-rose-100 text-rose-600 rounded-card text-sm font-semibold">
          Error: {error || 'No telemetry data received'}
        </div>
      </AdminLayout>
    );
  }

  const { metrics, violation_trends, activity_trends, assignments = [] } = data;

  const kpis = [
    { name: 'Total Institutes', value: metrics.total_institutes, icon: School, color: 'text-[#c95b2f]', bg: 'bg-[#fff6ee] border-[#c95b2f]/10' },
    { name: 'Total Assessments', value: metrics.total_assessments, icon: GraduationCap, color: 'text-[#176b68]', bg: 'bg-[#f0f7f6] border-[#176b68]/10' },
    { name: 'Active Candidates', value: metrics.active_candidates, icon: Users, color: 'text-[#d5a24c]', bg: 'bg-[#fffaf5] border-[#d5a24c]/10' },
    { name: 'Completed Tests', value: metrics.completed_tests, icon: CheckCircle2, color: 'text-[#10222d]', bg: 'bg-[#f4efe6] border-[#10222d]/8' },
    { name: 'Violations Today', value: metrics.violations_today, icon: ShieldAlert, color: 'text-rose-600', bg: 'bg-rose-50 border-rose-100' },
  ];

  const activityChartData = {
    labels: activity_trends.map((t: any) => t.day),
    datasets: [
      {
        label: 'Sessions Initiated',
        data: activity_trends.map((t: any) => t.attempts),
        backgroundColor: '#176b68',
        borderRadius: 6,
      },
    ],
  };

  const activityChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1,
        },
      },
    },
  };

  const violationChartData = {
    labels: violation_trends.map((t: any) => t.date.substring(5)),
    datasets: [
      {
        label: 'Total Incidents',
        data: violation_trends.map((t: any) => t.count),
        borderColor: '#c95b2f',
        backgroundColor: 'rgba(201, 91, 47, 0.1)',
        tension: 0.2,
        fill: true,
        borderWidth: 2,
        pointBackgroundColor: '#c95b2f',
      },
    ],
  };

  const violationChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1,
        },
      },
    },
  };

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div className="flex justify-between items-center bg-[#10222d] text-white p-6 rounded-card shadow-lg border border-[#10222d]/8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-[#c95b2f]/10 rounded-full filter blur-[60px]"></div>
          <div>
            <h2 className="text-xl font-bold text-white mb-1 font-display">Assessment Operations Center</h2>
            <p className="text-xs text-[#c7d5da]">Security monitoring telemetry and candidate analytics interface</p>
          </div>
          <div className="flex gap-4">
            <div className="text-right">
              <span className="text-[10px] text-[#8a7863] font-bold block uppercase tracking-wider">Active Feeds</span>
              <span className="text-sm font-semibold text-emerald-400">{metrics.active_candidates} Webcams</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-5">
          {kpis.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <div
                key={kpi.name}
                className="bg-white border border-border p-5 rounded-card flex flex-col justify-between shadow-sm hover:shadow-md transition-all duration-200"
              >
                <div className="flex justify-between items-start mb-3">
                  <span className="text-xs font-semibold text-slate-500 leading-snug">{kpi.name}</span>
                  <div className={`p-2 rounded-xl ${kpi.bg}`}>
                    <Icon className={`w-5 h-5 ${kpi.color}`} />
                  </div>
                </div>
                <div>
                  <h3 className="text-3xl font-bold tracking-tight text-dark">{kpi.value}</h3>
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-border p-6 rounded-card shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="font-bold text-dark text-base">Daily Examination Volume</h3>
                <p className="text-xs text-slate-400">Attempts initiated across last 7-day period</p>
              </div>
              <span className="text-xs text-slate-400 flex items-center gap-1 font-semibold">
                <TrendingUp className="w-4 h-4 text-primary" /> Active Load
              </span>
            </div>
            <div className="h-64 relative">
              <Bar data={activityChartData} options={activityChartOptions} />
            </div>
          </div>

          <div className="bg-white border border-border p-6 rounded-card shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="font-bold text-dark text-base">Recorded Violation Trends</h3>
                <p className="text-xs text-slate-400">Total suspicious activity events logged</p>
              </div>
              <span className="text-xs text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-100 flex items-center gap-1 font-semibold">
                <AlertTriangle className="w-3.5 h-3.5" /> High Risk
              </span>
            </div>
            <div className="h-64 relative">
              <Line data={violationChartData} options={violationChartOptions} />
            </div>
          </div>
        </div>

        <div className="bg-white border border-border rounded-card shadow-sm p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="font-bold text-dark text-base">Distributed Test Assignments</h3>
              <p className="text-xs text-slate-400">Active mapping of exam instances to partner institutions</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full">
                {assignments.length} {assignments.length === 1 ? 'Assignment' : 'Assignments'}
              </span>
              <button
                onClick={() => {
                  setAssignRole('');
                  setAssignJobTitle('');
                  setShowAssignModal(true);
                }}
                className="h-8 px-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-btn text-xs font-bold transition-all shadow-md shadow-indigo-600/10 flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Assign Exam
              </button>
            </div>
          </div>

          {assignments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-slate-200 rounded-card bg-slate-50/50">
              <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                <GraduationCap className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-slate-700 text-sm mb-1">No Active Deployments</h4>
              <p className="text-xs text-slate-400 text-center max-w-sm mb-4">
                No tests have been assigned to any institute yet. You can assign tests right here or in the Assessments tab.
              </p>
              <button
                onClick={() => {
                  setAssignRole('');
                  setAssignJobTitle('');
                  setShowAssignModal(true);
                }}
                className="px-4 py-2 bg-primary hover:bg-indigo-700 text-white rounded-btn text-xs font-bold transition-all shadow-md shadow-indigo-600/10"
              >
                Assign Exam Now
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="pb-3 font-semibold">Assessment</th>
                    <th className="pb-3 font-semibold">Target Hub / Institute</th>
                    <th className="pb-3 font-semibold text-center">Type</th>
                    <th className="pb-3 font-semibold text-center">Schedule Window</th>
                    <th className="pb-3 font-semibold text-center">Deployment Status</th>
                    <th className="pb-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-xs">
                  {assignments.map((item: any) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 pr-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                            <GraduationCap className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-bold text-dark block">{item.assessment_name}</span>
                            <div className="flex flex-col gap-0.5 mt-0.5">
                              <span className="text-[10px] text-slate-400">ID: #{item.assessment_id}</span>
                              {(item.role || item.job_title) && (
                                <span className="text-[10px] text-indigo-600 font-semibold bg-indigo-50 border border-indigo-100/50 px-1.5 py-0.5 rounded-md inline-block w-fit">
                                  {item.role || '-'}{item.job_title ? ` (${item.job_title})` : ''}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 pr-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center text-sky-600">
                            <School className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-semibold text-slate-700 block">{item.institute_name}</span>
                            <span className="text-[10px] text-slate-400">ID: #{item.institute_id}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 pr-4 text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                          Institutional
                        </span>
                      </td>
                      <td className="py-4 pr-4 text-center text-[10px] font-semibold text-slate-500">
                        {item.start_date && item.end_date ? (
                          <span>
                            {new Date(item.start_date).toLocaleDateString()} - {new Date(item.end_date).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-4 pr-4 text-center">
                        <div className="inline-flex items-center gap-2 justify-center">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          <span className="font-semibold text-emerald-600">Active</span>
                        </div>
                      </td>
                      <td className="py-4 text-right">
                        <button
                          onClick={() => handleDeassignTest(item.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                          title="De-assign exam"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {metrics.active_candidates > 0 && (
          <div className="flex items-center justify-between bg-amber-50 border border-amber-200 p-5 rounded-card">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-amber-800 text-sm">Active Examination Sessions Running</h4>
                <p className="text-xs text-amber-600 mt-0.5">There are currently {metrics.active_candidates} candidates taking exams. Open the monitor grid immediately.</p>
              </div>
            </div>
            <a
              href="/admin/proctoring"
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-btn text-xs font-bold transition-all shadow-md shadow-amber-600/10"
            >
              Open Live Proctoring
            </a>
          </div>
        )}

        {showAssignModal && (
          <div className="fixed inset-0 bg-[#10222d]/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-[#f4efe6] border border-white/80 p-6 rounded-card max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 text-[#10222d]">
              <div className="flex justify-between items-center border-b border-[#10222d]/10 pb-3.5 mb-5">
                <h3 className="font-bold text-[#10222d] text-sm font-display">Assign Exam to Institute</h3>
                <button
                  onClick={() => {
                    setShowAssignModal(false);
                    setSelectedAssessmentId('');
                    setSelectedInstituteId('');
                    setAssignRole('');
                    setAssignJobTitle('');
                  }}
                  className="text-slate-400 hover:text-[#10222d] font-bold text-base"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleAssignTest} className="space-y-4">
                <div className="space-y-1.5 text-left">
                  <label className="text-[10px] font-bold text-[#5f6c73] uppercase tracking-wider block">Select Assessment</label>
                  <select
                    value={selectedAssessmentId}
                    onChange={(e) => setSelectedAssessmentId(e.target.value)}
                    required
                    className="w-full h-10 bg-white border border-[#10222d]/10 rounded-input px-3 text-xs text-[#10222d] focus:border-[#c95b2f] focus:outline-none focus:ring-4 focus:ring-[#c95b2f]/10 transition-all cursor-pointer"
                  >
                    <option value="" className="bg-[#f4efe6] text-slate-400">-- Choose Test --</option>
                    {assessmentsList.map((a) => (
                      <option key={a.id} value={a.id} className="bg-[#f4efe6] text-[#10222d]">{a.name} (ID: #{a.id})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5 text-left">
                  <label className="text-[10px] font-bold text-[#5f6c73] uppercase tracking-wider block">Select Target Hub / Institute</label>
                  <select
                    value={selectedInstituteId}
                    onChange={(e) => setSelectedInstituteId(e.target.value)}
                    required
                    className="w-full h-10 bg-white border border-[#10222d]/10 rounded-input px-3 text-xs text-[#10222d] focus:border-[#c95b2f] focus:outline-none focus:ring-4 focus:ring-[#c95b2f]/10 transition-all cursor-pointer"
                  >
                    <option value="" className="bg-[#f4efe6] text-slate-400">-- Choose Institute --</option>
                    {institutesList.map((inst) => (
                      <option key={inst.id} value={inst.id} className="bg-[#f4efe6] text-[#10222d]">{inst.name} (Code: {inst.code})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5 text-left">
                    <label className="text-[10px] font-bold text-[#5f6c73] uppercase tracking-wider block">Target Role</label>
                    <input
                      type="text"
                      placeholder="e.g. Developer"
                      value={assignRole}
                      onChange={(e) => setAssignRole(e.target.value)}
                      className="w-full h-10 bg-white border border-[#10222d]/10 rounded-input px-3 text-xs text-[#10222d] focus:border-[#c95b2f] focus:outline-none focus:ring-4 focus:ring-[#c95b2f]/10 transition-all placeholder-slate-400"
                    />
                  </div>
                  <div className="space-y-1.5 text-left">
                    <label className="text-[10px] font-bold text-[#5f6c73] uppercase tracking-wider block">Job Title</label>
                    <input
                      type="text"
                      placeholder="e.g. Senior Frontend Engineer"
                      value={assignJobTitle}
                      onChange={(e) => setAssignJobTitle(e.target.value)}
                      className="w-full h-10 bg-white border border-[#10222d]/10 rounded-input px-3 text-xs text-[#10222d] focus:border-[#c95b2f] focus:outline-none focus:ring-4 focus:ring-[#c95b2f]/10 transition-all placeholder-slate-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5 text-left">
                    <label className="text-[10px] font-bold text-[#5f6c73] uppercase tracking-wider block">Start Window</label>
                    <input
                      type="datetime-local"
                      required
                      value={assignStartDate}
                      onChange={(e) => setAssignStartDate(e.target.value)}
                      className="w-full h-10 bg-white border border-[#10222d]/10 rounded-input px-3 text-xs text-[#10222d] focus:border-[#c95b2f] focus:outline-none focus:ring-4 focus:ring-[#c95b2f]/10 transition-all"
                    />
                  </div>
                  <div className="space-y-1.5 text-left">
                    <label className="text-[10px] font-bold text-[#5f6c73] uppercase tracking-wider block">End Window</label>
                    <input
                      type="datetime-local"
                      required
                      value={assignEndDate}
                      onChange={(e) => setAssignEndDate(e.target.value)}
                      className="w-full h-10 bg-white border border-[#10222d]/10 rounded-input px-3 text-xs text-[#10222d] focus:border-[#c95b2f] focus:outline-none focus:ring-4 focus:ring-[#c95b2f]/10 transition-all"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t border-[#10222d]/10">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAssignModal(false);
                      setSelectedAssessmentId('');
                      setSelectedInstituteId('');
                      setAssignRole('');
                      setAssignJobTitle('');
                    }}
                    className="flex-1 h-10 border border-[#10222d]/10 text-[#5f6c73] rounded-btn text-xs font-semibold hover:bg-white hover:text-[#10222d] transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingAssign}
                    className="flex-1 h-10 bg-[#c95b2f] hover:bg-[#b24c25] text-white rounded-btn text-xs font-bold transition-all shadow-md shadow-[#c95b2f]/10 flex items-center justify-center"
                  >
                    {submittingAssign ? 'Assigning...' : 'Assign Test'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};
export default AdminDashboard;
