const API_BASE_URL = 'http://localhost:3000/api';

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  };
}

export interface OutboundProduct {
  id: string;
  internalSku: string;
  name: string;
  unit?: string;
}

export interface OutboundDetail {
  id: string;
  warehouseCode?: string;
  requiredQty: number;
  pickedQty: number;
  unitPrice: number;
  totalLineAmount: number;
  product?: OutboundProduct | null;
}

export interface OutboundOrder {
  id: string;
  orderNo: string;
  customer: string;
  dueDate: string;
  status: 'pending' | 'picking' | 'READY_TO_SHIP' | 'shipped';
  items: number;
  description?: string;
  details?: OutboundDetail[];
}

export interface OutboundCreatePayload {
  orderNo: string;
  customer: string;
  dueDate: string;
  status: string;
  items: number;
  description?: string;
  details?: Array<{
    productId: string;
    requiredQty: number;
    warehouseCode?: string;
    unitPrice?: number;
  }>;
}

export interface PickingTask {
  id: string;
  assignedTo?: string;
  status: string;
  order: OutboundOrder;
  createdAt: string;
  updatedAt: string;
}

function normalizeResponse<T>(response: Response) {
  if (!response.ok) {
    return response.json().then((payload) => {
      const message = payload?.message || payload?.error || 'Lỗi máy chủ';
      throw new Error(message);
    });
  }
  return response.json() as Promise<T>;
}

export const outboundApi = {
  listOrders: async (): Promise<OutboundOrder[]> => {
    const response = await fetch(`${API_BASE_URL}/outbounds`, { headers: authHeaders() });
    return normalizeResponse<OutboundOrder[]>(response);
  },

  getOrder: async (id: string): Promise<OutboundOrder> => {
    const response = await fetch(`${API_BASE_URL}/outbounds/${encodeURIComponent(id)}`, { headers: authHeaders() });
    return normalizeResponse<OutboundOrder>(response);
  },

  createOrder: async (payload: OutboundCreatePayload): Promise<OutboundOrder> => {
    const response = await fetch(`${API_BASE_URL}/outbounds`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    return normalizeResponse<OutboundOrder>(response);
  },

  updateOrder: async (id: string, payload: OutboundCreatePayload): Promise<OutboundOrder> => {
    const response = await fetch(`${API_BASE_URL}/outbounds/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    return normalizeResponse<OutboundOrder>(response);
  },

  deleteOrder: async (id: string): Promise<{ deleted: boolean }> => {
    const response = await fetch(`${API_BASE_URL}/outbounds/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    return normalizeResponse<{ deleted: boolean }>(response);
  },

  confirmOrder: async (id: string): Promise<{ order: OutboundOrder; outboxEvent: unknown; idempotentReplay: boolean }> => {
    const response = await fetch(`${API_BASE_URL}/outbounds/${encodeURIComponent(id)}/confirm`, {
      method: 'POST',
      headers: authHeaders(),
    });
    return normalizeResponse<{ order: OutboundOrder; outboxEvent: unknown; idempotentReplay: boolean }>(response);
  },

  listTasks: async (): Promise<PickingTask[]> => {
    const response = await fetch(`${API_BASE_URL}/outbounds/tasks/all`, { headers: authHeaders() });
    return normalizeResponse<PickingTask[]>(response);
  },

  assignTask: async (orderId: string, assignedTo: string): Promise<PickingTask> => {
    const response = await fetch(`${API_BASE_URL}/outbounds/tasks`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ orderId, assignedTo }),
    });
    return normalizeResponse<PickingTask>(response);
  },
};
