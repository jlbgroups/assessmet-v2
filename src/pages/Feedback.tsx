import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Star, MessageSquare, CheckCircle2 } from 'lucide-react';
import { apiFetch } from '../utils/api';

export const Feedback: React.FC = () => {
  const { attempt_id } = useParams<{ attempt_id: string }>();
  const navigate = useNavigate();

  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [comments, setComments] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      alert('Please select a star rating before submitting.');
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch(`/api/attempts/${attempt_id}/feedback`, {
        method: 'POST',
        body: JSON.stringify({ rating, comments }),
      });
      setSuccess(true);
      setTimeout(() => {
        navigate('/candidate');
      }, 2000);
    } catch (err: any) {
      alert(err.message || 'Failed to submit feedback. Returning to dashboard...');
      navigate('/candidate');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-card max-w-md w-full shadow-2xl text-center space-y-6 relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full filter blur-[50px]"></div>
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto ring-8 ring-emerald-500/5">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-white">Thank You for Your Feedback!</h2>
            <p className="text-xs text-slate-400">Your comments help us improve the testing environment. Redirecting you to the candidate terminal...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div className="bg-slate-900 border border-slate-800 p-8 rounded-card max-w-md w-full shadow-2xl space-y-6 relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full filter blur-[50px]"></div>
        
        <div className="space-y-2 text-left shrink-0">
          <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider block">Session Completed</span>
          <h2 className="text-xl font-bold text-white">Share Your Experience</h2>
          <p className="text-xs text-slate-400">Please rate your experience with the online assessment platform today.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block text-left">Overall Rating</label>
            <div className="flex items-center gap-2 justify-start py-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="p-1 focus:outline-none transition-transform hover:scale-110 active:scale-95"
                >
                  <Star
                    className={`w-8 h-8 transition-colors ${
                      star <= (hoverRating || rating)
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-slate-700 hover:text-slate-500'
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2.5 text-left">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Comments & Suggestions (Optional)</label>
            <div className="relative">
              <MessageSquare className="absolute left-3 top-3.5 w-4 h-4 text-slate-500" />
              <textarea
                placeholder="How was the environment? Any issues during the exam?"
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                rows={4}
                className="w-full bg-slate-950 border border-slate-800 rounded-input pl-10 pr-4 py-3 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none resize-none placeholder-slate-650"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || rating === 0}
            className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white rounded-btn text-xs font-bold transition-all shadow-md shadow-indigo-600/10 flex items-center justify-center"
          >
            {submitting ? 'Submitting...' : 'Submit Feedback'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Feedback;
