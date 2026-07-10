import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Search, Users, Trash2, Edit2, ChevronRight, ChevronDown } from "lucide-react";
import AdminLayout from "../components/AdminLayout";
import { apiFetch } from "../utils/api";
import BulkAssignmentDrawer from "../components/BulkAssignmentDrawer";
import AssignAssessmentModal from "../components/AssignAssessmentModal";

const InstituteStudents: React.FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    const [students, setStudents] = useState<any[]>([]);
    const [filteredStudents, setFilteredStudents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [showModal, setShowModal] = useState(false);
    const [showBulkAssignModal, setShowBulkAssignModal] = useState(false);
    const [bulkSummary, setBulkSummary] = useState<any>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [assessments, setAssessments] = useState<any[]>([]);
    const [selectedAssessment, setSelectedAssessment] = useState("");
    const [assignCount, setAssignCount] = useState(30);
    const [assignLoading, setAssignLoading] = useState(false);
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingStudentId, setEditingStudentId] = useState<number | null>(null);
    const [editName, setEditName] = useState("");
    const [editEmail, setEditEmail] = useState("");
    const [editStatus, setEditStatus] = useState("active");
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState<any>(null);
    const [assignAssessmentId, setAssignAssessmentId] = useState("");
    const [assignStartDate, setAssignStartDate] = useState("");
    const [assignEndDate, setAssignEndDate] = useState("");
    const [assignRole, setAssignRole] = useState("");
    const [assignJobTitle, setAssignJobTitle] = useState("");
    const [assignSubmitting, setAssignSubmitting] = useState(false);
    const [expandedStudent, setExpandedStudent] = useState<number | null>(null);

    const fetchStudents = async () => {
        try {
            setLoading(true);

            const data = await apiFetch(`/api/institutes/${id}/students`);
            const studentsWithSerial = data.map((student: any, index: number) => ({
                ...student,
                serialNo: index + 1
            }));
            setStudents(studentsWithSerial);
            setFilteredStudents(studentsWithSerial);

        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };
    const handleAddStudent = async () => {
        try {
            await apiFetch(`/api/institutes/${id}/students`, {
                method: "POST",
                body: JSON.stringify({
                    name,
                    email,
                    password,
                }),
            });
            setShowModal(false);
            setName("");
            setEmail("");
            setPassword("");

            await fetchStudents();
        } catch (err: any) {
            alert(err.message);
        }
    };
    const handleDeleteStudent = async (studentId: number) => {
        console.log("Delete clicked", studentId);

        if (!window.confirm("Delete this student?")) {
            return;
        }

        try {
            await apiFetch(`/api/institutes/students/${studentId}`, {
                method: "DELETE",
            });

            await fetchStudents();

        } catch (err) {
            console.error(err);
            alert("Unable to delete student");
        }
    };

    const handleOpenEdit = (student: any) => {
        setEditingStudentId(student.id);
        setEditName(student.name);
        setEditEmail(student.email);
        setEditStatus(student.status);
        setShowEditModal(true);
    };

    const handleUpdateStudent = async () => {
        if (!editName.trim() || !editEmail.trim()) {
            alert("Please fill all required fields");
            return;
        }
        if (!editingStudentId) return;
        try {
            await apiFetch(`/api/institutes/students/${editingStudentId}`, {
                method: "PUT",
                body: JSON.stringify({
                    name: editName,
                    email: editEmail,
                    status: editStatus
                })
            });
            setShowEditModal(false);
            setEditingStudentId(null);
            await fetchStudents();
        } catch (err: any) {
            alert(err.message);
        }
    };

    const handleOpenAssign = async(student: any) =>{
        await fetchAssessments();
        setSelectedStudent(student);
        setAssignAssessmentId("");
        setAssignStartDate("");
        setAssignEndDate("");
        setAssignRole("");
        setAssignJobTitle("");
        setShowAssignModal(true);
    };

    const handleAssignAssessment = async () => {
        if(!assignAssessmentId){
            alert("Please select assessment");
            return;
        }
        if(!assignStartDate){
            alert("Please select start date & time")
            return;
        }
        if(!assignEndDate){
            alert("Please select end date & time")
            return;
        }
        setAssignSubmitting(true);
        try{
            await apiFetch(
                `/api/assessments/${assignAssessmentId}/assign`,
                {
                    method: "POST",
                    body: JSON.stringify({
                        user_id: selectedStudent.id,
                        start_date: assignStartDate,
                        end_date: assignEndDate,
                        role: assignRole,
                        job_title: assignJobTitle
                    })
                }
            );
            alert("Assessment Assign Successfully");
            setShowAssignModal(false);
            await fetchStudents();
        } catch (err: any){
            alert(err. message);
        } finally{
            setAssignSubmitting(false);
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

    const fetchAssigmentHistory = async () => {
        try {
            const data = await apiFetch(`/api/institutes/${id}/assignment-history`);
            setHistory(data);
        } catch (err) {
            console.error(err)
        }
    };

    useEffect(() => {
        fetchStudents();
    }, [id]);

    useEffect(() => {
        const value = search.toLowerCase();

        setFilteredStudents(
            students.filter(
                (student) =>
                    student.name.toLowerCase().includes(value) ||
                    student.email.toLowerCase().includes(value)
            )
        );
    }, [search, students]);

    return (
        <AdminLayout>
            <div className="space-y-6">

                <div className="flex justify-between items-center">

                    <div>

                        <button
                            onClick={() => navigate("/admin/institutes")}
                            className="flex items-center gap-2 text-indigo-600 mb-4"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back to Institutes
                        </button>

                        <h2 className="text-2xl font-bold flex items-center gap-2">
                            <Users className="w-6 h-6" />
                            Institute Students
                        </h2>

                        <p className="text-slate-500 mt-1">
                            Total Students :
                            <span className="font-semibold text-indigo-600 ml-1 ">
                                {filteredStudents.length}
                            </span>
                        </p>

                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={async () => {
                                await fetchAssessments();
                                setShowBulkAssignModal(true);
                            }}
                            className="h-11 px-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
                        >
                            Bulk Assign
                        </button>
                        <button
                            onClick={() => setShowModal(true)}
                            className="h-11 px-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-2">
                            + Add Student
                        </button>
                    </div>
                </div>

                <div className="bg-white rounded-xl border p-5">

                    <div className="relative max-w-sm mb-5">

                        <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />

                        <input
                            type="text"
                            placeholder="Search Student..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full h-10 pl-10 border rounded-lg"
                        />

                    </div>

                    {loading ? (

                        <div className="py-10 text-center">
                            Loading Students...
                        </div>

                    ) : (

                        <table className="w-full">

                            <thead>
                                <tr>

                                    <th className="text-left py-3 w-20">
                                        Sr. No
                                    </th>

                                    <th className="text-left py-3">
                                        Name
                                    </th>

                                    <th className="text-left py-3">
                                        Email
                                    </th>

                                    <th className="text-left py-3">
                                        Status
                                    </th>

                                    <th className="text-right">
                                        Actions
                                    </th>

                                </tr>
                            </thead>
                            <tbody>
                                {filteredStudents.map((student) => (
                                    <React.Fragment key={student.id}>

                                        {/* Main Row */}
                                        <tr className="border-b hover:bg-slate-50">

                                            <td className="py-4">
                                                {student.serialNo}
                                            </td>

                                            <td>

                                                <button
                                                    onClick={() =>
                                                        setExpandedStudent(
                                                            expandedStudent === student.id
                                                                ? null
                                                                : student.id
                                                        )
                                                    }
                                                    className="flex items-center gap-2 hover:text-indigo-600 transition-colors"
                                                >
                                                    {expandedStudent === student.id ? (
                                                        <ChevronDown className="w-4 h-4" />
                                                    ) : (
                                                        <ChevronRight className="w-4 h-4" />
                                                    )}

                                                    <span className="font-medium">
                                                        {student.name}
                                                    </span>
                                                </button>

                                            </td>

                                            <td>{student.email}</td>

                                            <td>
                                                <span
                                                    className={`px-3 py-1 rounded-full text-xs font-medium ${student.status === "active"
                                                            ? "bg-green-100 text-green-700"
                                                            : "bg-red-100 text-red-700"
                                                        }`}
                                                >
                                                    {student.status}
                                                </span>
                                            </td>

                                            <td className="text-right">

                                                <div className="flex justify-end gap-2">

                                                    <button
                                                        onClick={() => handleOpenEdit(student)}
                                                        className="text-indigo-600 hover:text-indigo-700"
                                                    >
                                                        <Edit2 className="w-5 h-5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleOpenAssign(student)}
                                                        className="text-green-600 hover:text-green-700"
                                                        title="Assign Assessment"
                                                    >
                                                        📋
                                                    </button>

                                                    <button
                                                        onClick={() => handleDeleteStudent(student.id)}
                                                        className="text-red-600 hover:text-red-700"
                                                    >
                                                        <Trash2 className="w-5 h-5" />
                                                    </button>

                                                </div>

                                            </td>

                                        </tr>

                                        {/* Expand Row */}

                                        {expandedStudent === student.id && (

                                            <tr className="bg-slate-50">

                                                <td colSpan={5} className="p-5">

                                                    <div className="rounded-xl border bg-white p-6">

                                                        <div className="grid grid-cols-2 gap-8">

                                                            <div>

                                                                <div className="text-xs uppercase text-slate-500">
                                                                    Student ID
                                                                </div>

                                                                <div className="mt-1 font-semibold text-lg">
                                                                    {student.student_id || "-"}
                                                                </div>

                                                            </div>

                                                            <div>

                                                                <div className="text-xs uppercase text-slate-500">
                                                                    Total Assignments
                                                                </div>

                                                                <div className="mt-1 font-semibold text-lg">
                                                                    {student.assignments?.length || 0}
                                                                </div>

                                                            </div>

                                                        </div>

                                                        <div className="mt-6">

                                                            <h4 className="font-semibold text-slate-800 mb-4">
                                                                Assigned Assessments
                                                            </h4>

                                                            {student.assignments &&
                                                                student.assignments.length > 0 ? (

                                                                <div className="space-y-3">

                                                                    {student.assignments.map(
                                                                        (assignment: any) => (

                                                                            <div
                                                                                key={assignment.assignment_id}
                                                                                className="border rounded-lg p-4 flex justify-between items-center"
                                                                            >

                                                                                <div>

                                                                                    <div className="font-semibold">
                                                                                        {assignment.assessment_name}
                                                                                    </div>

                                                                                    <div className="text-xs text-slate-500 mt-1">

                                                                                        {assignment.start_date
                                                                                            ? new Date(
                                                                                                assignment.start_date
                                                                                            ).toLocaleString()
                                                                                            : "-"}

                                                                                        {"  "}→{"  "}

                                                                                        {assignment.end_date
                                                                                            ? new Date(
                                                                                                assignment.end_date
                                                                                            ).toLocaleString()
                                                                                            : "-"}

                                                                                    </div>

                                                                                </div>

                                                                                <span className="px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 text-xs font-medium">

                                                                                    Assigned

                                                                                </span>

                                                                            </div>

                                                                        )
                                                                    )}

                                                                </div>

                                                            ) : (

                                                                <div className="text-slate-500 italic">

                                                                    No assessment assigned yet.

                                                                </div>

                                                            )}

                                                        </div>

                                                    </div>

                                                </td>

                                            </tr>

                                        )}

                                    </React.Fragment>
                                ))}
                            </tbody>

                        </table>

                    )}

                </div>

            </div>
            {
                showModal && (
                    <div className="fixed inset-0 bg-black/40 flex justify-center items-center z-50">

                        <div className="bg-white rounded-xl w-full max-w-md shadow-xl">

                            <div className="p-6 border-b">

                                <h3 className="text-lg font-bold">
                                    Add Student
                                </h3>

                            </div>



                            <div className="p-6 space-y-4">

                                <input
                                    placeholder="Student Name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full h-11 border rounded-lg px-3"
                                />

                                <input
                                    placeholder="Email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full h-11 border rounded-lg px-3"
                                />

                                <input
                                    type="password"
                                    placeholder="Password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full h-11 border rounded-lg px-3"
                                />

                                <div className="flex justify-end gap-3 pt-2">

                                    <button
                                        onClick={() => setShowModal(false)}
                                        className="px-5 h-10 border rounded-lg"
                                    >
                                        Cancel
                                    </button>

                                    <button
                                        onClick={handleAddStudent}
                                        className="px-5 h-10 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                                    >
                                        Save Student
                                    </button>

                                </div>

                            </div>

                        </div>

                    </div>
                )}
            {
                showEditModal && (
                    <div className="fixed inset-0 bg-black/40 flex justify-center items-center z-50">
                        <div className="bg-white rounded-xl w-full max-w-md shadow-xl">

                            <div className="p-6 border-b">
                                <h3 className="text-lg font-bold">
                                    Edit Student
                                </h3>
                            </div>

                            <div className="p-6 space-y-4">

                                <input
                                    placeholder="Student Name"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    className="w-full h-11 border rounded-lg px-3"
                                />

                                <input
                                    placeholder="Email"
                                    value={editEmail}
                                    onChange={(e) => setEditEmail(e.target.value)}
                                    className="w-full h-11 border rounded-lg px-3"
                                />

                                <select
                                    value={editStatus}
                                    onChange={(e) => setEditStatus(e.target.value)}
                                    className="w-full h-11 border rounded-lg px-3"
                                >
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                </select>

                                <div className="flex justify-end gap-3 pt-2">

                                    <button
                                        onClick={() => {
                                            setShowEditModal(false);
                                            setEditingStudentId(null);
                                        }}
                                        className="px-5 h-10 border rounded-lg"
                                    >
                                        Cancel
                                    </button>

                                    <button
                                        onClick={handleUpdateStudent}
                                        className="px-5 h-10 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                                    >
                                        Save Changes
                                    </button>

                                </div>

                            </div>

                        </div>
                    </div>
                )}
            <BulkAssignmentDrawer
                open={showBulkAssignModal}
                onClose={() => setShowBulkAssignModal(false)}
                instituteId={Number(id)}
                onSuccess={fetchStudents}
            />
            <AssignAssessmentModal
                open={showAssignModal}
                onClose={() => setShowAssignModal(false)}
                student={selectedStudent}

                assessments={assessments}

                assignAssessmentId={assignAssessmentId}
                setAssignAssessmentId={setAssignAssessmentId}

                assignStartDate={assignStartDate}
                setAssignStartDate={setAssignStartDate}

                assignEndDate={assignEndDate}
                setAssignEndDate={setAssignEndDate}

                assignRole={assignRole}
                setAssignRole={setAssignRole}

                assignJobTitle={assignJobTitle}
                setAssignJobTitle={setAssignJobTitle}

                loading={assignSubmitting}

                onAssign={handleAssignAssessment}
            />

        </AdminLayout>
    );
};

export default InstituteStudents;