import React, { useEffect, useState } from 'react';
import Editor from "@monaco-editor/react";
import {
  GraduationCap,
  Plus,
  Edit2,
  Trash2,
  Share2,
  Calendar,
  Clock,
  HelpCircle,
  Award,
  Layers,
  Code2,
  ListPlus
} from 'lucide-react';
import { apiFetch, parseUTCDate } from '../utils/api';
import AdminLayout from '../components/AdminLayout';

export const Assessments: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [assessments, setAssessments] = useState<any[]>([]);
  const [institutes, setInstitutes] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [showFormModal, setShowFormModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);

  const [assigningId, setAssigningId] = useState<number | null>(null);
  const [selectedInstId, setSelectedInstId] = useState('');
  const [assignStartDate, setAssignStartDate] = useState('');
  const [assignEndDate, setAssignEndDate] = useState('');
  const [assignRole, setAssignRole] = useState('');
  const [assignJobTitle, setAssignJobTitle] = useState('');

  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [duration, setDuration] = useState(60);
  const [totalMarks, setTotalMarks] = useState(100);
  const [passingMarks, setPassingMarks] = useState(40);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [questions, setQuestions] = useState<any[]>([]);

  const [showPastQuestionsModal, setShowPastQuestionsModal] = useState(false);
  const [pastQuestions, setPastQuestions] = useState<any[]>([]);
  const [loadingPastQuestions, setLoadingPastQuestions] = useState(false);
  const [pastSearchTerm, setPastSearchTerm] = useState('');
  const [pastTypeFilter, setPastTypeFilter] = useState('');
  const [selectedPastQuestions, setSelectedPastQuestions] = useState<any[]>([]);

  useEffect(() => {
    const sum = questions.reduce((acc, q) => acc + (parseInt(q.marks) || 0), 0);
    setTotalMarks(sum);
  }, [questions]);

  const fetchAssessments = async () => {
    try {
      const data = await apiFetch('/api/assessments');
      setAssessments(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch assessments');
    } finally {
      setLoading(false);
    }
  };

  const fetchInstitutes = async () => {
    try {
      const data = await apiFetch('/api/institutes');
      setInstitutes(data);
    } catch (err) {
      console.error('Failed to load institutes', err);
    }
  };

  useEffect(() => {
    fetchAssessments();
    fetchInstitutes();
  }, []);

  const handleOpenPastQuestions = async () => {
    setLoadingPastQuestions(true);
    setSelectedPastQuestions([]);
    setPastSearchTerm('');
    setPastTypeFilter('');
    setShowPastQuestionsModal(true);
    try {
      const data = await apiFetch('/api/assessments/questions/past');
      setPastQuestions(data);
    } catch (err: any) {
      alert(err.message || 'Failed to load past questions bank.');
    } finally {
      setLoadingPastQuestions(false);
    }
  };

  const handleTogglePastQuestion = (q: any) => {
    const isSelected = selectedPastQuestions.some(item => item.id === q.id);
    if (isSelected) {
      setSelectedPastQuestions(selectedPastQuestions.filter(item => item.id !== q.id));
    } else {
      setSelectedPastQuestions([...selectedPastQuestions, q]);
    }
  };

  const handleAddSelectedQuestions = () => {
    if (selectedPastQuestions.length === 0) {
      setShowPastQuestionsModal(false);
      return;
    }
    const newQuestions = selectedPastQuestions.map(q => ({
      title: q.title,
      type: q.type,
      difficulty: q.difficulty || 'medium',
      marks: q.marks || 5,
      options: q.options,
      correct_answer: q.correct_answer,
      explanation: q.explanation || ''
    }));
    setQuestions([...questions, ...newQuestions]);
    setShowPastQuestionsModal(false);
  };

  const handleOpenCreate = () => {
    setEditingId(null);
    setName('');
    setDescription('');
    setInstructions('');
    setDuration(60);
    setTotalMarks(100);
    setPassingMarks(40);
    setStartDate('');
    setEndDate('');
    setQuestions([
      { title: '', type: 'mcq', difficulty: 'medium', marks: 5, options: ['Option A', 'Option B', 'Option C', 'Option D'], correct_answer: 'Option A', explanation: '' }
    ]);
    setShowFormModal(true);
  };

  const handleOpenEdit = async (id: number) => {
    setLoading(true);
    try {
      const details = await apiFetch(`/api/assessments/${id}`);
      setEditingId(id);
      setName(details.name);
      setDescription(details.description || '');
      setInstructions(details.instructions || '');
      setDuration(details.duration_minutes);
      setTotalMarks(details.total_marks);
      setPassingMarks(details.passing_marks);
      setStartDate('');
      setEndDate('');
      setQuestions(details.questions || []);
      setShowFormModal(true);
    } catch (err: any) {
      setError(err.message || 'Failed to load assessment details');
    } finally {
      setLoading(false);
    }
  };

  const handleAddQuestion = () => {
    setQuestions([
      ...questions,
      { title: '', type: 'mcq', difficulty: 'medium', marks: 5, options: ['Option A', 'Option B', 'Option C', 'Option D'], correct_answer: 'Option A', explanation: '' }
    ]);
  };

  const parseCSV = (text: string): string[][] => {
    const result: string[][] = [];
    let row: string[] = [];
    let curr = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (inQuotes) {
        if (char === '"') {
          if (nextChar === '"') {
            curr += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          curr += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === ',') {
          row.push(curr);
          curr = '';
        } else if (char === '\r' || char === '\n') {
          row.push(curr);
          curr = '';
          if (row.length > 1 || (row.length === 1 && row[0] !== '')) {
            result.push(row);
          }
          row = [];
          if (char === '\r' && nextChar === '\n') {
            i++;
          }
        } else {
          curr += char;
        }
      }
    }

    if (curr !== '' || row.length > 0) {
      row.push(curr);
      result.push(row);
    }

    return result;
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("File size exceeds the 5MB limit. Please upload a smaller file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const rows = parseCSV(text);
        if (rows.length < 2) {
          alert("CSV is empty or missing data rows.");
          return;
        }

        if (rows.length - 1 > 500) {
          alert("CSV contains more than 500 questions. Please import in smaller batches.");
          return;
        }

        const headers = rows[0].map(h => h.trim().toLowerCase());

        const questionIdx = headers.findIndex(h => h === 'question');
        const codeIdx = headers.findIndex(h => h === 'code');
        const optAIdx = headers.findIndex(h => h === 'option a');
        const optBIdx = headers.findIndex(h => h === 'option b');
        const optCIdx = headers.findIndex(h => h === 'option c');
        const optDIdx = headers.findIndex(h => h === 'option d');
        const answerIdx = headers.findIndex(h => h === 'answer');
        const explanationIdx = headers.findIndex(h => h === 'explanation');
        const marksIdx = headers.findIndex(h => h === 'marks');
        const difficultyIdx = headers.findIndex(h => h === 'difficulty');
        const languageIdx = headers.findIndex(h => h === 'language');
        const boilerplateIdx = headers.findIndex(h => h === 'boilerplate');
        const testCaseInputIdx = headers.findIndex(h => h === 'test case input');
        const testCaseOutputIdx = headers.findIndex(h => h === 'test case output');
        const typeIdx = headers.findIndex(h => h === 'type');

        const missing: string[] = [];
        if (questionIdx === -1) missing.push("Question");
        if (answerIdx === -1) missing.push("Answer");

        if (missing.length > 0) {
          alert(`Invalid CSV schema: Missing required columns: ${missing.join(", ")}.\n` +
            `Please verify that your CSV headers match the required structure.`);
          return;
        }

        const parsedQuestions: any[] = [];
        const validationErrors: string[] = [];

        const existingTitles = new Set(questions.map(q => q.title.trim().toLowerCase()));
        const importedTitles = new Set<string>();
        let duplicateCount = 0;

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (row.length === 0 || (row.length === 1 && row[0] === '')) continue;

          const title = (row[questionIdx] || '').trim();
          const rowNum = i + 1;

          if (!title) {
            validationErrors.push(`Row ${rowNum}: Question title/prompt is empty.`);
            continue;
          }

          const normalizedTitle = title.toLowerCase();
          if (existingTitles.has(normalizedTitle) || importedTitles.has(normalizedTitle)) {
            duplicateCount++;
            continue;
          }

          const rawType = typeIdx !== -1 ? (row[typeIdx] || 'mcq') : 'mcq';
          const qType = rawType.trim().toLowerCase();

          const validTypes = ['mcq', 'multiselect', 'truefalse', 'coding', 'code_output_mcq'];
          if (!validTypes.includes(qType)) {
            validationErrors.push(`Row ${rowNum}: Invalid question type "${rawType}". Accepted: mcq, multiselect, truefalse, coding, code_output_mcq.`);
            continue;
          }

          const rawAnswer = (row[answerIdx] || '').trim();
          if (!rawAnswer && qType !== 'coding') {
            validationErrors.push(`Row ${rowNum}: Answer is empty for question type "${qType}".`);
            continue;
          }

          const optA = row[optAIdx] || '';
          const optB = row[optBIdx] || '';
          const optC = row[optCIdx] || '';
          const optD = row[optDIdx] || '';
          const choicesList = [optA, optB, optC, optD].map(o => o.trim()).filter(o => o !== '');

          const explanation = explanationIdx !== -1 ? (row[explanationIdx] || '').trim() : '';
          const marks = marksIdx !== -1 ? parseInt(row[marksIdx]) || 5 : 5;

          let difficulty = difficultyIdx !== -1 ? (row[difficultyIdx] || 'medium').trim().toLowerCase() : 'medium';
          if (difficulty !== 'easy' && difficulty !== 'medium' && difficulty !== 'hard') {
            difficulty = 'medium';
          }

          let finalOptions: any = null;
          let correctAnswer = rawAnswer;

          if (qType === 'mcq') {
            if (choicesList.length < 2) {
              validationErrors.push(`Row ${rowNum}: MCQ must have at least 2 options (Option A and Option B).`);
              continue;
            }
            if (rawAnswer.length === 1 && /^[A-D]$/i.test(rawAnswer)) {
              const oIdx = rawAnswer.toUpperCase().charCodeAt(0) - 65;
              if (oIdx >= 0 && oIdx < choicesList.length) {
                correctAnswer = choicesList[oIdx];
              } else {
                validationErrors.push(`Row ${rowNum}: MCQ answer choice letter '${rawAnswer}' is out of range for options.`);
                continue;
              }
            }
            finalOptions = choicesList.length >= 4 ? choicesList.slice(0, 4) : [...choicesList, ...Array(4 - choicesList.length).fill('').map((_, idx) => `Choice ${String.fromCharCode(65 + choicesList.length + idx)}`)];
          }
          else if (qType === 'multiselect') {
            if (choicesList.length < 2) {
              validationErrors.push(`Row ${rowNum}: Multiselect must have at least 2 options.`);
              continue;
            }
            const parts = rawAnswer.split(/[;,]/).map(p => p.trim().toUpperCase()).filter(p => p !== '');
            const isValidLetters = parts.every(p => /^[A-D]$/.test(p));
            if (!isValidLetters) {
              validationErrors.push(`Row ${rowNum}: Multiselect answers must be letters A-D separated by comma or semicolon.`);
              continue;
            }
            const mappedAnswers = parts.map(p => {
              const oIdx = p.charCodeAt(0) - 65;
              if (oIdx >= 0 && oIdx < choicesList.length) {
                return choicesList[oIdx];
              } else {
                validationErrors.push(`Row ${rowNum}: Multiselect answer choice letter '${p}' is out of range.`);
                return null;
              }
            });
            if (mappedAnswers.includes(null)) {
              continue;
            }
            correctAnswer = mappedAnswers.join('; ');
            finalOptions = choicesList.length >= 4 ? choicesList.slice(0, 4) : [...choicesList, ...Array(4 - choicesList.length).fill('').map((_, idx) => `Choice ${String.fromCharCode(65 + choicesList.length + idx)}`)];
          }
          else if (qType === 'truefalse') {
            const lowerAns = rawAnswer.toLowerCase();
            let tfAnswer = '';
            if (['true', 't', 'yes', 'y', '1'].includes(lowerAns) || lowerAns.startsWith('t') || lowerAns.startsWith('y')) {
              tfAnswer = 'True';
            } else if (['false', 'f', 'no', 'n', '0'].includes(lowerAns) || lowerAns.startsWith('f') || lowerAns.startsWith('n')) {
              tfAnswer = 'False';
            } else {
              validationErrors.push(`Row ${rowNum}: Invalid True/False answer "${rawAnswer}". Expected true/false variant.`);
              continue;
            }
            correctAnswer = tfAnswer;
            finalOptions = ['True', 'False'];
          }
          else if (qType === 'coding') {
            const language = languageIdx !== -1 ? (row[languageIdx] || 'python').trim().toLowerCase() : 'python';
            const boilerplate = boilerplateIdx !== -1 ? row[boilerplateIdx] || '' : '';
            const testCaseInput = testCaseInputIdx !== -1 ? row[testCaseInputIdx] || '' : '';
            const testCaseOutput = testCaseOutputIdx !== -1 ? row[testCaseOutputIdx] || '' : '';

            finalOptions = {
              language: language === 'javascript' || language === 'js' ? 'javascript' : 'python',
              boilerplate,
              test_cases: [
                { input: testCaseInput, output: testCaseOutput }
              ]
            };
            correctAnswer = '';
          }
          else if (qType === 'code_output_mcq') {
            const code = codeIdx !== -1 ? row[codeIdx] || '' : '';
            if (choicesList.length < 2) {
              validationErrors.push(`Row ${rowNum}: Code Output MCQ must have at least 2 choices.`);
              continue;
            }
            if (rawAnswer.length === 1 && /^[A-D]$/i.test(rawAnswer)) {
              const oIdx = rawAnswer.toUpperCase().charCodeAt(0) - 65;
              if (oIdx >= 0 && oIdx < choicesList.length) {
                correctAnswer = choicesList[oIdx];
              } else {
                validationErrors.push(`Row ${rowNum}: Code Output MCQ answer choice letter '${rawAnswer}' is out of range.`);
                continue;
              }
            }
            const 
              language = languageIdx !== -1
              ? (row[languageIdx] || "python").trim().toLowerCase()
              : "python";
            finalOptions = {
              language,
              code,
              choices: choicesList.length >= 4 
                ? choicesList.slice(0, 4) 
                : [
                  ...choicesList, 
                  ...Array(4 - choicesList.length)
                  .fill('')
                  .map((_, idx) => `Choice ${String.fromCharCode(65 + choicesList.length + idx)}`)]
            };
          }

          importedTitles.add(normalizedTitle);
          parsedQuestions.push({
            title,
            type: qType,
            difficulty,
            marks,
            options: finalOptions,
            correct_answer: correctAnswer,
            explanation
          });
        }

        if (validationErrors.length > 0) {
          alert(`CSV Validation Errors:\n` + validationErrors.slice(0, 5).join('\n') +
            (validationErrors.length > 5 ? `\n...and ${validationErrors.length - 5} more errors.` : '') +
            `\n\nImport cancelled. Please check your data.`);
          return;
        }

        if (parsedQuestions.length === 0) {
          alert("No new questions parsed from the CSV.");
          return;
        }

        setQuestions([...questions, ...parsedQuestions]);
        setShowBulkModal(false);

        let successMessage = `Successfully imported ${parsedQuestions.length} questions!`;
        if (duplicateCount > 0) {
          successMessage += ` (${duplicateCount} duplicate questions skipped)`;
        }
        alert(successMessage);
      } catch (err) {
        alert("Error reading or parsing CSV file: " + err);
      }
    };
    reader.readAsText(file);
  };

  const handleRemoveQuestion = (index: number) => {
    const updated = [...questions];
    updated.splice(index, 1);
    setQuestions(updated);
  };

  const handleQuestionChange = (index: number, field: string, value: any) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], [field]: value };

    if (field === 'type') {
      if (value === 'coding') {
        updated[index].allowed_languages = ['python', 'javascript'];
        updated[index].boilerplate = {
          python: 'def solution(n):\n    # Write your code here\n    pass',
          javascript: 'function solution(n) {\n    // Write your code here\n}'
        };
        updated[index].starter_code = {
          python: 'def solution(n):\n    # Write your code here\n    pass',
          javascript: 'function solution(n) {\n    // Write your code here\n}'
        };
        updated[index].test_cases = [
          { input_data: '5', expected_output: '120', is_visible: true, order_index: 0 }
        ];
        updated[index].correct_answer = '';
        updated[index].options = null;
      } else if (value === 'truefalse') {
        updated[index].options = ['True', 'False'];
        updated[index].correct_answer = 'True';
      } else if (value === 'mcq' || value === 'multiselect') {
        updated[index].options = ['Option A', 'Option B', 'Option C', 'Option D'];
        updated[index].correct_answer = 'Option A';
      } else if (value === 'code_output_mcq') {
        updated[index].options = {
          language: "python",
          code: 'def solution():\n   print("Hello, World!")\n\nsolution()',
          choices: ['Hello, World!', 'solution()', 'None', 'Error']
        };
        updated[index].correct_answer = 'Hello, World!';
      } else {
        updated[index].options = null;
        updated[index].correct_answer = '';
      }
    }
    setQuestions(updated);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const payload = {
      name,
      description,
      instructions,
      duration_minutes: duration,
      total_marks: totalMarks,
      passing_marks: passingMarks,
      questions: questions.map((q) => ({
        title: q.title,
        type: q.type,
        difficulty: q.difficulty,
        marks: parseInt(q.marks),
        options: q.options,
        correct_answer: q.correct_answer,
        explanation: q.explanation,
        allowed_languages: q.allowed_languages || [],
        boilerplate: q.boilerplate || {},
        starter_code: q.starter_code || {},
        test_cases: q.test_cases || []
      }))
    };

    try {
      if (editingId) {
        await apiFetch(`/api/assessments/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
      } else {
        await apiFetch('/api/assessments', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      }
      setShowFormModal(false);
      fetchAssessments();
    } catch (err: any) {
      setError(err.message || 'Failed to save assessment');
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this assessment? Historical snapshots and logs will remain.')) return;
    setLoading(true);
    try {
      await apiFetch(`/api/assessments/${id}`, {
        method: 'DELETE'
      });
      fetchAssessments();
    } catch (err: any) {
      setError(err.message || 'Failed to delete assessment');
      setLoading(false);
    }
  };

  const handleOpenAssign = (id: number) => {
    setAssigningId(id);
    setSelectedInstId('');
    setAssignStartDate('');
    setAssignEndDate('');
    setAssignRole('');
    setAssignJobTitle('');
    setShowAssignModal(true);
  };

  const handleSaveAssignment = async () => {
    if (!selectedInstId || !assignStartDate || !assignEndDate) {
      alert('Please fill out target institute and schedule window.');
      return;
    }
    setLoading(true);
    try {
      await apiFetch(`/api/assessments/${assigningId}/assign`, {
        method: 'POST',
        body: JSON.stringify({
          institute_id: parseInt(selectedInstId),
          start_date: assignStartDate,
          end_date: assignEndDate,
          role: assignRole,
          job_title: assignJobTitle
        })
      });
      setShowAssignModal(false);
      setAssignRole('');
      setAssignJobTitle('');
      alert('Assessment assigned successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to assign assessment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center bg-white border border-border p-6 rounded-card shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-dark">Assessments Directory</h2>
              <p className="text-xs text-slate-400">Design exams, configure coding environments, and deploy to hubs</p>
            </div>
          </div>
          <button
            onClick={handleOpenCreate}
            className="h-10 px-4 bg-primary hover:bg-indigo-500 text-white rounded-btn text-xs font-bold transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Create Assessment
          </button>
        </div>

        {error && (
          <div className="p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-card text-xs font-semibold">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {loading && assessments.length === 0 ? (
            <div className="col-span-2 text-center text-slate-500 text-xs font-semibold py-8 bg-white border border-border rounded-card">
              Loading assessments...
            </div>
          ) : assessments.length === 0 ? (
            <div className="col-span-2 text-center text-slate-400 text-xs py-8 bg-white border border-border rounded-card">
              No assessments created. Click "Create Assessment" to begin.
            </div>
          ) : (
            assessments.map((assess) => (
              <div
                key={assess.id}
                className="bg-white border border-border p-6 rounded-card shadow-sm flex flex-col justify-between hover:shadow-md transition-all duration-200"
              >
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Version {assess.active_version}</span>
                    <span className="px-2.5 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-full font-bold text-[10px]">
                      {assess.duration_minutes} Mins
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-dark mb-1">{assess.name}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed line-clamp-2 mb-4">{assess.description}</p>

                  <div className="grid grid-cols-2 gap-3 mb-6 bg-slate-50 p-3.5 rounded-xl border border-slate-100 text-[10px] text-slate-500 font-medium">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>Duration: {assess.duration_minutes} Mins</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Award className="w-3.5 h-3.5 text-slate-400" />
                      <span>Passing Marks: {assess.passing_marks}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-slate-400" />
                      <span>Total Marks: {assess.total_marks}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>Schedule: Set per Assign</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center border-t border-border pt-4 mt-auto">
                  <button
                    onClick={() => handleOpenAssign(assess.id)}
                    className="h-9 px-3 border border-slate-200 text-slate-600 rounded-btn text-xs font-semibold hover:bg-slate-50 flex items-center gap-1.5 transition-all"
                  >
                    <Share2 className="w-4 h-4 text-slate-400" /> Assign
                  </button>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleOpenEdit(assess.id)}
                      className="p-2 border border-slate-200 text-slate-650 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(assess.id)}
                      className="p-2 border border-slate-200 text-slate-600 hover:text-rose-650 hover:bg-rose-550/10 rounded-lg transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {showFormModal && (
          <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm flex items-center justify-center z-50 overflow-y-auto p-4">
            <div className="bg-white border border-border w-full max-w-4xl rounded-card shadow-2xl overflow-hidden my-8 max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
              <div className="px-6 py-5 border-b border-border bg-slate-50 flex justify-between items-center shrink-0">
                <h3 className="font-bold text-dark text-sm">
                  {editingId ? 'Modify Assessment Snapshot' : 'Create New Assessment'}
                </h3>
                <button
                  onClick={() => setShowFormModal(false)}
                  className="text-slate-400 hover:text-dark font-bold text-base"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Assessment Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. CS101: Midterm Python Examination"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full h-11 border border-slate-200 rounded-input px-3 text-xs focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Duration (Minutes)</label>
                    <input
                      type="number"
                      required
                      value={duration}
                      onChange={(e) => setDuration(parseInt(e.target.value))}
                      className="w-full h-11 border border-slate-200 rounded-input px-3 text-xs focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>


                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Total Marks (Auto-calculated)</label>
                    <input
                      type="number"
                      disabled
                      value={totalMarks}
                      className="w-full h-11 border border-slate-200 bg-slate-50 text-slate-500 rounded-input px-3 text-xs cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Passing Marks</label>
                    <input
                      type="number"
                      required
                      value={passingMarks}
                      onChange={(e) => setPassingMarks(parseInt(e.target.value))}
                      className="w-full h-11 border border-slate-200 rounded-input px-3 text-xs focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Description</label>
                  <textarea
                    placeholder="Brief description of topics covered..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    className="w-full border border-slate-200 rounded-input p-3 text-xs focus:border-indigo-500 focus:outline-none resize-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Candidate Instructions</label>
                  <textarea
                    placeholder="Rules, proctoring warnings, etc. shown before exam starts..."
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    rows={2}
                    className="w-full border border-slate-200 rounded-input p-3 text-xs focus:border-indigo-500 focus:outline-none resize-none"
                  />
                </div>

                <div className="border-t border-border pt-6">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-xs font-bold text-dark flex items-center gap-1.5">
                      <ListPlus className="w-4 h-4 text-indigo-500" /> Examination Questions ({questions.length})
                    </h4>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleOpenPastQuestions}
                        className="h-8 px-3 border border-indigo-200 hover:border-indigo-300 text-indigo-600 rounded-btn text-[10px] font-bold transition-all flex items-center gap-1"
                      >
                        <HelpCircle className="w-3.5 h-3.5" /> Import Past Questions
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowBulkModal(true)}
                        className="h-8 px-3 border border-indigo-200 hover:border-indigo-300 text-indigo-600 rounded-btn text-[10px] font-bold transition-all flex items-center gap-1"
                      >
                        <ListPlus className="w-3 h-3" /> Bulk Add MCQs
                      </button>
                      <button
                        type="button"
                        onClick={handleAddQuestion}
                        className="h-8 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-btn text-[10px] font-bold transition-all flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" /> Add Question
                      </button>
                    </div>
                  </div>

                  <div className="space-y-6">
                    {questions.map((q, idx) => (
                      <div key={idx} className="p-5 bg-slate-50 border border-slate-200 rounded-card space-y-4 relative">
                        <button
                          type="button"
                          onClick={() => handleRemoveQuestion(idx)}
                          className="absolute right-4 top-4 text-slate-400 hover:text-rose-500 font-bold text-xs"
                        >
                          ✕ Remove
                        </button>

                        <div className="grid grid-cols-4 gap-4 pr-16">
                          <div className="col-span-2">
                            <label className="text-[9px] font-bold text-slate-500 uppercase mb-1 block">Question Title / Prompt</label>
                            <input
                              type="text"
                              required
                              disabled={q.type === 'descriptive'}
                              placeholder="e.g. What is the complexity of binary search?"
                              value={q.title}
                              onChange={(e) => handleQuestionChange(idx, 'title', e.target.value)}
                              className={`w-full h-9 border border-slate-200 rounded-input px-3 text-xs focus:bg-white focus:outline-none ${q.type === 'descriptive' ? 'bg-slate-50 text-slate-400 cursor-not-allowed' : ''}`}
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-bold text-slate-500 uppercase mb-1 block">Question Type</label>
                            <select
                              value={q.type}
                              onChange={(e) => handleQuestionChange(idx, 'type', e.target.value)}
                              disabled={q.type === 'descriptive'}
                              className={`w-full h-9 border border-slate-200 rounded-input px-3 text-xs focus:bg-white focus:outline-none ${q.type === 'descriptive' ? 'bg-slate-50 text-slate-400 cursor-not-allowed' : ''}`}
                            >
                              <option value="mcq">MCQ (Single Select)</option>
                              <option value="code_output_mcq">Code MCQ (Code prompt, MCQ output)</option>
                              <option value="multiselect">Multiple Select</option>
                              <option value="truefalse">True / False</option>
                              {q.type === 'descriptive' && (
                                <option value="descriptive">Descriptive (Long Text) [Read-Only]</option>
                              )}
                              <option value="coding">Coding Sandbox</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[9px] font-bold text-slate-500 uppercase mb-1 block">Marks</label>
                            <input
                              type="number"
                              disabled={q.type === 'descriptive'}
                              value={q.marks}
                              onChange={(e) => handleQuestionChange(idx, 'marks', e.target.value)}
                              className={`w-full h-9 border border-slate-200 rounded-input px-3 text-xs focus:bg-white focus:outline-none ${q.type === 'descriptive' ? 'bg-slate-50 text-slate-400 cursor-not-allowed' : ''}`}
                            />
                          </div>
                        </div>

                        {(q.type === 'mcq' || q.type === 'multiselect') && (
                          <div className="space-y-2.5">
                            <label className="text-[9px] font-bold text-slate-500 uppercase block">Choices Configuration</label>
                            <div className="grid grid-cols-2 gap-3">
                              {q.options && Array.isArray(q.options) && q.options.map((opt: any, oIdx: number) => (
                                <div key={oIdx} className="flex items-center gap-2">
                                  <span className="text-[10px] font-bold text-slate-400">{String.fromCharCode(65 + oIdx)}:</span>
                                  <input
                                    type="text"
                                    required
                                    value={opt}
                                    onChange={(e) => {
                                      const updatedOpts = [...q.options];
                                      updatedOpts[oIdx] = e.target.value;
                                      handleQuestionChange(idx, 'options', updatedOpts);
                                    }}
                                    className="flex-1 h-8 border border-slate-250 rounded-input px-2.5 text-xs focus:bg-white focus:outline-none"
                                  />
                                </div>
                              ))}
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Correct Choice</label>
                                <input
                                  type="text"
                                  placeholder="e.g. Option A (Exact text matching choice)"
                                  value={q.correct_answer}
                                  onChange={(e) => handleQuestionChange(idx, 'correct_answer', e.target.value)}
                                  className="w-full h-8 border border-slate-200 rounded-input px-3 text-xs focus:bg-white focus:outline-none"
                                />
                              </div>
                              <div>
                                <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Explanation</label>
                                <input
                                  type="text"
                                  placeholder="Explanation shown in results..."
                                  value={q.explanation}
                                  onChange={(e) => handleQuestionChange(idx, 'explanation', e.target.value)}
                                  className="w-full h-8 border border-slate-200 rounded-input px-3 text-xs focus:bg-white focus:outline-none"
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {q.type === 'code_output_mcq' && (
                          <div className="space-y-4">
                            <div>
                              <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">
                                Programming Language
                              </label>

                              <select
                                value={q.options?.language || "python"}
                                onChange={(e) => {
                                  const opts = {
                                    ...q.options,
                                    language: e.target.value
                                  };

                                  handleQuestionChange(idx, "options", opts);
                                }}
                                className="w-full h-9 border border-slate-200 rounded-input px-3 text-xs focus:outline-none"
                              >
                                <option value="python">Python</option>
                                <option value="java">Java</option>
                                <option value="cpp">C++</option>
                                <option value="javascript">JavaScript</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Code Snippet (Question Prompt)</label>
                              <div className="overflow-hidden rounded-xl border border-slate-300">
                              <Editor
                                height="320px"
                                language={
                                  q.options?.language === "cpp"
                                    ? "cpp"
                                    : q.options?.language || "python"
                                }
                                theme="vs-dark"
                                value={q.options?.code || ""}
                                onChange={(value) => {
                                  const opts = {
                                    ...q.options,
                                    code: value || ""
                                  };

                                  handleQuestionChange(idx, "options", opts);
                                }}
                                options={{
                                  minimap: {
                                    enabled: false
                                  },
                                  fontSize: 14,
                                  scrollBeyondLastLine: false,
                                  automaticLayout: true,
                                  wordWrap: "on",
                                  lineNumbers: "on",
                                  tabSize: 4,
                                  fontFamily: "'Fira Code', monospace",
                                  padding: {
                                    top: 12,
                                    bottom: 12
                                  }
                                }}
                              />
                            </div>
                            </div>
                            <div className="space-y-2.5">
                              <label className="text-[9px] font-bold text-slate-500 uppercase block">Choices Configuration (Expected Outputs)</label>
                              <div className="grid grid-cols-2 gap-3">
                                {q.options?.choices && Array.isArray(q.options.choices) && q.options.choices.map((opt: any, oIdx: number) => (
                                  <div key={oIdx} className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-slate-400">{String.fromCharCode(65 + oIdx)}:</span>
                                    <input
                                      type="text"
                                      required
                                      value={opt}
                                      onChange={(e) => {
                                        const updatedChoices = [...q.options.choices];
                                        updatedChoices[oIdx] = e.target.value;
                                        const opts = { ...q.options, choices: updatedChoices };
                                        handleQuestionChange(idx, 'options', opts);
                                      }}
                                      className="flex-1 h-8 border border-slate-250 rounded-input px-2.5 text-xs focus:bg-white focus:outline-none"
                                    />
                                  </div>
                                ))}
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Correct Output Choice</label>
                                  <input
                                    type="text"
                                    required
                                    placeholder="e.g. Hello, World! (Exact text matching choice)"
                                    value={q.correct_answer}
                                    onChange={(e) => handleQuestionChange(idx, 'correct_answer', e.target.value)}
                                    className="w-full h-8 border border-slate-200 rounded-input px-3 text-xs focus:bg-white focus:outline-none"
                                  />
                                </div>
                                <div>
                                  <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Explanation</label>
                                  <input
                                    type="text"
                                    placeholder="Explanation shown in results..."
                                    value={q.explanation}
                                    onChange={(e) => handleQuestionChange(idx, 'explanation', e.target.value)}
                                    className="w-full h-8 border border-slate-200 rounded-input px-3 text-xs focus:bg-white focus:outline-none"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {q.type === 'truefalse' && (
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Correct Answer</label>
                              <select
                                value={q.correct_answer}
                                onChange={(e) => handleQuestionChange(idx, 'correct_answer', e.target.value)}
                                className="w-full h-8 border border-slate-200 rounded-input px-3 text-xs focus:bg-white focus:outline-none"
                              >
                                <option value="True">True</option>
                                <option value="False">False</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Explanation</label>
                              <input
                                type="text"
                                placeholder="Explanation..."
                                value={q.explanation}
                                onChange={(e) => handleQuestionChange(idx, 'explanation', e.target.value)}
                                className="w-full h-8 border border-slate-200 rounded-input px-3 text-xs focus:bg-white focus:outline-none"
                              />
                            </div>
                          </div>
                        )}

                        {q.type === 'coding' && (
                          <div className="space-y-4 text-left">
                            <div className="flex items-center gap-1 text-[9px] font-bold text-slate-500 uppercase">
                              <Code2 className="w-3.5 h-3.5 text-indigo-500" /> Coding Environment Setup
                            </div>

                            <div className="space-y-1.5">
                              <label className="text-[9px] font-bold text-slate-500 uppercase block">Allowed Languages</label>
                              <div className="flex gap-4">
                                {['python', 'javascript', 'cpp', 'java'].map((lang) => {
                                  const allowed = q.allowed_languages || [];
                                  const isChecked = allowed.includes(lang);

                                  const toggleLang = () => {
                                    let nextAllowed = [...allowed];
                                    if (isChecked) {
                                      nextAllowed = nextAllowed.filter(x => x !== lang);
                                    } else {
                                      nextAllowed.push(lang);
                                    }

                                    const bp = { ...q.boilerplate };
                                    if (!bp[lang]) bp[lang] = lang === 'javascript' ? 'function solution(n) {\n    // Write your code here\n}' : 'def solution(n):\n    # Write your code here\n    pass';

                                    const sc = { ...q.starter_code };
                                    if (!sc[lang]) sc[lang] = bp[lang];

                                    const updated = [...questions];
                                    updated[idx] = {
                                      ...updated[idx],
                                      allowed_languages: nextAllowed,
                                      boilerplate: bp,
                                      starter_code: sc
                                    };
                                    setQuestions(updated);
                                  };

                                  return (
                                    <label key={lang} className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 capitalize cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={toggleLang}
                                        className="h-3.5 w-3.5 text-indigo-600 rounded border-slate-300"
                                      />
                                      {lang === 'cpp' ? 'C++' : lang}
                                    </label>
                                  );
                                })}
                              </div>
                            </div>

                            {(q.allowed_languages && q.allowed_languages.length > 0) && (
                              <div className="p-4 bg-slate-50/50 border border-slate-200 rounded-xl space-y-3">
                                <div className="flex justify-between items-center">
                                  <label className="text-[9px] font-bold text-slate-550 uppercase">Configure Templates for Language</label>
                                  <select
                                    value={q._selectedConfigLang || q.allowed_languages[0]}
                                    onChange={(e) => handleQuestionChange(idx, '_selectedConfigLang', e.target.value)}
                                    className="h-7 border border-slate-200 rounded px-2 text-[10px] focus:outline-none capitalize bg-white"
                                  >
                                    {q.allowed_languages.map((l: string) => (
                                      <option key={l} value={l}>{l === 'cpp' ? 'C++' : l}</option>
                                    ))}
                                  </select>
                                </div>

                                {(() => {
                                  const cLang = q._selectedConfigLang || q.allowed_languages[0];
                                  return (
                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <label className="text-[8px] font-bold text-slate-400 block mb-1">Starter Code (Shown in Editor)</label>
                                        <textarea
                                          rows={4}
                                          value={q.starter_code?.[cLang] || ''}
                                          onChange={(e) => {
                                            const sc = { ...q.starter_code, [cLang]: e.target.value };
                                            handleQuestionChange(idx, 'starter_code', sc);
                                          }}
                                          className="w-full border border-slate-200 rounded p-2 text-xs font-mono focus:outline-none bg-white"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-[8px] font-bold text-slate-400 block mb-1">Boilerplate Code (Comparison Target)</label>
                                        <textarea
                                          rows={4}
                                          value={q.boilerplate?.[cLang] || ''}
                                          onChange={(e) => {
                                            const bp = { ...q.boilerplate, [cLang]: e.target.value };
                                            handleQuestionChange(idx, 'boilerplate', bp);
                                          }}
                                          className="w-full border border-slate-200 rounded p-2 text-xs font-mono focus:outline-none bg-white"
                                        />
                                      </div>
                                    </div>
                                  );
                                })()}
                              </div>
                            )}

                            <div className="space-y-2.5">
                              <div className="flex justify-between items-center">
                                <label className="text-[9px] font-bold text-slate-500 uppercase">Test Cases</label>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const tcs = q.test_cases ? [...q.test_cases] : [];
                                    tcs.push({ input_data: '', expected_output: '', is_visible: true, order_index: tcs.length });
                                    handleQuestionChange(idx, 'test_cases', tcs);
                                  }}
                                  className="h-6 px-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded text-[9px] font-bold transition-all"
                                >
                                  + Add Test Case
                                </button>
                              </div>

                              <div className="space-y-2 max-h-48 overflow-y-auto border border-slate-200 rounded-xl p-3 bg-white">
                                {(!q.test_cases || q.test_cases.length === 0) ? (
                                  <p className="text-[10px] text-slate-400 text-center py-2">No test cases configured. At least 1 is required.</p>
                                ) : (
                                  q.test_cases.map((tc: any, tcIdx: number) => (
                                    <div key={tcIdx} className="flex gap-2.5 items-center bg-slate-50 p-2 rounded-lg border border-slate-150">
                                      <span className="text-[9px] font-bold text-slate-400 font-mono w-4">#{tcIdx + 1}</span>
                                      <input
                                        type="text"
                                        placeholder="Input arguments (stdin)"
                                        value={tc.input_data}
                                        onChange={(e) => {
                                          const tcs = [...q.test_cases];
                                          tcs[tcIdx] = { ...tc, input_data: e.target.value };
                                          handleQuestionChange(idx, 'test_cases', tcs);
                                        }}
                                        className="flex-1 h-7 border border-slate-250 rounded px-2 text-[10px] focus:outline-none bg-white"
                                      />
                                      <input
                                        type="text"
                                        required
                                        placeholder="Expected output"
                                        value={tc.expected_output}
                                        onChange={(e) => {
                                          const tcs = [...q.test_cases];
                                          tcs[tcIdx] = { ...tc, expected_output: e.target.value };
                                          handleQuestionChange(idx, 'test_cases', tcs);
                                        }}
                                        className="flex-1 h-7 border border-slate-250 rounded px-2 text-[10px] focus:outline-none bg-white"
                                      />
                                      <label className="flex items-center gap-1 text-[9px] font-bold text-slate-500 uppercase cursor-pointer shrink-0">
                                        <input
                                          type="checkbox"
                                          checked={tc.is_visible}
                                          onChange={(e) => {
                                            const tcs = [...q.test_cases];
                                            tcs[tcIdx] = { ...tc, is_visible: e.target.checked };
                                            handleQuestionChange(idx, 'test_cases', tcs);
                                          }}
                                          className="h-3.5 w-3.5 text-indigo-600 rounded border-slate-350"
                                        />
                                        Visible
                                      </label>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const tcs = q.test_cases.filter((_: any, i: number) => i !== tcIdx).map((item: any, i: number) => ({ ...item, order_index: i }));
                                          handleQuestionChange(idx, 'test_cases', tcs);
                                        }}
                                        className="text-rose-500 hover:text-rose-600 text-[10px] font-bold px-1"
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {q.type === 'descriptive' && (
                          <div className="space-y-3">
                            <div className="bg-amber-50 border border-amber-250 text-amber-800 p-4 rounded-xl text-xs">
                              <strong>Historical Descriptive Question (Read-Only)</strong>
                              <p className="mt-1">Candidates are prompted to provide a long-form text response. Since the descriptive type is deprecated, this question cannot be modified, but will display as read-only for candidates.</p>
                            </div>
                            {q.explanation && (
                              <div>
                                <label className="text-[9px] font-bold text-slate-550 uppercase block mb-1">Explanation</label>
                                <input
                                  type="text"
                                  disabled
                                  value={q.explanation}
                                  className="w-full h-8 border border-slate-200 bg-slate-50 text-slate-500 rounded-input px-3 text-xs cursor-not-allowed"
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t border-border pt-4 flex justify-end gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowFormModal(false)}
                    className="h-10 px-4 border border-slate-200 text-slate-650 rounded-btn text-xs font-semibold hover:bg-slate-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="h-10 px-4 bg-primary hover:bg-indigo-500 text-white rounded-btn text-xs font-bold transition-all"
                  >
                    {loading ? 'Committing Snapshot...' : 'Save Assessment'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showBulkModal && (
          <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white border border-border w-full max-w-lg rounded-card shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="px-6 py-5 border-b border-border bg-slate-50 flex justify-between items-center">
                <h3 className="font-bold text-dark text-sm">Bulk Import MCQs from CSV</h3>
                <button
                  type="button"
                  onClick={() => setShowBulkModal(false)}
                  className="text-slate-400 hover:text-dark font-bold text-base"
                >
                  ✕
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                    Upload CSV File
                  </label>
                  <p className="text-[10px] text-slate-400 mb-4">
                    Select a `.csv` file. The first row must define column headers. Required columns are:
                    <strong className="text-slate-600 block mt-1">Question, Option A, Option B, Option C, Option D, Answer</strong>
                    Optional columns: <strong className="text-slate-500 font-medium">Explanation, Marks, Difficulty</strong>
                  </p>

                  <div className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-card p-6 flex flex-col items-center justify-center bg-slate-50 transition-all cursor-pointer relative">
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleCsvUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="text-slate-400 text-xs font-semibold mb-1">Click to browse or drop CSV here</div>
                    <span className="text-[10px] text-slate-400">Accepts only .csv files</span>
                  </div>

                  <div className="mt-4">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">CSV Headers Example</span>
                    <pre className="bg-slate-55 p-3 rounded-lg text-[9px] font-mono text-slate-600 border border-slate-100 max-h-36 overflow-y-auto leading-relaxed select-all">
                      {`Question,Option A,Option B,Option C,Option D,Answer,Explanation,Marks,Difficulty\n` +
                        `"What is Python?","A coding language","A snake","Both","None",C,"Both a coding language and a snake",5,easy`}
                    </pre>
                  </div>
                </div>

                <div className="border-t border-border pt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowBulkModal(false)}
                    className="h-10 px-4 border border-slate-200 text-slate-600 rounded-btn text-xs font-semibold hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showAssignModal && (
          <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white border border-border w-full max-w-md rounded-card shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="px-6 py-5 border-b border-border bg-slate-50 flex justify-between items-center">
                <h3 className="font-bold text-dark text-sm">Assign Assessment to Hub</h3>
                <button
                  onClick={() => setShowAssignModal(false)}
                  className="text-slate-400 hover:text-dark font-bold text-base"
                >
                  ✕
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Choose Target Institute</label>
                  <select
                    value={selectedInstId}
                    onChange={(e) => setSelectedInstId(e.target.value)}
                    className="w-full h-11 border border-slate-200 rounded-input px-3 text-xs focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="">Choose an institute...</option>
                    {institutes.map((inst) => (
                      <option key={inst.id} value={inst.id}>
                        {inst.name} ({inst.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Target Role</label>
                    <input
                      type="text"
                      placeholder="e.g. Developer"
                      value={assignRole}
                      onChange={(e) => setAssignRole(e.target.value)}
                      className="w-full h-11 border border-slate-200 rounded-input px-3 text-xs focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Job Title</label>
                    <input
                      type="text"
                      placeholder="e.g. Senior Frontend Engineer"
                      value={assignJobTitle}
                      onChange={(e) => setAssignJobTitle(e.target.value)}
                      className="w-full h-11 border border-slate-200 rounded-input px-3 text-xs focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Start Window</label>
                    <input
                      type="datetime-local"
                      required
                      value={assignStartDate}
                      onChange={(e) => setAssignStartDate(e.target.value)}
                      className="w-full h-11 border border-slate-200 rounded-input px-3 text-xs focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">End Window</label>
                    <input
                      type="datetime-local"
                      required
                      value={assignEndDate}
                      onChange={(e) => setAssignEndDate(e.target.value)}
                      className="w-full h-11 border border-slate-200 rounded-input px-3 text-xs focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="border-t border-border pt-4 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowAssignModal(false)}
                    className="h-10 px-4 border border-slate-200 text-slate-650 rounded-btn text-xs font-semibold hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveAssignment}
                    disabled={loading || !selectedInstId || !assignStartDate || !assignEndDate}
                    className="h-10 px-4 bg-primary hover:bg-indigo-500 text-white rounded-btn text-xs font-bold transition-all disabled:opacity-50"
                  >
                    Confirm Assignment
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showPastQuestionsModal && (
          <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white border border-border w-full max-w-2xl rounded-card shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
              <div className="px-6 py-5 border-b border-border bg-slate-50 flex justify-between items-center shrink-0">
                <div>
                  <h3 className="font-bold text-dark text-sm">Question Bank Repository</h3>
                  <p className="text-[10px] text-slate-400">Search and select previous assessment questions to reuse</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPastQuestionsModal(false)}
                  className="text-slate-400 hover:text-dark font-bold text-base"
                >
                  ✕
                </button>
              </div>

              <div className="px-6 py-4 border-b border-border bg-slate-50/50 flex flex-col md:flex-row gap-3 shrink-0">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="Search past questions by title..."
                    value={pastSearchTerm}
                    onChange={(e) => setPastSearchTerm(e.target.value)}
                    className="w-full h-10 pl-3 pr-4 bg-white border border-slate-200 rounded-input text-xs focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <select
                  value={pastTypeFilter}
                  onChange={(e) => setPastTypeFilter(e.target.value)}
                  className="h-10 bg-white border border-slate-200 rounded-input px-3 text-xs focus:border-indigo-500 focus:outline-none w-full md:w-48"
                >
                  <option value="">All Question Types</option>
                  <option value="mcq">MCQ (Single Select)</option>
                  <option value="code_output_mcq">Code MCQ</option>
                  <option value="multiselect">Multiple Select</option>
                  <option value="truefalse">True / False</option>
                  <option value="coding">Coding Sandbox</option>
                </select>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-3 min-h-[250px]">
                {loadingPastQuestions ? (
                  <div className="text-center py-12 text-slate-500 text-xs font-semibold">
                    Syncing past questions database...
                  </div>
                ) : pastQuestions.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-xs">
                    No questions found in historical records.
                  </div>
                ) : (() => {
                  const filtered = pastQuestions.filter(q => {
                    const matchesSearch = q.title.toLowerCase().includes(pastSearchTerm.toLowerCase());
                    const matchesType = pastTypeFilter ? q.type === pastTypeFilter : true;
                    return matchesSearch && matchesType;
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="text-center py-12 text-slate-400 text-xs">
                        No questions match your search filters.
                      </div>
                    );
                  }

                  return filtered.map((q) => {
                    const isSelected = selectedPastQuestions.some(item => item.id === q.id);
                    return (
                      <div
                        key={q.id}
                        onClick={() => handleTogglePastQuestion(q)}
                        className={`p-4 border rounded-xl flex items-start gap-4 cursor-pointer hover:bg-slate-50/80 transition-all ${isSelected
                          ? 'bg-indigo-50/30 border-indigo-300'
                          : 'bg-white border-slate-150'
                          }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => { }}
                          className="mt-1 h-3.5 w-3.5 text-indigo-650 border-slate-300 rounded focus:ring-indigo-500"
                        />
                        <div className="flex-1 space-y-1.5 text-left">
                          <div className="flex justify-between items-start gap-2">
                            <h4 className="font-semibold text-slate-800 text-xs leading-relaxed">
                              {q.title}
                            </h4>
                            <span className="shrink-0 px-2 py-0.5 bg-slate-100 text-slate-605 border border-slate-200 rounded-full text-[8px] font-bold uppercase tracking-wider">
                              {q.type}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[9px] text-slate-400 font-medium">
                            <span>Marks: <strong className="text-slate-600">{q.marks}</strong></span>
                            <span>Difficulty: <strong className="text-slate-600 capitalize">{q.difficulty}</strong></span>
                          </div>
                          {q.options && (q.type === 'mcq' || q.type === 'multiselect') && Array.isArray(q.options) && (
                            <div className="grid grid-cols-2 gap-1.5 pt-1">
                              {q.options.map((opt: string, oIdx: number) => (
                                <div key={oIdx} className="text-[9px] text-slate-500 truncate flex items-center gap-1.5">
                                  <span className="font-bold text-slate-400">{String.fromCharCode(65 + oIdx)}:</span>
                                  <span className="truncate">{opt}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>

              <div className="px-6 py-4 border-t border-border bg-slate-50 flex justify-between items-center shrink-0">
                <span className="text-[10px] text-slate-500 font-semibold">
                  {selectedPastQuestions.length} question{selectedPastQuestions.length !== 1 ? 's' : ''} selected
                </span>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowPastQuestionsModal(false)}
                    className="h-9 px-4 border border-slate-200 text-slate-650 rounded-btn text-xs font-semibold hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAddSelectedQuestions}
                    disabled={selectedPastQuestions.length === 0}
                    className="h-9 px-5 bg-primary hover:bg-indigo-500 text-white rounded-btn text-xs font-bold transition-all disabled:opacity-50"
                  >
                    Import Selected
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};
export default Assessments;
