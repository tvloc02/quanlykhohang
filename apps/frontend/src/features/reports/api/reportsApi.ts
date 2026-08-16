const API_BASE_URL = 'http://localhost:3000/api';

function authHeaders() {
  const token = localStorage.getItem('token');
  return {
    Authorization: token ? `Bearer ${token}` : '',
    'Content-Type': 'application/json',
  };
}

export const reportsApi = {
  getDashboard: async () => {
    const response = await fetch(`${API_BASE_URL}/reports/dashboard`, {
      headers: authHeaders(),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.message || 'Không tải được dữ liệu báo cáo');
    }
    return await response.json();
  },

  getSalesReport: async (startDate?: string, endDate?: string, groupBy: string = 'day') => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (groupBy) params.append('groupBy', groupBy);

    const response = await fetch(`${API_BASE_URL}/reports/sales-summary?${params.toString()}`, {
      headers: authHeaders(),
    });
    if (!response.ok) throw new Error('Không tải được dữ liệu Báo cáo bán hàng');
    return await response.json();
  },

  getRevenueReport: async (startDate?: string, endDate?: string, branch?: string) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (branch) params.append('branch', branch);

    const response = await fetch(`${API_BASE_URL}/reports/revenue-summary?${params.toString()}`, {
      headers: authHeaders(),
    });
    if (!response.ok) throw new Error('Không tải được dữ liệu Báo cáo doanh thu');
    return await response.json();
  },

  getCashflowReport: async (startDate?: string, endDate?: string, branch?: string) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (branch) params.append('branch', branch);

    const response = await fetch(`${API_BASE_URL}/reports/cashflow-summary?${params.toString()}`, {
      headers: authHeaders(),
    });
    if (!response.ok) throw new Error('Không tải được dữ liệu Báo cáo thu chi');
    return await response.json();
  },

  getInventorySummaryReport: async (startDate?: string, endDate?: string, categoryId?: string, groupBy: string = 'category') => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (categoryId) params.append('categoryId', categoryId);
    if (groupBy) params.append('groupBy', groupBy);

    const response = await fetch(`${API_BASE_URL}/reports/inventory-summary-report?${params.toString()}`, {
      headers: authHeaders(),
    });
    if (!response.ok) throw new Error('Không tải được dữ liệu Báo cáo tồn kho');
    return await response.json();
  },

  getGenericReport: async (endpoint: string, startDate?: string, endDate?: string) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    const response = await fetch(`${API_BASE_URL}/reports/${endpoint}?${params.toString()}`, {
      headers: authHeaders(),
    });
    if (!response.ok) throw new Error(`Không tải được dữ liệu báo cáo ${endpoint}`);
    return await response.json();
  },
};
