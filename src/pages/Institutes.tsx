import React, { useEffect, useState } from 'react';
import { School, Plus, Edit2, Trash2, Calendar, Mail, Phone, Search } from 'lucide-react';
import { apiFetch, parseUTCDate } from '../utils/api';
import AdminLayout from '../components/AdminLayout';

export const Institutes: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [institutes, setInstitutes] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [deadline, setDeadline] = useState('');

  const fetchInstitutes = async () => {
    try {
      const data = await apiFetch('/api/institutes');
      setInstitutes(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch institutes list');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInstitutes();
  }, []);

  const handleOpenCreate = () => {
    setEditingId(null);
    setName('');
    setCode('');
    setDescription('');
    setContactPerson('');
    setContactEmail('');
    setContactNumber('');
    setDeadline('');
    setShowModal(true);
  };

  const handleOpenEdit = (inst: any) => {
    setEditingId(inst.id);
    setName(inst.name);
    setCode(inst.code);
    setDescription(inst.description || '');
    setContactPerson(inst.contact_person || '');
    setContactEmail(inst.contact_email || '');
    setContactNumber(inst.contact_number || '');
    if (inst.deadline) {
      setDeadline(parseUTCDate(inst.deadline).toISOString().substring(0, 16));
    } else {
      setDeadline('');
    }
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const payload = {
      name,
      code,
      description: description || null,
      contact_person: contactPerson || null,
      contact_email: contactEmail || null,
      contact_number: contactNumber || null,
      deadline: deadline ? new Date(deadline).toISOString() : null
    };

    try {
      if (editingId) {
        await apiFetch(`/api/institutes/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
      } else {
        await apiFetch('/api/institutes', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      }
      setShowModal(false);
      fetchInstitutes();
    } catch (err: any) {
      setError(err.message || 'Failed to save institute');
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this institute? This is a soft-delete and can be restored if needed.')) return;
    setLoading(true);
    try {
      await apiFetch(`/api/institutes/${id}`, {
        method: 'DELETE'
      });
      fetchInstitutes();
    } catch (err: any) {
      setError(err.message || 'Failed to delete institute');
      setLoading(false);
    }
  };

  const filteredInstitutes = institutes.filter(inst =>
    inst.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inst.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center bg-white border border-border p-6 rounded-card shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
              <School className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-dark">Institute Directories</h2>
              <p className="text-xs text-slate-400">Add and supervise exam hubs and associated deadlines</p>
            </div>
          </div>
          <button
            onClick={handleOpenCreate}
            className="h-10 px-4 bg-primary hover:bg-indigo-500 text-white rounded-btn text-xs font-bold transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Add Institute
          </button>
        </div>

        <div className="flex items-center gap-4 bg-white border border-border px-5 py-4 rounded-card shadow-sm">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name or code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-10 pl-9 pr-4 bg-slate-50 border border-slate-200 rounded-input text-xs focus:bg-white focus:border-indigo-500 focus:outline-none transition-all"
            />
          </div>
        </div>

        {error && (
          <div className="p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-card text-xs font-semibold">
            {error}
          </div>
        )}

        <div className="bg-white border border-border rounded-card shadow-sm overflow-hidden">
          {loading && institutes.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs font-semibold">
              Loading directories...
            </div>
          ) : filteredInstitutes.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No institutes found. Click "Add Institute" to create one.
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
                  <th className="px-6 py-4">Institute Details</th>
                  <th className="px-6 py-4">Access Code</th>
                  <th className="px-6 py-4">Primary Representative</th>
                  <th className="px-6 py-4">Active Deadline</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredInstitutes.map((inst) => (
                  <tr key={inst.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-5">
                      <div className="font-bold text-dark text-sm">{inst.name}</div>
                      {inst.description && <div className="text-[10px] text-slate-400 mt-1 max-w-xs truncate">{inst.description}</div>}
                    </td>
                    <td className="px-6 py-5">
                      <span className="px-2.5 py-1 bg-slate-100 border border-slate-200 text-slate-600 rounded-full font-mono font-semibold">
                        {inst.code}
                      </span>
                    </td>
                    <td className="px-6 py-5 space-y-1">
                      <div className="font-semibold text-slate-700">{inst.contact_person || 'N/A'}</div>
                      <div className="flex items-center gap-1.5 text-slate-400 text-[10px]">
                        <Mail className="w-3.5 h-3.5" /> {inst.contact_email || 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      {inst.deadline ? (
                        <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {parseUTCDate(inst.deadline).toLocaleDateString()} {parseUTCDate(inst.deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      ) : (
                        <span className="text-slate-400">No deadline</span>
                      )}
                    </td>
                    <td className="px-6 py-5 text-right space-x-2">
                      <button
                        onClick={() => handleOpenEdit(inst)}
                        className="p-2 border border-slate-200 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(inst.id)}
                        className="p-2 border border-slate-200 text-slate-600 hover:text-rose-600 hover:bg-rose-550/10 rounded-lg transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {showModal && (
          <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white border border-border w-full max-w-lg rounded-card shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="px-6 py-5 border-b border-border bg-slate-50 flex justify-between items-center">
                <h3 className="font-bold text-dark text-sm">
                  {editingId ? 'Modify Institute Record' : 'Enroll New Institute'}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-slate-400 hover:text-dark font-bold text-base"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSave} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Institute Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Stanford Academy"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full h-11 border border-slate-200 rounded-input px-3 text-xs focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Access Code (Unique)</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. STAN_ACAD"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      className="w-full h-11 border border-slate-200 rounded-input px-3 text-xs font-mono focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Description</label>
                  <textarea
                    placeholder="Brief description of the institute..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    className="w-full border border-slate-200 rounded-input p-3 text-xs focus:border-indigo-500 focus:outline-none resize-none"
                  />
                </div>

                <div className="border-t border-border pt-4">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Representative & System Details</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Representative Name</label>
                      <input
                        type="text"
                        placeholder="John Doe"
                        value={contactPerson}
                        onChange={(e) => setContactPerson(e.target.value)}
                        className="w-full h-11 border border-slate-200 rounded-input px-3 text-xs focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Contact Email</label>
                      <input
                        type="email"
                        placeholder="john@stanford.edu"
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                        className="w-full h-11 border border-slate-200 rounded-input px-3 text-xs focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Contact Number</label>
                    <input
                      type="text"
                      placeholder="+1 (555) 0199"
                      value={contactNumber}
                      onChange={(e) => setContactNumber(e.target.value)}
                      className="w-full h-11 border border-slate-200 rounded-input px-3 text-xs focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Enrollment Deadline</label>
                    <input
                      type="datetime-local"
                      value={deadline}
                      onChange={(e) => setDeadline(e.target.value)}
                      className="w-full h-11 border border-slate-200 rounded-input px-3 text-xs focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="border-t border-border pt-4 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="h-10 px-4 border border-slate-200 text-slate-600 rounded-btn text-xs font-semibold hover:bg-slate-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="h-10 px-4 bg-primary hover:bg-indigo-500 text-white rounded-btn text-xs font-bold transition-all"
                  >
                    {loading ? 'Saving Record...' : 'Save Institute'}
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
export default Institutes;
