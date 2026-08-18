const API_BASE_URL = 'http://localhost:3000/api';

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  };
}

export type TransferOrderStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED';

export type TransferOrderItem = {
  id: string;
  productCode: string;
  productName: string;
  unit: string;
  quantity: number;
};

export type TransferOrder = {
  id: string;
  transferNo: string;
  requestId?: string;
  requestNumber?: string;
  sourceWarehouse: string;
  destinationWarehouse: string;
  scheduledDate?: string | null;
  dispatchDate?: string | null;
  receiveDate?: string | null;
  driverName?: string | null;
  driverPhone?: string | null;
  vehiclePlate?: string | null;
  status: TransferOrderStatus;
  note?: string | null;
  createdBy?: string | null;
  items: TransferOrderItem[];
  itemCount: number;
  totalQuantity: number;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type CreateTransferOrderInput = {
  transferNo?: string;
  requestId?: string;
  requestNumber?: string;
  sourceWarehouse: string;
  destinationWarehouse: string;
  scheduledDate?: string;
  dispatchDate?: string;
  receiveDate?: string;
  driverName?: string;
  driverPhone?: string;
  vehiclePlate?: string;
  status?: TransferOrderStatus;
  note?: string;
  createdBy?: string;
  items: TransferOrderItem[];
};

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...authHeaders(),
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.message || `Request failed with status ${response.status}`);
  }

  return response.json();
}

export const deliveryApi = {
  listTransferOrders: () => requestJson<TransferOrder[]>('/delivery/transfer-orders'),
  createTransferOrder: (payload: CreateTransferOrderInput) =>
    requestJson<TransferOrder>('/delivery/transfer-orders', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateTransferOrder: (id: string, payload: Partial<CreateTransferOrderInput>) =>
    requestJson<TransferOrder>(`/delivery/transfer-orders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteTransferOrder: (id: string) =>
    requestJson<{ deleted: boolean }>(`/delivery/transfer-orders/${id}`, {
      method: 'DELETE',
    }),
};
