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

    return (await response.json()) as unknown;
  },
};
