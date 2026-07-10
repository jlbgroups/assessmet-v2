import React from "react";

interface Props {
    open: boolean;
    onClose: () => void;
    student: any;

    assessments: any[];

    assignAssessmentId: string;
    setAssignAssessmentId: React.Dispatch<React.SetStateAction<string>>;

    assignStartDate: string;
    setAssignStartDate: React.Dispatch<React.SetStateAction<string>>;

    assignEndDate: string;
    setAssignEndDate: React.Dispatch<React.SetStateAction<string>>;

    assignRole: string;
    setAssignRole: React.Dispatch<React.SetStateAction<string>>;

    assignJobTitle: string;
    setAssignJobTitle: React.Dispatch<React.SetStateAction<string>>;

    loading: boolean;

    onAssign: () => void;
}

const AssignAssessmentModal: React.FC<Props> = ({
    open,
    onClose,
    student,

    assessments,

    assignAssessmentId,
    setAssignAssessmentId,

    assignStartDate,
    setAssignStartDate,

    assignEndDate,
    setAssignEndDate,

    assignRole,
    setAssignRole,

    assignJobTitle,
    setAssignJobTitle,

    loading,

    onAssign
}) => {

    if (!open) return null;

    return (
        <div className="fixed inset-0 bg-black/40 flex justify-center items-center z-50">

            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">

                <div className="p-6 border-b">

                    <h2 className="text-xl font-semibold">

                        Assign Assessment

                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                        <div className="space-y-4">

                            {/* Assessment */}
                            <div>
                                <label className="block text-sm font-medium mb-1">
                                    Assessment
                                </label>

                                <select
                                    value={assignAssessmentId}
                                    onChange={(e) => setAssignAssessmentId(e.target.value)}
                                    className="w-full border rounded-lg px-3 py-2"
                                >
                                    <option value="">Select Assessment</option>

                                    {assessments.map((assessment: any) => (
                                        <option
                                            key={assessment.id}
                                            value={assessment.id}
                                        >
                                            {assessment.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Start Window */}
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Start Window
                                </label>

                                <input
                                    type="datetime-local"
                                    value={assignStartDate}
                                    onChange={(e) => setAssignStartDate(e.target.value)}
                                    className="w-full border rounded-lg px-3 py-2"
                                />
                            </div>

                            {/* End Window */}
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    End Window
                                </label>

                                <input
                                    type="datetime-local"
                                    value={assignEndDate}
                                    onChange={(e) => setAssignEndDate(e.target.value)}
                                    className="w-full border rounded-lg px-3 py-2"
                                />
                            </div>

                            {/* Role */}
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Role
                                </label>

                                <input
                                    type="text"
                                    placeholder="Software Engineer"
                                    value={assignRole}
                                    onChange={(e) => setAssignRole(e.target.value)}
                                    className="w-full border rounded-lg px-3 py-2"
                                />
                            </div>

                            {/* Job Title */}
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Job Title
                                </label>

                                <input
                                    type="text"
                                    placeholder="Graduate Trainee"
                                    value={assignJobTitle}
                                    onChange={(e) => setAssignJobTitle(e.target.value)}
                                    className="w-full border rounded-lg px-3 py-2"
                                />
                            </div>

                        </div>
                    </p>

                </div>


                <div className="flex justify-end gap-3 p-6 border-t">

                    <button
                        onClick={onClose}
                        className="px-5 h-10 border rounded-lg"
                    >
                        Cancel
                    </button>

                    <button
                        onClick={onAssign}
                        disabled={loading}
                        className="px-5 h-10 rounded-lg bg-indigo-600 text-white disabled:opacity-50"
                    >
                        Assign
                    </button>

                </div>

            </div>

        </div>
    );
};

export default AssignAssessmentModal;