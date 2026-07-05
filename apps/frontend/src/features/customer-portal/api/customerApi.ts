export const customerApi = {
  getProfile: async (token: string) => {
    const res = await fetch('http://localhost:3000/api/customer-portal/me', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to fetch profile');
    return res.json();
  },
  updateProfile: async (token: string, data: any) => {
    const res = await fetch('http://localhost:3000/api/customer-portal/me', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to update profile');
    return res.json();
  },
  getStockAvailability: async (token: string) => {
    const res = await fetch('http://localhost:3000/api/customer-portal/stock-availability', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to fetch stock availability');
    return res.json();
  },
  getOrders: async (token: string) => {
    const res = await fetch('http://localhost:3000/api/customer-portal/orders', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to fetch orders');
    return res.json();
  },
  createOrder: async (token: string, data: any) => {
    const res = await fetch('http://localhost:3000/api/customer-portal/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to create order');
    return res.json();
  }
};
