import axios from 'axios';

const api = axios.create({
  baseURL: '/api/users',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface TeacherStudentItem {
  id: string;
  name: string;
  email: string;
  role: 'ONLINE_STUDENT' | 'CENTER_STUDENT';
  gradeLevel: string;
  academicLevel?: string | null;
  phone?: string | null;
  profilePictureUrl?: string | null;
  parent?: { id: string; name: string; email: string; phone?: string | null } | null;
  accessStatus: 'ACTIVE' | 'GRACE_PERIOD' | 'LOCKED' | 'RESTRICTED';
  exceptionActiveUntil?: string | null;
  currentSubscription?: any;
  recentSubscriptions?: any[];
  enrolledAt: string;
}

export interface BranchItem {
  id: string;
  name: string;
  code: string;
  status: 'ACTIVE' | 'INACTIVE';
  address?: string | null;
  phone?: string | null;
  isOnline: boolean;
  isDefault: boolean;
  teacherCount: number;
  accountantCount: number;
  activeStudents: number;
  lockedStudents: number;
  totalCollectedThisMonth: number;
  lateUnpaidAmount: number;
}

export interface ReceiptItem {
  id: string;
  branchId: string;
  receiptNumber: string;
  sequenceNumber: number;
  paymentId: string;
  studentId: string;
  teacherId: string;
  accountantId: string;
  amount: number;
  receivingMethod: string;
  monthsCovered: string;
  pdfPath?: string | null;
  createdAt: string;
  student?: { id: string; name: string; gradeLevel?: string | null };
  teacher?: { id: string; name: string };
  accountant?: { id: string; name: string };
  payment?: { id: string; status: string; cancelledAt?: string | null; cancellationReason?: string | null };
}

export const brdSubscriptionService = {
  // TEACHER
  async getTeacherStudents(params?: { search?: string; grade?: string; type?: string; subscriptionStatus?: string; page?: number; limit?: number }) {
    const res = await api.get('/teacher/my-students', { params });
    return res.data;
  },

  async teacherCreateStudent(payload: {
    name: string;
    email: string;
    password?: string;
    gradeLevel: string;
    studentType: 'ONLINE_STUDENT' | 'CENTER_STUDENT';
    parentId?: string;
    parentName?: string;
    parentEmail?: string;
    parentPhone?: string;
    parentPassword?: string;
    centerGroupId?: string;
  }) {
    const res = await api.post('/teacher/students', payload);
    return res.data;
  },

  async teacherLinkParent(payload: {
    studentId: string;
    parentEmail?: string;
    parentName?: string;
    parentPhone?: string;
    parentPassword?: string;
    existingParentId?: string;
  }) {
    const res = await api.post('/teacher/parents', payload);
    return res.data;
  },

  async getTeacherPricing() {
    const res = await api.get('/teacher/pricing');
    return res.data;
  },

  async getTeacherIncomeReport(teacherId?: string) {
    const res = await api.get('/teacher/income-report', { params: { teacherId } });
    return res.data;
  },

  // MANAGER
  async getBranches() {
    const res = await api.get('/manager/branches');
    return res.data;
  },

  async createBranch(payload: { name: string; code: string; address?: string; phone?: string; isOnline?: boolean }) {
    const res = await api.post('/manager/branches', payload);
    return res.data;
  },

  async updateBranch(id: string, payload: { name?: string; address?: string; phone?: string }) {
    const res = await api.put(`/manager/branches/${id}`, payload);
    return res.data;
  },

  async deactivateBranch(id: string) {
    const res = await api.post(`/manager/branches/${id}/deactivate`);
    return res.data;
  },

  async createBranchAccountant(branchId: string, payload: { name: string; email: string }) {
    const res = await api.post(`/manager/branches/${branchId}/accountants`, payload);
    return res.data;
  },

  async assignTeacherBranch(teacherId: string, branchId: string | null) {
    const res = await api.post(`/manager/teachers/${teacherId}/assign-branch`, { branchId });
    return res.data;
  },

  async getManagerStudents(params?: { search?: string; branchId?: string; teacherId?: string; grade?: string; status?: string }) {
    const res = await api.get('/manager/students', { params });
    return res.data;
  },

  async transferStudentTeacher(studentId: string, toTeacherId: string, reason?: string) {
    const res = await api.post(`/manager/students/${studentId}/transfer-teacher`, { toTeacherId, reason });
    return res.data;
  },

  async getStudentHistory(studentId: string) {
    const res = await api.get(`/manager/students/${studentId}/history`);
    return res.data;
  },

  async setPricing(payload: { teacherId: string; grade: string; price: number; effectiveMonth: string; reason?: string }) {
    const res = await api.post('/manager/subscriptions/pricing', payload);
    return res.data;
  },

  async setTeacherSettings(payload: { teacherId: string; lastGraceDay?: number; lockDay?: number; lockMessageAr?: string; lockMessageEn?: string }) {
    const res = await api.post('/manager/subscriptions/settings', payload);
    return res.data;
  },

  async grantManagerException(payload: { studentId: string; teacherId: string; reason: string }) {
    const res = await api.post(`/manager/students/${payload.studentId}/exception-activation`, payload);
    return res.data;
  },

  async cancelPayment(paymentId: string, cancellationReason: string) {
    const res = await api.post(`/manager/payments/${paymentId}/cancel`, { cancellationReason });
    return res.data;
  },

  // ACCOUNTANT
  async getAccountantTeachers() {
    const res = await api.get('/accountant/teachers');
    return res.data;
  },

  async getAccountantStudents() {
    const res = await api.get('/accountant/students');
    return res.data;
  },

  async recordPayment(payload: {
    studentId: string;
    teacherId: string;
    months: Array<{ year: number; month: number }>;
    amount: number;
    receivingMethod: 'CASH' | 'BANK_TRANSFER' | 'WALLET';
    notes?: string;
  }) {
    const res = await api.post('/accountant/payments', payload);
    return res.data;
  },

  async getAccountantReceipts() {
    const res = await api.get('/accountant/receipts');
    return res.data;
  },

  // STUDENT / PARENT
  async getMySubscriptions() {
    const res = await api.get('/subscriptions/my-subscriptions');
    return res.data;
  },

  async getReceiptById(receiptId: string) {
    const res = await api.get(`/receipts/${receiptId}`);
    return res.data;
  },

  // ACCOUNT SETTINGS (BRD SECTION 15)
  async getAccountSettings() {
    const res = await api.get('/account/settings');
    return res.data;
  },

  async updateAccountSettings(payload: { language?: 'ar' | 'en'; theme?: string }) {
    const res = await api.put('/account/settings', payload);
    return res.data;
  },

  async uploadProfilePicture(base64Data: string, mimeType: string) {
    const res = await api.post('/account/profile-picture', { base64Data, mimeType });
    return res.data;
  },

  async deleteProfilePicture() {
    const res = await api.delete('/account/profile-picture');
    return res.data;
  },

  async managerRemoveProfilePicture(userId: string, reason?: string) {
    const res = await api.delete(`/manager/users/${userId}/profile-picture`, { data: { reason } });
    return res.data;
  }
};
