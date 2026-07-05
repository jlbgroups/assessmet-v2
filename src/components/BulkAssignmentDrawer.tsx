import React, { useEffect, useState } from "react";
import { apiFetch } from "../utils/api";

interface BulkAssignmentDrawerProps {
    open: boolean;
    onClose: () => void;
    instituteId: number;
    onSuccess: () => void;
}

const BulkAssignmentDrawer: React.FC<BulkAssignmentDrawerProps> = ({
    open,
    onClose,
    instituteId,
    onSuccess, }) => {

    const [rangeStart, setRangeStart] = useState("1");
    const [rangeEnd, setRangeEnd] = useState("30");
    const [summary, setSummary] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [assessments, setAssessments] = useState<any[]>([]);
    const [selectedAssessment, setSelectedAssessment] = useState("");

    const fetchSummary = async () => {
        try {

            setLoading(true);

            const data = await apiFetch(
                `/api/institutes/${instituteId}/bulk-summary/${selectedAssessment}`
            );

            setSummary(data);

            setRangeStart(String(data.next_range.start));
            setRangeEnd(String(data.next_range.end));

        } catch (err) {

            console.error(err);

        } finally {

            setLoading(false);

        }
    };
    const fetchAssessments = async () => {
        try {

            const data = await apiFetch("/api/assessments");

            setAssessments(data);

        } catch (err) {

            console.error(err);

        }
    };
    const handleBulkAssign = async () => {

        if (!selectedAssessment) {
            alert("Please select an assessment.");
            return;
        }

        const from = Number(rangeStart);
        const to = Number(rangeEnd);

        if (from > to) {
            alert("Invalid range.");
            return;
        }

        try {

            const response = await apiFetch(
                `/api/assessments/${selectedAssessment}/bulk-auto-assign`,
                {
                    method: "POST",
                    body: JSON.stringify({
                        institute_id: instituteId,
                        from_serial: from,
                        to_serial: to,
                    }),
                }
            );

            // Backend se assigned_count aayega
            if (response.assigned_count === 0) {

                alert("Selected students already have this assessment.");

            } else {

                let message = `${response.assigned_count} student(s) assigned successfully.`;

                if (response.skipped_count > 0) {
                    message += `\n${response.skipped_count} student(s) were skipped because they already had this assessment.`;
                }

                alert(message);
            }

            await fetchSummary();
            onSuccess();

        } catch (err: any) {

            alert(err.message);

        }

    };

    useEffect(() => {
        if (open) {
            fetchAssessments();
        }
    }, [open]);
    useEffect(() => {
        if (open && selectedAssessment){
            fetchSummary();
        }
    },[selectedAssessment]
    );

    // const assignCount = rangeEnd - rangeStart + 1;

    if (!open) return null;

    if (loading) {
        return (
            <div className="p-8 text-center">
                Loading...
            </div>
        );
    }

    return (

        <div className="fixed inset-0 bg-black/40 z-50">

            <div
                className="
                absolute
                right-0
                top-0
                h-full
                w-[480px]
                bg-white
                shadow-xl
                flex
                flex-col
            "
            >

                {/* ================= HEADER ================= */}

                <div className="p-6 border-b flex items-center justify-between flex-shrink-0">

                    <h2 className="text-xl font-semibold">

                        Bulk Assessment Assignment

                    </h2>

                    <button
                        onClick={onClose}
                        className="text-slate-500 hover:text-black text-2xl"
                    >
                        ×
                    </button>

                </div>

                {/* ================= SCROLLABLE BODY ================= */}

                <div className="flex-1 overflow-y-auto p-6">

                    <div className="space-y-6">

                        {/* Assessment */}

                        <div>

                            <label className="block text-sm font-medium mb-2">

                                Assessment

                            </label>

                            <select
                                value={selectedAssessment}
                                onChange={(e) =>
                                    setSelectedAssessment(e.target.value)
                                }
                                className="w-full h-11 border rounded-lg px-3"
                            >

                                <option value="">

                                    Select Assessment

                                </option>

                                {assessments.map((assessment) => (

                                    <option
                                        key={assessment.id}
                                        value={assessment.id}
                                    >

                                        {assessment.name}

                                    </option>

                                ))}

                            </select>

                        </div>

                        {/* Assignment Range */}

                        <div>

                            <label className="block text-sm font-medium mb-3">

                                Assignment Range

                            </label>

                            <div className="grid grid-cols-2 gap-4">

                                <div>

                                    <label className="text-xs text-slate-500">
                                        From
                                    </label>

                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        value={rangeStart}
                                        onChange={(e) => {
                                            const value = e.target.value;

                                            if (value === "" || /^\d+$/.test(value)) {
                                                setRangeStart(value);
                                            }
                                        }}
                                        className="w-full h-11 border rounded-lg px-3 bg-slate-50"
                                    />

                                </div>

                                <div>

                                    <label className="text-xs text-slate-500">
                                        To
                                    </label>

                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        value={rangeEnd}
                                        onChange={(e) => {
                                            const value = e.target.value;

                                            if (value === "" || /^\d+$/.test(value)) {
                                                setRangeEnd(value);
                                            }
                                        }}
                                        className="w-full h-11 border rounded-lg px-3"
                                    />

                                </div>

                            </div>

                        </div>

                        {/* Statistics */}

                        <div className="grid grid-cols-3 gap-3">

                            <div className="rounded-lg border p-4">

                                <div className="text-xs text-slate-500">
                                    Total
                                </div>

                                <div className="text-xl font-bold">
                                    {summary?.total_students ?? 0}
                                </div>

                            </div>

                            <div className="rounded-lg border p-4">

                                <div className="text-xs text-slate-500">
                                    Assigned
                                </div>

                                <div className="text-xl font-bold text-indigo-600">
                                    {summary?.already_assigned ?? 0}
                                </div>

                            </div>

                            <div className="rounded-lg border p-4">

                                <div className="text-xs text-slate-500">
                                    Remaining
                                </div>

                                <div className="text-xl font-bold text-emerald-600">
                                    {summary?.remaining_students ?? 0}
                                </div>

                            </div>

                        </div>

                        {/* Next Assignment Range */}

                        <div className="rounded-xl border p-5">

                            <div className="text-sm text-slate-500">

                                Next Assignment Range

                            </div>

                            <div className="text-3xl font-bold mt-3">

                                {rangeStart} → {rangeEnd}

                            </div>

                        </div>

                        {/* Student Preview */}

                        <div className="rounded-xl border p-5">

                            <h3 className="font-semibold text-lg mb-4">

                                Student Preview

                            </h3>

                            {summary?.preview?.length ? (

                                <div className="space-y-3">

                                    {summary.preview.map((student: any) => (

                                        <div
                                            key={student.id}
                                            className="flex justify-between items-center"
                                        >

                                            <span className="text-slate-600">

                                                {student.serial_no}.

                                            </span>

                                            <span className="font-medium">

                                                {student.name}

                                            </span>

                                        </div>

                                    ))}

                                </div>

                            ) : (

                                <div className="text-slate-500">

                                    No students found.

                                </div>

                            )}

                        </div>

                    </div>

                </div>

                {/* ================= FOOTER ================= */}

                <div className="border-t bg-white p-5 flex-shrink-0">

                    <button
                        onClick={handleBulkAssign}
                        className="w-full h-12 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-colors"
                    >

                        Assign Assessment

                    </button>


                </div>

            </div>

        </div>



    );

};

export default BulkAssignmentDrawer;