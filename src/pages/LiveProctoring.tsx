import React, { useEffect, useState, useRef } from 'react';
import {
  Video,
  ShieldAlert,
  Send,
  Pause,
  Play,
  StopCircle,
  UserX,
  VolumeX,
  Volume2,
  Users,
  Activity,
  UserCheck
} from 'lucide-react';
import { apiFetch, getAuthToken, BASE_URL, parseUTCDate } from '../utils/api';
import AdminLayout from '../components/AdminLayout';

export const LiveProctoring: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [violations, setViolations] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [soundEnabled, setSoundEnabled] = useState(true);

  const [showActionModal, setShowActionModal] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<any | null>(null);
  const [warningMessage, setWarningMessage] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);

  const loadInitialData = async () => {
    try {
      const activeData = await apiFetch('/api/proctoring/active-candidates');
      setCandidates(activeData);

      const violationData = await apiFetch('/api/proctoring/violations');
      setViolations(violationData.slice(-15).reverse());
    } catch (err: any) {
      setError(err.message || 'Failed to load proctoring metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();

    const token = getAuthToken();
    if (token) {
      connectWebSocket(token);
    }

    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const connectWebSocket = (authToken: string) => {
    const wsUrl = `ws://localhost:8000/api/proctoring/ws`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'auth_admin',
        token: authToken
      }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === 'candidate_connected') {
          const newCandidate = {
            attempt_id: msg.attempt_id,
            candidate_name: msg.info.name,
            email: msg.info.email,
            assessment_name: msg.info.assessment,
            status: 'active',
            violation_count: 0,
            system_check_passed: true,
            last_active: new Date().toISOString(),
            screenshot_url: ''
          };
          setCandidates(prev => {
            const exists = prev.some(c => c.attempt_id === msg.attempt_id);
            return exists ? prev : [newCandidate, ...prev];
          });
        }

        else if (msg.type === 'candidate_disconnected') {
          setCandidates(prev => prev.map(c =>
            c.attempt_id === msg.attempt_id ? { ...c, status: 'offline' } : c
          ));
        }

        else if (msg.type === 'candidate_heartbeat') {
          setCandidates(prev => prev.map(c =>
            c.attempt_id === msg.attempt_id ? { ...c, last_active: new Date().toISOString() } : c
          ));
        }

        else if (msg.type === 'violation_triggered') {
          const v = msg.violation;
          const isPeriodic = v.type === 'periodic' || v.type === 'screen_periodic';

          if (!isPeriodic && soundEnabled) {
            playAlertSound(v.severity);
          }

          if (!isPeriodic) {
            setViolations(prev => [v, ...prev].slice(0, 30));
          }

          setCandidates(prev => prev.map(c => {
            if (c.attempt_id === v.attempt_id) {
              let nextStatus = c.status;
              const nextCount = c.violation_count + (isPeriodic ? 0 : 1);
              if (nextCount > 0) nextStatus = 'warning';
              if (nextCount >= 4 || v.severity === 'critical') nextStatus = 'critical';

              return {
                ...c,
                violation_count: nextCount,
                status: nextStatus,
                screenshot_url: v.screenshot_url || c.screenshot_url
              };
            }
            return c;
          }));
        }

        else if (msg.type === 'candidate_status_changed') {
          if (msg.status === 'completed' || msg.status === 'terminated') {
            setCandidates(prev => prev.filter(c => c.attempt_id !== msg.attempt_id));
          }
        }

      } catch (err) {
        console.error('Proctoring socket parse error', err);
      }
    };

    ws.onclose = () => {
      setTimeout(() => {
        const nextToken = getAuthToken();
        if (nextToken) connectWebSocket(nextToken);
      }, 5000);
    };
  };

  const playAlertSound = (severity: string) => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (severity === 'critical' || severity === 'high') {
        osc.frequency.setValueAtTime(880, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.15);
      } else {
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
      }
    } catch (err) {
      console.warn('Audio API sound trigger failed', err);
    }
  };

  const handleOpenAction = (c: any) => {
    setSelectedCandidate(c);
    setWarningMessage('');
    setShowActionModal(true);
  };

  const handleSendAction = async (action: string) => {
    if (!selectedCandidate) return;
    setActionLoading(true);

    try {
      const payload: any = { action };
      if (action === 'warning') {
        payload.message = warningMessage || 'Please focus on your examination screen. Avoid unauthorized movement.';
      }

      await apiFetch(`/api/proctoring/control/${selectedCandidate.attempt_id}`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (action === 'warning') {
        alert('Warning message sent to candidate.');
        setShowActionModal(false);
      } else if (action === 'terminate') {
        alert('Examinee session terminated.');
        setShowActionModal(false);
        setCandidates(prev => prev.filter(c => c.attempt_id !== selectedCandidate.attempt_id));
      } else {
        alert(`Action ${action} executed successfully.`);
      }
    } catch (err: any) {
      alert(err.message || 'Action command transmission failed');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center bg-white border border-border p-6 rounded-card shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Video className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-dark">Live Proctoring Dashboard</h2>
              <p className="text-xs text-slate-400">Real-time candidate monitoring and supervisor enforcement panel</p>
            </div>
          </div>
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`h-10 px-4 rounded-btn text-xs font-bold transition-all flex items-center gap-2 border ${soundEnabled
              ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
              : 'bg-slate-50 border-slate-200 text-slate-500'
              }`}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            Audio Alerts: {soundEnabled ? 'ON' : 'MUTED'}
          </button>
        </div>

        {error && (
          <div className="p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-card text-xs font-semibold">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          <div className="lg:col-span-8 bg-white border border-border p-6 rounded-card shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center border-b border-border pb-4 mb-6">
                <h3 className="font-bold text-dark text-sm flex items-center gap-2">
                  <Users className="w-4.5 h-4.5 text-slate-400" /> Active Examinee Feeds ({candidates.length})
                </h3>
                <span className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
              </div>

              {loading && candidates.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs font-semibold">
                  Connecting to active candidate feeds...
                </div>
              ) : candidates.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  No active candidate sessions currently running.
                </div>
              ) : (
                <div className="video-feed-grid">
                  {candidates.map((c) => {
                    let borderClass = 'border-slate-200';
                    let badgeColor = 'bg-emerald-50 border-emerald-100 text-emerald-600';
                    let statusText = 'Monitoring Active';

                    if (c.status === 'warning') {
                      borderClass = 'border-amber-400 shadow-amber-500/10 pulse-border-warning';
                      badgeColor = 'bg-amber-50 border-amber-100 text-amber-600';
                      statusText = 'Warnings Triggered';
                    } else if (c.status === 'critical') {
                      borderClass = 'border-rose-500 shadow-rose-500/10 pulse-border-danger';
                      badgeColor = 'bg-rose-50 border-rose-100 text-rose-600';
                      statusText = 'High Risk Violations';
                    } else if (c.status === 'offline') {
                      borderClass = 'border-slate-100 opacity-60';
                      badgeColor = 'bg-slate-100 border-slate-200 text-slate-500';
                      statusText = 'Connection Lost';
                    }

                    return (
                      <div
                        key={c.attempt_id}
                        className={`bg-white border rounded-card overflow-hidden shadow-sm flex flex-col justify-between hover:shadow-md transition-all duration-300 ${borderClass}`}
                      >
                        <div className="aspect-video bg-slate-950 relative overflow-hidden flex items-center justify-center">
                          {c.screenshot_url ? (
                            <img
                              src={c.screenshot_url}
                              alt="Webcam Telemetry Snapshot"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="text-center space-y-2">
                              <Video className="w-8 h-8 text-slate-650 mx-auto" />
                              <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">No Infractions Registered</span>
                            </div>
                          )}

                          <div className="absolute top-3 left-3 flex gap-1.5">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${badgeColor}`}>
                              {statusText}
                            </span>
                          </div>
                        </div>

                        <div className="p-4 space-y-3">
                          <div>
                            <h4 className="font-bold text-dark text-xs truncate">{c.candidate_name}</h4>
                            <span className="text-[10px] text-slate-400 font-mono block truncate">{c.email}</span>
                            <span className="text-[9px] text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full font-bold block w-fit mt-1.5">
                              {c.assessment_name}
                            </span>
                          </div>

                          <div className="flex justify-between items-center border-t border-border pt-3 mt-1">
                            <span className="text-[10px] text-slate-450 font-bold uppercase">Warnings: <strong className="text-dark font-extrabold">{c.violation_count}</strong></span>
                            <button
                              onClick={() => handleOpenAction(c)}
                              className="h-8 px-3 border border-indigo-200 hover:border-indigo-300 text-indigo-600 rounded-btn text-[10px] font-bold transition-all"
                            >
                              Take Action
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-4 bg-slate-900 border border-slate-800 p-6 rounded-card shadow-lg flex flex-col justify-between text-slate-300 min-h-[500px]">
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex justify-between items-center border-b border-slate-800 pb-4 mb-4 shrink-0">
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  <ShieldAlert className="w-4.5 h-4.5 text-rose-500" /> Incident Command Log
                </h3>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin">
                {violations.length === 0 ? (
                  <div className="text-slate-500 text-xs py-8 text-center font-mono">
                    System ready. Awaiting telemetry input...
                  </div>
                ) : (
                  violations.map((v) => {
                    let sevColor = 'bg-slate-950 text-slate-400';
                    if (v.severity === 'high') sevColor = 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
                    if (v.severity === 'critical') sevColor = 'bg-rose-500/10 text-rose-400 border border-rose-500/20';

                    return (
                      <div
                        key={v.id}
                        className="bg-slate-950/60 p-3.5 border border-slate-850 rounded-xl space-y-2 text-[10px]"
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-white truncate max-w-[120px]">{v.candidate_name}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold uppercase ${sevColor}`}>
                            {v.severity}
                          </span>
                        </div>
                        <p className="text-slate-400 leading-relaxed font-mono">{v.details}</p>

                        {v.screenshot_url && (
                          <div className="mt-2 aspect-video bg-slate-950 rounded-lg overflow-hidden border border-slate-850">
                            <img src={v.screenshot_url} alt="Infraction Capture" className="w-full h-full object-cover" />
                          </div>
                        )}

                        <div className="flex justify-between items-center text-[9px] text-slate-500 font-mono mt-1 pt-1.5 border-t border-slate-900">
                          <span>{v.type.replace('_', ' ').toUpperCase()}</span>
                          <span>{parseUTCDate(v.timestamp).toLocaleTimeString()}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        {showActionModal && selectedCandidate && (
          <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-card max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3.5 mb-5">
                <h3 className="font-bold text-white text-sm">Action Console: {selectedCandidate.candidate_name}</h3>
                <button
                  onClick={() => setShowActionModal(false)}
                  className="text-slate-400 hover:text-white font-bold text-base"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Transmit Warning Message</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. Please return to center of camera."
                      value={warningMessage}
                      onChange={(e) => setWarningMessage(e.target.value)}
                      className="flex-1 h-10 bg-slate-950 border border-slate-800 rounded-input px-3.5 text-xs text-slate-200 focus:outline-none"
                    />
                    <button
                      onClick={() => handleSendAction('warning')}
                      disabled={actionLoading}
                      className="h-10 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-btn text-xs font-bold transition-all flex items-center gap-1 shrink-0"
                    >
                      <Send className="w-3.5 h-3.5" /> Send
                    </button>
                  </div>
                </div>

                <div className="border-t border-slate-800 pt-5 space-y-3">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Sandbox Controls</label>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => handleSendAction('pause')}
                      disabled={actionLoading}
                      className="h-10 border border-slate-850 hover:bg-slate-800 text-slate-300 rounded-btn text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                    >
                      <Pause className="w-4 h-4 text-slate-400" /> Pause Exam
                    </button>
                    <button
                      onClick={() => handleSendAction('resume')}
                      disabled={actionLoading}
                      className="h-10 border border-slate-850 hover:bg-slate-800 text-slate-300 rounded-btn text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                    >
                      <Play className="w-4 h-4 text-slate-400" /> Resume Exam
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <button
                      onClick={() => handleSendAction('force_submit')}
                      disabled={actionLoading}
                      className="h-10 bg-emerald-650/10 border border-emerald-500/20 hover:bg-emerald-500/20 text-emerald-400 rounded-btn text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                    >
                      <UserCheck className="w-4.5 h-4.5" /> Force Submit
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm('WARNING: Are you sure you want to terminate this candidate\'s exam attempt? The attempt status will be changed to terminated immediately.')) {
                          handleSendAction('terminate');
                        }
                      }}
                      disabled={actionLoading}
                      className="h-10 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-400 rounded-btn text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                    >
                      <StopCircle className="w-4.5 h-4.5" /> Terminate Exam
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};
export default LiveProctoring;
