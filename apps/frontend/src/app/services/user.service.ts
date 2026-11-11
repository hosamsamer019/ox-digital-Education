import { userApi, managerApi, attendanceApi, authApi } from './api';
import { User, UserRole } from '../contexts/AuthContext';

export interface UpdateProfileData {
  name?: string;
  email?: string;
  password?: string;
}

export interface UserFilters {
  search?: string;
  role?: string;
  page?: number;
  limit?: number;
}

export const userService = {
  getProfile: async (): Promise<User> => {
    const response = await userApi.get('/profile');
    return response.data;
  },

  updateProfile: async (id: string, data: UpdateProfileData): Promise<User> => {
    const response = await userApi.put(`/users/${id}`, data);
    return response.data.user;
  },

  changePassword: async (currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> => {
    const response = await authApi.post('/change-password', { currentPassword, newPassword });
    return response.data;
  },


  getUsers: async (filters: UserFilters): Promise<{ data: User[], total: number, page: number, limit: number, totalPages: number }> => {
    const response = await userApi.get('/users', { params: filters });
    return response.data;
  },

  getTeamMembers: async (params?: { branchId?: string; search?: string }): Promise<any[]> => {
    let data: any = null;
    try {
      const response = await managerApi.get('/team', { params });
      data = response.data;
    } catch (err: any) {
      if (err.response?.status === 400 || err.response?.status === 401 || err.response?.status === 403) {
        throw err;
      }
      const response = await userApi.get('/manager/team', { params });
      data = response.data;
    }
    const list = Array.isArray(data) ? data : (Array.isArray(data?.team) ? data.team : null);
    if (!list) {
      throw new Error('Invalid response structure: expected team array');
    }
    return list;
  },

  getManagerBranches: async (): Promise<any[]> => {
    try {
      const response = await managerApi.get('/branches');
      return response.data?.branches || response.data?.data || (Array.isArray(response.data) ? response.data : []);
    } catch (err: any) {
      if (err.response?.status === 400 || err.response?.status === 401 || err.response?.status === 403) {
        throw err;
      }
      const response = await userApi.get('/manager/branches');
      return response.data?.branches || response.data?.data || (Array.isArray(response.data) ? response.data : []);
    }
  },

  createAccountant: async (data: { name: string; email: string; branchId: string }): Promise<{ user: any; temporaryPassword: string; message: string }> => {
    try {
      const response = await managerApi.post('/accountants', data);
      return response.data;
    } catch (err: any) {
      if (err.response?.status === 400 || err.response?.status === 401 || err.response?.status === 403) {
        throw err;
      }
      const response = await userApi.post('/manager/accountants', data);
      return response.data;
    }
  },

  createUser: async (data: any): Promise<User> => {
    const response = await userApi.post('/users', data);
    return response.data.user;
  },

  updateUser: async (id: string, data: any): Promise<User> => {
    const response = await userApi.put(`/users/${id}`, data);
    return response.data.user;
  },

  deleteUser: async (id: string): Promise<void> => {
    await userApi.delete(`/users/${id}`);
  },

  getDeletionImpact: async (payload: { userIds?: string[], selectAll?: boolean, search?: string, role?: string, excludedIds?: string[] }): Promise<any> => {
    const response = await userApi.post('/users/deletion-impact', payload);
    return response.data;
  },

  bulkDeleteUsers: async (payload: { userIds?: string[], selectAll?: boolean, search?: string, role?: string, excludedIds?: string[] }): Promise<{ count: number }> => {
    const response = await userApi.post('/users/bulk-delete', payload);
    return response.data;
  },

  getChildren: async (): Promise<User[]> => {
    const response = await userApi.get('/parent/children');
    return response.data;
  },

  getAttendance: async (): Promise<any> => {
    const response = await attendanceApi.get('/my-attendance');
    return response.data;
  },

  getStudentAttendanceById: async (studentId: string): Promise<any> => {
    const response = await attendanceApi.get(`/student/${studentId}`);
    return response.data;
  },

  getAttendancePercentage: async (studentId: string): Promise<any> => {
    const response = await attendanceApi.get(`/${studentId}/percentage`);
    return response.data;
  },

  markAttendance: async (payload: { studentId: string; status: 'PRESENT' | 'ABSENT' | 'LATE' | 'CANCELLED'; date?: string }): Promise<any> => {
    const response = await attendanceApi.post('/', payload);
    return response.data;
  },

  updateAttendance: async (id: string, payload: { status?: 'PRESENT' | 'ABSENT' | 'LATE' | 'CANCELLED'; date?: string }): Promise<any> => {
    const response = await attendanceApi.put(`/${id}`, payload);
    return response.data;
  },

  deleteAttendance: async (id: string): Promise<any> => {
    const response = await attendanceApi.delete(`/${id}`);
    return response.data;
  },

  clearAttendance: async (payload: { studentId: string; date?: string }): Promise<any> => {
    const response = await attendanceApi.post('/clear', payload);
    return response.data;
  },

  bulkMarkAttendance: async (payload: { records: Array<{ studentId: string; status: 'PRESENT' | 'ABSENT' | 'LATE' | 'CANCELLED' | 'UNSET' }>; date?: string }): Promise<any> => {
    const response = await attendanceApi.post('/bulk', payload);
    return response.data;
  },

  getAttendanceByDate: async (date: string): Promise<any> => {
    const response = await attendanceApi.get('/by-date', { params: { date } });
    return response.data;
  },

  getRisks: async (): Promise<any[]> => {
    const response = await userApi.get('/risks');
    return response.data;
  },

  lookupUser: async (identifier: string, expectedRole?: string): Promise<{ success: boolean; account: any }> => {
    const response = await userApi.post('/lookup', { identifier, expectedRole });
    return response.data;
  },

  linkParentStudent: async (payload: { studentId?: string; parentId?: string }): Promise<any> => {
    const response = await userApi.post('/link-parent', payload);
    return response.data;
  },

  unlinkParentStudent: async (studentId?: string): Promise<any> => {
    const response = await userApi.post('/unlink-parent', { studentId });
    return response.data;
  },

  getLinkedRelationships: async (): Promise<any> => {
    try {
      const response = await userApi.get('/linked-relationships');
      return response.data;
    } catch (err: any) {
      if (err?.response?.status === 404) {
        try {
          const fallbackRes = await userApi.get('/account/relationships');
          return fallbackRes.data;
        } catch {
          return { success: false, data: null };
        }
      }
      return { success: false, data: null };
    }
  }
};

