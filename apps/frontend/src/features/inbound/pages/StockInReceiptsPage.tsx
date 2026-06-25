import React from 'react';
import {
    ArrowUpRight,
    Building2,
    CalendarDays,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Clock3,
    FileText,
    Filter,
    Package,
    Pencil,
    PlusCircle,
    RefreshCw,
    Search,
    Trash2,
    Truck,
    Undo2,
    X,
    XCircle,
} from 'lucide-react';

export type WarehouseRecord = {
    id: string;
    code: string;
    name: string;
    address: string;
    status: 'active' | 'inactive';
    managerIds: string[];
    staffIds: string[];
};

export function getStoredWarehouses(): WarehouseRecord[] {
    try {
        return JSON.parse(localStorage.getItem('warehouses') || '[]');
    } catch {
        return [];
    }
}

export function saveStoredWarehouses(warehouses: WarehouseRecord[]) {
    localStorage.setItem('warehouses', JSON.stringify(warehouses));
}

export function mergeStoredWarehouses(fetched: WarehouseRecord[], stored: WarehouseRecord[]) {
    const fetchedIds = new Set(fetched.map((w) => w.id));
    const localOnly = stored.filter((w) => !fetchedIds.has(w.id));
    return [...fetched, ...localOnly];
}

type Product = {
    id: string;
    internalSku: string;
    name: string;
    unit?: string;
    price?: number;
};

type Customer = {
    id: string;
    customerCode: string;
    name: string;
    status: 'active' | 'inactive';
};

type ReturnRequestUser = {
    id: string;
    email: string;
    fullName?: string;
    roles?: {
        name: string;
    }[];
};

type ReturnRequestLine = {
    id: string;
    warehouseCode?: string;
    expectedQty: number;
    receivedQty: number;
    unitPrice: number;
    totalLineAmount: number;
    product?: {
        id: string;
        internalSku: string;
        name: string;
        unit?: string;
    } | null;
};

type ReturnRequest = {
    id: string;
    requestNumber: string;
    receiptNo?: string;
    requestDate?: string;
    expectedDate?: string;
    status?: string;
    description?: string;
    totalAmount: number;
    customer?: {
        id: string;
        customerCode?: string;
        name: string;
    } | null;
    details?: ReturnRequestLine[];
    items: number;
};

type RequestStatus = 'CREATED' | 'APPROVED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED';
type TimeFilter = 'this-month' | '7-days' | 'all';
type ModalMode = 'create' | 'edit' | 'delete' | null;

type FormLine = {
    rowId: string;
    productId: string;
    warehouseCode: string;
    expectedQty: string;
    receivedQty: string;
    unitPrice: string;
};

type RequestForm = {
    requestNumber: string;
    customerId: string;
    requestDate: string;
    expectedDate: string;
    status: RequestStatus;
    description: string;
    items: FormLine[];
    creatorName?: string;
    creatorPhone?: string;
    warehouseCode?: string;
    approverId?: string;
};

type Toast = {
    type: 'success' | 'error';
    message: string;
};

const API_BASE_URL = 'http://localhost:3000/api';

function authHeaders() {
    return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
    };
}

function makeRow(warehouseCode = 'KHO-NVL'): FormLine {
    return {
        rowId: `${Date.now()}-${Math.random()}`,
        productId: '',
        warehouseCode,
        expectedQty: '1',
        receivedQty: '0',
        unitPrice: '0',
    };
}

function parseJwtPayload(token?: string) {
    if (!token) return null;
    try {
        const parts = token.split('.');
        if (parts.length < 2) return null;
        const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const decoded = atob(payload);
        return JSON.parse(decodeURIComponent(escape(decoded)));
    } catch {
        return null;
    }
}

function getStoredUser() {
    try {
        return JSON.parse(localStorage.getItem('user') || '{}');
    } catch {
        return null;
    }
}

function getUserDisplayName(payload: any): string {
    const storedUser = getStoredUser();
    return (
        storedUser?.fullName ||
        storedUser?.name ||
        storedUser?.email ||
        payload?.fullName ||
        payload?.name ||
        payload?.email ||
        payload?.sub ||
        payload?.id ||
        ''
    );
}

function getUserPhone(payload: any): string {
    const storedUser = getStoredUser();
    return (
        storedUser?.phone ||
        storedUser?.phoneNumber ||
        storedUser?.mobile ||
        payload?.phone ||
        payload?.phoneNumber ||
        payload?.mobile ||
        payload?.phone_number ||
        ''
    );
}

function getPrimaryRole(user: ReturnRequestUser) {
    if (!Array.isArray(user.roles) || user.roles.length === 0) return 'staff';
    if (user.roles.some((role) => String(role?.name).toLowerCase() === 'admin')) return 'admin';
    if (user.roles.some((role) => String(role?.name).toLowerCase() === 'manager')) return 'manager';
    if (user.roles.some((role) => String(role?.name).toLowerCase() === 'staff')) return 'staff';
    return String(user.roles[0]?.name || 'staff');
}

function getCurrentUserId() {
    const storedUser = getStoredUser();
    if (storedUser?.id) return String(storedUser.id);
    if (storedUser?.email) return String(storedUser.email);

    const payload = parseJwtPayload(localStorage.getItem('token') || '');
    if (payload?.sub !== undefined && payload?.sub !== null) return String(payload.sub);
    if (payload?.email) return String(payload.email);

    return '';
}

function isWarehouseAssignedToUser(userId: string, warehouse: WarehouseRecord) {
    return warehouse.managerIds.includes(userId) || warehouse.staffIds.includes(userId);
}

function getWarehouseOptionsForUser(userId: string, warehouses: WarehouseRecord[]) {
    if (!userId) return warehouses;
    return warehouses.filter((warehouse) => isWarehouseAssignedToUser(userId, warehouse));
}

function getApproversForWarehouse(warehouse: WarehouseRecord | null, users: ReturnRequestUser[]) {
    if (!warehouse) return [];
    const approvedManagerIds = new Set(warehouse.managerIds.map(String));
    return users.filter(
        (user) =>
            approvedManagerIds.has(String(user.id)) &&
            ['admin', 'manager'].includes(getPrimaryRole(user)),
    );
}

const modalSelectClass =
    'h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 pr-10 outline-none appearance-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10';

function buildEmptyForm(customerId = '', warehouseCode = ''): RequestForm {
    return {
        requestNumber: '',
        customerId,
        requestDate: new Date().toISOString().slice(0, 10),
        expectedDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        status: 'CREATED',
        description: '',
        items: [makeRow(warehouseCode), makeRow(warehouseCode), makeRow(warehouseCode), makeRow(warehouseCode), makeRow(warehouseCode)],
        creatorName: '',
        creatorPhone: '',
        warehouseCode,
        approverId: '',
    };
}

function formatDate(value?: string) {
    if (!value) return '-';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('vi-VN');
}

function formatMoney(value: number) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value || 0);
}

function parseMoney(value: string) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function statusLabel(status?: string) {
    switch ((status || 'CREATED').toUpperCase()) {
        case 'APPROVED':
            return 'Đã duyệt';
        case 'PARTIALLY_RECEIVED':
            return 'Nhận một phần';
        case 'RECEIVED':
            return 'Hoàn thành';
        case 'CANCELLED':
            return 'Đã hủy';
        default:
            return 'Chờ duyệt';
    }
}

function statusClass(status?: string) {
    switch ((status || 'CREATED').toUpperCase()) {
        case 'APPROVED':
            return 'border-blue-200 bg-blue-50 text-blue-700';
        case 'PARTIALLY_RECEIVED':
            return 'border-cyan-200 bg-cyan-50 text-cyan-700';
        case 'RECEIVED':
            return 'border-emerald-200 bg-emerald-50 text-emerald-700';
        case 'CANCELLED':
            return 'border-red-200 bg-red-50 text-red-600';
        default:
            return 'border-amber-200 bg-amber-50 text-amber-700';
    }
}

function statusToFilter(status?: string): 'all' | 'waiting' | 'approved' | 'partial' | 'done' | 'cancelled' {
    switch ((status || 'CREATED').toUpperCase()) {
        case 'APPROVED':
            return 'approved';
        case 'PARTIALLY_RECEIVED':
            return 'partial';
        case 'RECEIVED':
            return 'done';
        case 'CANCELLED':
            return 'cancelled';
        default:
            return 'waiting';
    }
}

function Field({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <label className="mb-2 block text-sm font-bold text-slate-700">{label}</label>
            <div className="flex h-11 items-center rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700">
                {value || '-'}
            </div>
        </div>
    );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
            <span className="text-sm font-semibold text-slate-500">{label}</span>
            <span className="text-sm font-black text-slate-900">{value}</span>
        </div>
    );
}

function ReturnRequestsPageContent() {
    const [requests, setRequests] = React.useState<ReturnRequest[]>([]);
    const [customers, setCustomers] = React.useState<Customer[]>([]);
    const [products, setProducts] = React.useState<Product[]>([]);
    const [warehouses, setWarehouses] = React.useState<WarehouseRecord[]>(() => getStoredWarehouses());
    const [users, setUsers] = React.useState<ReturnRequestUser[]>([]);
    const [search, setSearch] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState<'all' | 'waiting' | 'approved' | 'partial' | 'done' | 'cancelled'>('all');
    const [timeFilter, setTimeFilter] = React.useState<TimeFilter>('this-month');
    const [pageSize, setPageSize] = React.useState(10);
    const [currentPage, setCurrentPage] = React.useState(1);
    const [selectedId, setSelectedId] = React.useState<string | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [toast, setToast] = React.useState<Toast | null>(null);
    const [modalMode, setModalMode] = React.useState<ModalMode>(null);
    const [form, setForm] = React.useState<RequestForm>(() => buildEmptyForm());
    const [deleteTarget, setDeleteTarget] = React.useState<ReturnRequest | null>(null);
    const [receiveOpen, setReceiveOpen] = React.useState(false);
    const [receiveRows, setReceiveRows] = React.useState<Array<{ detailId: string; label: string; qty: string }>>([]);
    const currentUserId = React.useMemo(() => getCurrentUserId(), []);

    React.useEffect(() => {
        if (!toast) return;
        const timer = window.setTimeout(() => setToast(null), 3500);
        return () => window.clearTimeout(timer);
    }, [toast]);

    const loadData = React.useCallback(async () => {
        setLoading(true);
        try {
            const [requestsRes, customersRes, warehousesRes, usersRes, productsRes] = await Promise.all([
                fetch(`${API_BASE_URL}/inbound/return-requests`, { headers: authHeaders() }),
                fetch(`${API_BASE_URL}/customers`, { headers: authHeaders() }),
                fetch(`${API_BASE_URL}/warehouses`, { headers: authHeaders() }),
                fetch(`${API_BASE_URL}/users`, { headers: authHeaders() }),
                fetch(`${API_BASE_URL}/products`, { headers: authHeaders() }),
            ]);

            if (!requestsRes.ok) {
                const data = await requestsRes.json().catch(() => null);
                throw new Error(data?.message || 'Không tải được danh sách đề nghị trả hàng');
            }

            const requestsData = (await requestsRes.json()) as ReturnRequest[];
            setRequests(requestsData);

            if (customersRes.ok) {
                const data = await customersRes.json();
                setCustomers(Array.isArray(data) ? data : data.data || []);
            }
            if (productsRes.ok) {
                const data = await productsRes.json();
                setProducts(Array.isArray(data) ? data : data.data || []);
            }
            if (warehousesRes && warehousesRes.ok) {
                const warehouseData = await warehousesRes.json();
                const normalizedWarehouses: WarehouseRecord[] = Array.isArray(warehouseData)
                    ? warehouseData.map((warehouse: any) => ({
                        id: String(warehouse.id ?? warehouse.code ?? ''),
                        code: String(warehouse.code ?? warehouse.id ?? '').toUpperCase(),
                        name: String(warehouse.name ?? warehouse.code ?? warehouse.id ?? ''),
                        address: String(warehouse.address ?? ''),
                        status: warehouse.status === 'inactive' ? 'inactive' : 'active',
                        managerIds: Array.isArray(warehouse.managerIds) ? warehouse.managerIds.map((id: unknown) => String(id)) : [],
                        staffIds: Array.isArray(warehouse.staffIds) ? warehouse.staffIds.map((id: unknown) => String(id)) : [],
                    }))
                    : [];
                const fallbackWarehouses = getStoredWarehouses();
                const nextWarehouses = normalizedWarehouses.length > 0
                    ? mergeStoredWarehouses(normalizedWarehouses, fallbackWarehouses)
                    : fallbackWarehouses;
                setWarehouses(nextWarehouses);
                if (normalizedWarehouses.length > 0) {
                    saveStoredWarehouses(nextWarehouses);
                }
            }
            if (usersRes && usersRes.ok) {
                const usersData = await usersRes.json();
                setUsers(
                    Array.isArray(usersData)
                        ? usersData.map((user: any) => ({
                            id: String(user.id ?? user._id ?? ''),
                            email: String(user.email ?? ''),
                            fullName: String(user.fullName ?? user.name ?? ''),
                            roles: Array.isArray(user.roles)
                                ? user.roles.map((role: any) => ({ name: String(role?.name ?? role ?? '') }))
                                : [],
                        }))
                        : [],
                );
            }
        } catch (error) {
            setToast({ type: 'error', message: error instanceof Error ? error.message : 'Lỗi khi tải dữ liệu' });
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        loadData();
    }, [loadData]);

    const selectedRequest = React.useMemo(
        () => requests.find((request) => request.id === selectedId) || requests[0] || null,
        [requests, selectedId],
    );

    React.useEffect(() => {
        if (!selectedId && requests[0]) {
            setSelectedId(requests[0].id);
        }
        if (selectedId && !requests.some((request) => request.id === selectedId)) {
            setSelectedId(requests[0]?.id || null);
        }
    }, [requests, selectedId]);

    React.useEffect(() => {
        setCurrentPage(1);
    }, [search, statusFilter, timeFilter]);

    const filteredRequests = React.useMemo(() => {
        const keyword = search.trim().toLowerCase();
        const now = new Date();

        return requests.filter((request) => {
            const matchesKeyword =
                !keyword ||
                request.requestNumber.toLowerCase().includes(keyword) ||
                request.customer?.name.toLowerCase().includes(keyword) ||
                request.description?.toLowerCase().includes(keyword) ||
                (request.details || []).some((detail) => detail.product?.name.toLowerCase().includes(keyword));

            const matchesStatus = statusFilter === 'all' || statusToFilter(request.status) === statusFilter;

            let matchesTime = true;
            if (timeFilter !== 'all') {
                const requestDate = request.requestDate ? new Date(request.requestDate) : null;
                if (!requestDate || Number.isNaN(requestDate.getTime())) {
                    matchesTime = false;
                } else if (timeFilter === 'this-month') {
                    matchesTime = requestDate.getFullYear() === now.getFullYear() && requestDate.getMonth() === now.getMonth();
                } else if (timeFilter === '7-days') {
                    matchesTime = now.getTime() - requestDate.getTime() <= 7 * 24 * 60 * 60 * 1000;
                }
            }

            return matchesKeyword && matchesStatus && matchesTime;
        });
    }, [requests, search, statusFilter, timeFilter]);

    const totalItems = filteredRequests.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const paginatedRequests = filteredRequests.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    const startIndex = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    const endIndex = Math.min(currentPage * pageSize, totalItems);

    React.useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    const draftCount = requests.filter((request) => statusToFilter(request.status) === 'waiting').length;
    const approvedCount = requests.filter((request) => statusToFilter(request.status) === 'approved').length;
    const partialCount = requests.filter((request) => statusToFilter(request.status) === 'partial').length;
    const completedCount = requests.filter((request) => statusToFilter(request.status) === 'done').length;

    const accessibleWarehouses = React.useMemo(
        () => getWarehouseOptionsForUser(currentUserId, warehouses),
        [currentUserId, warehouses],
    );
    const selectedWarehouseRecord = React.useMemo(
        () =>
            warehouses.find(
                (warehouse) => warehouse.code === form.warehouseCode || warehouse.id === form.warehouseCode,
            ) || null,
        [warehouses, form.warehouseCode],
    );
    const warehouseOptions = React.useMemo(() => {
        if (!form.warehouseCode) {
            return accessibleWarehouses;
        }

        const selectedExists = accessibleWarehouses.some(
            (warehouse) => warehouse.code === form.warehouseCode || warehouse.id === form.warehouseCode,
        );

        if (selectedExists) {
            return accessibleWarehouses;
        }

        return selectedWarehouseRecord ? [selectedWarehouseRecord, ...accessibleWarehouses] : accessibleWarehouses;
    }, [accessibleWarehouses, form.warehouseCode, selectedWarehouseRecord]);
    const approverOptions = React.useMemo(
        () => getApproversForWarehouse(selectedWarehouseRecord, users),
        [selectedWarehouseRecord, users],
    );

    React.useEffect(() => {
        if (modalMode !== 'create' && modalMode !== 'edit') return;
        if (!form.warehouseCode) {
            if (form.approverId) {
                setForm((current) => ({ ...current, approverId: '' }));
            }
            return;
        }

        const nextApproverId = approverOptions.some((user) => user.id === form.approverId)
            ? form.approverId
            : approverOptions[0]?.id || '';

        if (nextApproverId !== form.approverId) {
            setForm((current) => ({ ...current, approverId: nextApproverId }));
        }
    }, [approverOptions, form.approverId, form.warehouseCode, modalMode]);

    const openCreate = async () => {
        const fallbackCustomer = customers[0]?.id || '';
        const defaultWarehouse = accessibleWarehouses[0]?.code || accessibleWarehouses[0]?.id || '';
        if (!defaultWarehouse) {
            setToast({ type: 'error', message: 'Bạn chưa được gán kho nào để tạo đề nghị nhập hàng.' });
            return;
        }
        const token = localStorage.getItem('token') || '';
        const payload = parseJwtPayload(token);
        const creatorName = getUserDisplayName(payload);
        const creatorPhone = getUserPhone(payload);
        setForm(buildEmptyForm(fallbackCustomer, defaultWarehouse));
        setForm((current) => ({ ...current, creatorName, creatorPhone, warehouseCode: defaultWarehouse }));
        setModalMode('create');
    };

    const openEdit = (request: ReturnRequest) => {
        setForm({
            requestNumber: request.requestNumber,
            customerId: request.customer?.id || customers[0]?.id || '',
            requestDate: request.requestDate ? request.requestDate.slice(0, 10) : new Date().toISOString().slice(0, 10),
            expectedDate: request.expectedDate ? request.expectedDate.slice(0, 10) : new Date().toISOString().slice(0, 10),
            status: (request.status?.toUpperCase() as RequestStatus) || 'CREATED',
            description: request.description || '',
            items:
                request.details?.length
                    ? request.details.map((detail) => ({
                        rowId: `${detail.id}-${Date.now()}`,
                        productId: detail.product?.id || '',
                        warehouseCode: detail.warehouseCode || 'KHO-NVL',
                        expectedQty: String(detail.expectedQty || 0),
                        receivedQty: String(detail.receivedQty || 0),
                        unitPrice: String(detail.unitPrice || 0),
                    }))
                    : [makeRow((request as any).warehouseCode || accessibleWarehouses[0]?.code || 'KHO-NVL')],
            creatorName: (request as any).creatorName || '',
            creatorPhone: (request as any).creatorPhone || '',
            warehouseCode: (request as any).warehouseCode || accessibleWarehouses[0]?.code || '',
            approverId: (request as any).approverId || '',
        });
        setSelectedId(request.id);
        setModalMode('edit');
    };

    const closeModal = () => {
        setModalMode(null);
        setDeleteTarget(null);
        setSaving(false);
    };

    const buildPayload = () => {
        const items = form.items
            .filter((item) => item.productId && Number(item.expectedQty) > 0)
            .map((item) => ({
                productId: item.productId,
                warehouseCode: item.warehouseCode.trim() || undefined,
                expectedQty: Number(item.expectedQty || 0),
                receivedQty: Number(item.receivedQty || 0),
                unitPrice: Number(item.unitPrice || 0),
            }));

        return {
            requestNumber: form.requestNumber.trim() || undefined,
            customerId: form.customerId,
            requestDate: form.requestDate,
            expectedDate: form.expectedDate,
            status: form.status,
            description: form.description.trim() || undefined,
            creatorName: form.creatorName || undefined,
            creatorPhone: form.creatorPhone || undefined,
            warehouseCode: form.warehouseCode || undefined,
            approverId: form.approverId || undefined,
            items,
        };
    };

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!form.customerId || form.items.length === 0) {
            setToast({ type: 'error', message: 'Vui lòng chọn khách hàng và ít nhất một dòng hàng.' });
            return;
        }

        const selectedWarehouse = warehouses.find(
            (warehouse) => warehouse.code === form.warehouseCode || warehouse.id === form.warehouseCode,
        );
        if (!selectedWarehouse) {
            setToast({ type: 'error', message: 'Vui lòng chọn kho hợp lệ.' });
            return;
        }

        const canUseWarehouse = accessibleWarehouses.some(
            (warehouse) => warehouse.code === form.warehouseCode || warehouse.id === form.warehouseCode,
        );
        if (modalMode === 'create' && !canUseWarehouse) {
            setToast({ type: 'error', message: 'Bạn chỉ có thể tạo yêu cầu với kho được gán cho mình.' });
            return;
        }

        const approverIsValid = approverOptions.some((user) => user.id === form.approverId);
        if (approverOptions.length > 0 && !approverIsValid) {
            setToast({ type: 'error', message: 'Vui lòng chọn người duyệt là quản lý của kho đã chọn.' });
            return;
        }

        const payload = buildPayload();
        if (!payload.items.length) {
            setToast({ type: 'error', message: 'Mỗi yêu cầu cần ít nhất một mặt hàng hợp lệ.' });
            return;
        }

        setSaving(true);
        try {
            const isEdit = modalMode === 'edit';
            const url = isEdit && selectedRequest ? `${API_BASE_URL}/inbound/return-requests/${selectedRequest.id}` : `${API_BASE_URL}/inbound/return-requests`;
            const response = await fetch(url, {
                method: isEdit ? 'PUT' : 'POST',
                headers: authHeaders(),
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const data = await response.json().catch(() => null);
                throw new Error(data?.message || (isEdit ? 'Không cập nhật được yêu cầu' : 'Không tạo được yêu cầu trả hàng'));
            }

            setToast({ type: 'success', message: isEdit ? 'Đã cập nhật yêu cầu trả hàng.' : 'Đã tạo yêu cầu trả hàng mới.' });
            closeModal();
            await loadData();
        } catch (error) {
            setToast({ type: 'error', message: error instanceof Error ? error.message : 'Lỗi khi lưu dữ liệu' });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setSaving(true);
        try {
            const response = await fetch(`${API_BASE_URL}/inbound/return-requests/${deleteTarget.id}`, {
                method: 'DELETE',
                headers: authHeaders(),
            });
            if (!response.ok) {
                const data = await response.json().catch(() => null);
                throw new Error(data?.message || 'Không xóa được yêu cầu trả hàng');
            }
            setToast({ type: 'success', message: 'Đã xóa yêu cầu trả hàng.' });
            closeModal();
            await loadData();
        } catch (error) {
            setToast({ type: 'error', message: error instanceof Error ? error.message : 'Lỗi khi xóa dữ liệu' });
        } finally {
            setSaving(false);
        }
    };

    const approveRequest = async (request: ReturnRequest) => {
        setSaving(true);
        try {
            const response = await fetch(`${API_BASE_URL}/inbound/return-requests/${request.id}/approve`, {
                method: 'POST',
                headers: authHeaders(),
            });
            if (!response.ok) {
                const data = await response.json().catch(() => null);
                throw new Error(data?.message || 'Không duyệt được yêu cầu');
            }
            setToast({ type: 'success', message: 'Đã duyệt yêu cầu trả hàng.' });
            await loadData();
        } catch (error) {
            setToast({ type: 'error', message: error instanceof Error ? error.message : 'Lỗi khi duyệt yêu cầu' });
        } finally {
            setSaving(false);
        }
    };

    const completeRequest = async (request: ReturnRequest) => {
        setSaving(true);
        try {
            const response = await fetch(`${API_BASE_URL}/inbound/return-requests/${request.id}/complete`, {
                method: 'POST',
                headers: authHeaders(),
            });
            if (!response.ok) {
                const data = await response.json().catch(() => null);
                throw new Error(data?.message || 'Không hoàn thành được yêu cầu');
            }
            setToast({ type: 'success', message: 'Đã hoàn thành yêu cầu trả hàng.' });
            await loadData();
        } catch (error) {
            setToast({ type: 'error', message: error instanceof Error ? error.message : 'Lỗi khi hoàn thành' });
        } finally {
            setSaving(false);
        }
    };

    const openReceive = (request: ReturnRequest) => {
        setSelectedId(request.id);
        setReceiveRows(
            (request.details || []).map((detail) => ({
                detailId: detail.id,
                label: `${detail.product?.internalSku || '-'} · ${detail.product?.name || '-'}`,
                qty: String(Math.max(detail.expectedQty - detail.receivedQty, 0)),
            })),
        );
        setReceiveOpen(true);
    };

    const saveReceive = async () => {
        if (!selectedRequest) return;
        setSaving(true);
        try {
            const payload = {
                items: receiveRows
                    .map((row) => ({ detailId: row.detailId, qty: Number(row.qty || 0) }))
                    .filter((row) => row.qty > 0),
            };

            if (payload.items.length === 0) {
                setToast({ type: 'error', message: 'Vui lòng nhập ít nhất một số lượng nhận hợp lệ.' });
                setSaving(false);
                return;
            }

            const response = await fetch(`${API_BASE_URL}/inbound/return-requests/details/${payload.items[0].detailId}/receive`, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify({ items: payload.items }),
            });

            if (!response.ok) {
                const data = await response.json().catch(() => null);
                throw new Error(data?.message || 'Không lưu được số lượng nhận hàng');
            }

            setToast({ type: 'success', message: 'Đã cập nhật số lượng nhận hàng.' });
            setReceiveOpen(false);
            await loadData();
        } catch (error) {
            setToast({ type: 'error', message: error instanceof Error ? error.message : 'Lỗi khi nhận hàng' });
        } finally {
            setSaving(false);
        }
    };

    const selectedRequestMetrics = selectedRequest
        ? {
            lines: selectedRequest.details?.length || 0,
            ordered: (selectedRequest.details || []).reduce((sum, line) => sum + Number(line.expectedQty || 0), 0),
            received: (selectedRequest.details || []).reduce((sum, line) => sum + Number(line.receivedQty || 0), 0),
        }
        : null;

    const addRow = () => {
        setForm((current) => ({ ...current, items: [...current.items, makeRow(current.warehouseCode || accessibleWarehouses[0]?.code || 'KHO-NVL')] }));
    };

    const updateRow = (rowId: string, patch: Partial<FormLine>) => {
        setForm((current) => ({
            ...current,
            items: current.items.map((item) => (item.rowId === rowId ? { ...item, ...patch } : item)),
        }));
    };

    const removeRow = (rowId: string) => {
        setForm((current) => ({
            ...current,
            items: current.items.length > 1 ? current.items.filter((item) => item.rowId !== rowId) : [makeRow(current.warehouseCode || accessibleWarehouses[0]?.code || 'KHO-NVL')],
        }));
    };

    const onProductChange = (rowId: string, productId: string) => {
        const selectedProduct = products.find((item) => item.id === productId);
        updateRow(rowId, {
            productId,
            unitPrice: selectedProduct ? String(selectedProduct.price || 0) : '0',
        });
    };

    const addDefaultProduct = () => {
        const firstProduct = products[0];
        setForm((current) => ({
            ...current,
            items: [
                ...current.items,
                {
                    ...makeRow(current.warehouseCode || accessibleWarehouses[0]?.code || 'KHO-NVL'),
                    productId: firstProduct?.id || '',
                    unitPrice: firstProduct ? String(firstProduct.price || 0) : '0',
                },
            ],
        }));
    };

    React.useEffect(() => {
        if (modalMode === 'create' && form.customerId && form.items.length === 1 && !form.items[0].productId && products[0]?.id) {
            setForm((current) => ({
                ...current,
                items: [
                    {
                        ...current.items[0],
                        productId: products[0].id,
                        unitPrice: String(products[0].price || 0),
                    },
                ],
            }));
        }
    }, [form.items, form.customerId, modalMode, products]);

    return (
        <div className="space-y-4">
            {toast && (
                <div className={`fixed right-4 top-4 z-[70] flex items-center gap-3 rounded-xl border bg-white px-4 py-3 shadow-xl ${toast.type === 'error' ? 'border-red-200 text-red-600' : 'border-emerald-200 text-emerald-600'}`}>
                    {toast.type === 'error' ? <XCircle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
                    <p className="text-sm font-bold">{toast.message}</p>
                    <button type="button" onClick={() => setToast(null)} className="rounded-lg p-1 hover:bg-slate-100">
                        <X className="h-4 w-4" />
                    </button>
                </div>
            )}

            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                    <h1 className="text-2xl font-black text-slate-900">Đề nghị nhập hàng trả lại</h1>
                </div>
                <button
                    type="button"
                    onClick={openCreate}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-cyan-700"
                >
                    <PlusCircle className="h-4 w-4" />
                    Tạo yêu cầu trả hàng
                </button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-black uppercase text-slate-500">Tổng số phiếu</p>
                    <p className="mt-2 text-3xl font-black text-slate-900">{requests.length}</p>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
                    <p className="text-xs font-black uppercase text-amber-600">Chờ duyệt</p>
                    <p className="mt-2 text-3xl font-black text-amber-700">{draftCount}</p>
                </div>
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
                    <p className="text-xs font-black uppercase text-blue-600">Đã duyệt</p>
                    <p className="mt-2 text-3xl font-black text-blue-700">{approvedCount}</p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
                    <p className="text-xs font-black uppercase text-emerald-600">Hoàn thành</p>
                    <p className="mt-2 text-3xl font-black text-emerald-700">{completedCount}</p>
                </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.2fr_0.9fr_0.9fr_auto]">
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                        <input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white pl-11 pr-4 text-sm font-medium outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                            placeholder="Tìm theo số phiếu, khách hàng, diễn giải, mặt hàng..."
                        />
                    </div>
                    <select
                        value={timeFilter}
                        onChange={(event) => setTimeFilter(event.target.value as TimeFilter)}
                        className="h-11 rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                    >
                        <option value="this-month">Thời gian: Tháng này</option>
                        <option value="7-days">Thời gian: 7 ngày gần đây</option>
                        <option value="all">Thời gian: Tất cả</option>
                    </select>
                    <select
                        value={statusFilter}
                        onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
                        className="h-11 rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                    >
                        <option value="all">Tình trạng: Tất cả</option>
                        <option value="waiting">Tình trạng: Chờ duyệt</option>
                        <option value="approved">Tình trạng: Đã duyệt</option>
                        <option value="partial">Tình trạng: Nhận một phần</option>
                        <option value="done">Tình trạng: Hoàn thành</option>
                        <option value="cancelled">Tình trạng: Đã hủy</option>
                    </select>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                setSearch('');
                                setStatusFilter('all');
                                setTimeFilter('this-month');
                            }}
                            className="inline-flex h-11 items-center justify-center rounded-xl border-2 border-slate-200 bg-white px-3 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
                            title="Đặt lại bộ lọc"
                        >
                            <RefreshCw className="h-4 w-4" />
                        </button>
                        <button
                            type="button"
                            className="inline-flex h-11 items-center justify-center rounded-xl border-2 border-slate-200 bg-white px-3 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
                            title="Cài đặt"
                        >
                            <Filter className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[1180px] border-collapse bg-white">
                        <thead className="bg-slate-50">
                        <tr className="border-b border-slate-200">
                            <th className="w-16 border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">#</th>
                            <th className="border-x border-slate-200 px-3 py-4 text-left text-sm font-black uppercase text-slate-700">Số yêu cầu</th>
                            <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Ngày yêu cầu</th>
                            <th className="border-x border-slate-200 px-3 py-4 text-left text-sm font-black uppercase text-slate-700">Khách hàng</th>
                            <th className="border-x border-slate-200 px-3 py-4 text-left text-sm font-black uppercase text-slate-700">Diễn giải</th>
                            <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Tổng tiền</th>
                            <th className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Tình trạng</th>
                            <th className="sticky right-0 w-36 border-l border-slate-200 bg-slate-50 px-3 py-4 text-center text-sm font-black uppercase text-slate-700 shadow-[-4px_0_12px_rgba(0,0,0,0.03)]">
                                Thao tác
                            </th>
                        </tr>
                        </thead>
                        <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={8} className="px-6 py-12 text-center text-sm font-medium text-slate-500">
                                    Đang tải danh sách yêu cầu trả hàng...
                                </td>
                            </tr>
                        ) : paginatedRequests.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="px-6 py-12 text-center text-sm font-medium text-slate-500">
                                    Chưa có yêu cầu trả hàng phù hợp.
                                </td>
                            </tr>
                        ) : (
                            paginatedRequests.map((request, index) => (
                                <tr
                                    key={request.id}
                                    onClick={() => setSelectedId(request.id)}
                                    className={`group cursor-pointer border-b border-slate-200 transition hover:bg-cyan-50/50 ${selectedRequest?.id === request.id ? 'bg-blue-50/50' : ''}`}
                                >
                                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-semibold text-slate-600">{startIndex + index}</td>
                                    <td className="border-x border-slate-200 px-3 py-4 text-sm font-black text-blue-600">{request.requestNumber}</td>
                                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-semibold text-slate-700">
                      <span className="inline-flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-slate-400" />
                          {formatDate(request.requestDate)}
                      </span>
                                    </td>
                                    <td className="border-x border-slate-200 px-3 py-4 text-sm font-semibold text-slate-700">
                                        {request.customer?.name || '-'}
                                        <p className="mt-1 text-xs font-semibold text-slate-400">{request.customer?.customerCode || '-'}</p>
                                    </td>
                                    <td className="border-x border-slate-200 px-3 py-4 text-sm text-slate-600">{request.description || '-'}</td>
                                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black text-slate-900">{formatMoney(request.totalAmount)}</td>
                                    <td className="border-x border-slate-200 px-3 py-4 text-center align-middle">
                      <span className={`inline-flex rounded-lg border px-3 py-1 text-xs font-bold ${statusClass(request.status)}`}>
                        {statusLabel(request.status)}
                      </span>
                                    </td>
                                    <td className="sticky right-0 border-l border-slate-200 bg-white px-3 py-4 text-center align-middle shadow-[-4px_0_12px_rgba(0,0,0,0.03)] group-hover:bg-cyan-50/50">
                                        <div className="flex items-center justify-center gap-2">
                                            <button
                                                type="button"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    setSelectedId(request.id);
                                                }}
                                                className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 transition-colors hover:bg-cyan-100 hover:text-cyan-700"
                                                title="Xem"
                                            >
                                                <ArrowUpRight className="h-4 w-4" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    openEdit(request);
                                                }}
                                                className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 transition-colors hover:bg-cyan-100 hover:text-cyan-700"
                                                title="Sửa"
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    setDeleteTarget(request);
                                                    setModalMode('delete');
                                                }}
                                                className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-600 transition-colors hover:bg-red-100"
                                                title="Xóa"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                        </tbody>
                    </table>
                </div>

                <div className="flex flex-col items-center justify-between gap-4 border-t border-slate-200 bg-slate-50/50 px-6 py-3 sm:flex-row">
                    <div className="text-sm text-slate-600">
                        Tổng số: <b>{totalItems}</b>
                        {totalItems > 0 && <span className="ml-2">Hiển thị {startIndex} - {endIndex}</span>}
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-slate-600">Số dòng/trang</span>
                        <select
                            value={pageSize}
                            onChange={(event) => {
                                setPageSize(Number(event.target.value));
                                setCurrentPage(1);
                            }}
                            className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                        >
                            <option value={5}>5</option>
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                        </select>
                        <div className="flex items-center gap-1">
                            <button type="button" onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40">
                                «
                            </button>
                            <button type="button" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage === 1} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40">
                                ‹
                            </button>
                            <button type="button" className="flex h-9 min-w-9 items-center justify-center rounded-lg bg-cyan-600 px-3 text-sm font-bold text-white">
                                {currentPage}
                            </button>
                            <button type="button" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={currentPage === totalPages} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40">
                                ›
                            </button>
                            <button type="button" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40">
                                »
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {selectedRequest && selectedRequestMetrics && (
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                            <p className="text-2xl font-black text-slate-900">Yêu cầu trả hàng {selectedRequest.requestNumber}</p>
                            <p className="mt-1 text-sm font-medium text-slate-500">{selectedRequest.customer?.name || '-'} · {formatDate(selectedRequest.requestDate)}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-lg border px-3 py-1 text-sm font-bold ${statusClass(selectedRequest.status)}`}>{statusLabel(selectedRequest.status)}</span>
                            <button type="button" onClick={() => setSelectedId(null)} className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" title="Đóng chi tiết">
                                <ChevronLeft className="h-5 w-5" />
                            </button>
                        </div>
                    </div>

                    <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_280px]">
                        <div className="border-b border-slate-200 p-5 lg:border-b-0 lg:border-r">
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                                <Field label="Mã yêu cầu" value={selectedRequest.requestNumber} />
                                <Field label="Khách hàng" value={selectedRequest.customer?.name || '-'} />
                                <Field label="Ngày yêu cầu" value={formatDate(selectedRequest.requestDate)} />
                                <Field label="Ngày dự kiến" value={formatDate(selectedRequest.expectedDate)} />
                                <Field label="Diễn giải" value={selectedRequest.description || '-'} />
                                <Field label="Tổng tiền" value={formatMoney(selectedRequest.totalAmount)} />
                            </div>
                        </div>

                        <div className="p-5">
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <div className="flex items-center gap-2">
                                    <Clock3 className="h-4 w-4 text-cyan-600" />
                                    <p className="text-sm font-black uppercase text-slate-700">Tổng quan</p>
                                </div>
                                <div className="mt-4 space-y-3">
                                    <SummaryRow label="Số dòng hàng" value={`${selectedRequestMetrics.lines}`} />
                                    <SummaryRow label="SL yêu cầu" value={`${selectedRequestMetrics.ordered}`} />
                                    <SummaryRow label="SL đã nhận" value={`${selectedRequestMetrics.received}`} />
                                    <SummaryRow label="Tổng tiền" value={formatMoney(selectedRequest.totalAmount)} />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-slate-200 px-5 py-4">
                        <div className="mb-3 flex items-center gap-2">
                            <Undo2 className="h-5 w-5 text-cyan-600" />
                            <h3 className="text-lg font-black text-slate-900">Hàng hóa</h3>
                        </div>
                        <div className="overflow-hidden rounded-xl border border-slate-200">
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[980px] border-collapse bg-white">
                                    <thead className="bg-slate-50">
                                    <tr className="border-b border-slate-200">
                                        <th className="w-14 border-x border-slate-200 px-3 py-3 text-center text-sm font-black uppercase text-slate-700">#</th>
                                        <th className="border-x border-slate-200 px-3 py-3 text-left text-sm font-black uppercase text-slate-700">Mã hàng</th>
                                        <th className="border-x border-slate-200 px-3 py-3 text-left text-sm font-black uppercase text-slate-700">Tên hàng</th>
                                        <th className="border-x border-slate-200 px-3 py-3 text-center text-sm font-black uppercase text-slate-700">Kho</th>
                                        <th className="border-x border-slate-200 px-3 py-3 text-center text-sm font-black uppercase text-slate-700">ĐVT</th>
                                        <th className="border-x border-slate-200 px-3 py-3 text-right text-sm font-black uppercase text-slate-700">SL yêu cầu</th>
                                        <th className="border-x border-slate-200 px-3 py-3 text-right text-sm font-black uppercase text-slate-700">SL đã nhận</th>
                                        <th className="border-x border-slate-200 px-3 py-3 text-right text-sm font-black uppercase text-slate-700">Đơn giá</th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {(selectedRequest.details || []).length ? (
                                        (selectedRequest.details || []).map((detail, index) => (
                                            <tr key={detail.id} className="border-b border-slate-200 transition hover:bg-cyan-50/40">
                                                <td className="border-x border-slate-200 px-3 py-3 text-center text-sm font-semibold text-slate-700">{index + 1}</td>
                                                <td className="border-x border-slate-200 px-3 py-3 text-sm font-bold text-slate-800">{detail.product?.internalSku || '-'}</td>
                                                <td className="border-x border-slate-200 px-3 py-3 text-sm font-semibold text-slate-700">{detail.product?.name || '-'}</td>
                                                <td className="border-x border-slate-200 px-3 py-3 text-center text-sm text-slate-600">{detail.warehouseCode || '-'}</td>
                                                <td className="border-x border-slate-200 px-3 py-3 text-center text-sm font-semibold text-slate-700">{detail.product?.unit || '-'}</td>
                                                <td className="border-x border-slate-200 px-3 py-3 text-right text-sm font-black text-slate-900">{detail.expectedQty}</td>
                                                <td className="border-x border-slate-200 px-3 py-3 text-right text-sm font-black text-slate-900">{detail.receivedQty}</td>
                                                <td className="border-x border-slate-200 px-3 py-3 text-right text-sm font-black text-slate-900">{formatMoney(detail.unitPrice)}</td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={8} className="px-6 py-12 text-center text-sm font-semibold text-slate-500">
                                                Yêu cầu này chưa có dòng hàng nào.
                                            </td>
                                        </tr>
                                    )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:justify-end">
                            <button type="button" onClick={() => approveRequest(selectedRequest)} disabled={saving} className="inline-flex items-center justify-center rounded-xl border-2 border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60">
                                Lập lệnh nhập kho
                            </button>
                            <button type="button" onClick={() => openReceive(selectedRequest)} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-200 bg-cyan-50 px-5 py-2.5 text-sm font-bold text-cyan-700 transition hover:bg-cyan-100 disabled:opacity-60">
                                <Truck className="h-4 w-4" />
                                Nhận hàng
                            </button>
                            <button type="button" onClick={() => completeRequest(selectedRequest)} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-cyan-700 disabled:opacity-60">
                                <CheckCircle2 className="h-4 w-4" />
                                Hoàn thành
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {modalMode && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
                    <form onSubmit={handleSubmit} className="max-h-[92vh] w-full max-w-7xl overflow-hidden rounded-2xl bg-white shadow-2xl">
                        <div className="flex items-start justify-between border-b-2 border-slate-100 px-6 py-4">
                            <div className="flex items-start gap-3">
                                <div className="rounded-xl bg-cyan-50 p-2 text-cyan-600">
                                    <Undo2 className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-slate-900">{modalMode === 'edit' ? 'Sửa yêu cầu trả hàng' : 'Tạo yêu cầu trả hàng'}</h3>
                                    <p className="text-sm font-medium text-slate-500">Chọn khách hàng, sản phẩm và số lượng cần nhập kho.</p>
                                </div>
                            </div>
                            <button type="button" onClick={closeModal} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="max-h-[calc(92vh-150px)] space-y-6 overflow-y-auto px-8 py-6">
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                <Input label="Số yêu cầu" value={form.requestNumber} onChange={(value) => setForm((current) => ({ ...current, requestNumber: value }))} placeholder="Để trống để hệ thống tự sinh" />
                                <div>
                                    <label className="mb-2 block text-sm font-bold text-slate-700">Khách hàng</label>
                                    <select
                                        value={form.customerId}
                                        onChange={(event) => setForm((current) => ({ ...current, customerId: event.target.value, items: current.items.map((item) => ({ ...item, productId: '' })) }))}
                                        className={modalSelectClass}
                                    >
                                        <option value="">Chọn khách hàng</option>
                                        {customers.map((customer) => (
                                            <option key={customer.id} value={customer.id}>
                                                {customer.customerCode} - {customer.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <Input label="Ngày yêu cầu" type="date" value={form.requestDate} onChange={(value) => setForm((current) => ({ ...current, requestDate: value }))} />
                                <Input label="Ngày dự kiến" type="date" value={form.expectedDate} onChange={(value) => setForm((current) => ({ ...current, expectedDate: value }))} />
                                <Input label="Người tạo" value={form.creatorName || ''} onChange={(value) => setForm((current) => ({ ...current, creatorName: value }))} />
                                <Input label="SĐT người tạo" value={form.creatorPhone || ''} onChange={(value) => setForm((current) => ({ ...current, creatorPhone: value }))} />
                                <div>
                                    <label className="mb-2 block text-sm font-bold text-slate-700">Kho mặc định</label>
                                    <select
                                        value={form.warehouseCode || ''}
                                        onChange={(event) =>
                                            setForm((current) => ({
                                                ...current,
                                                warehouseCode: event.target.value,
                                                approverId: '',
                                                items: current.items.map((item) => ({
                                                    ...item,
                                                    warehouseCode: event.target.value || item.warehouseCode,
                                                })),
                                            }))
                                        }
                                        className={modalSelectClass}
                                        disabled={warehouseOptions.length === 0}
                                    >
                                        <option value="">Chọn kho</option>
                                        {warehouseOptions.map((w) => (
                                            <option key={w.id} value={w.code}>
                                                {w.code} - {w.name}
                                            </option>
                                        ))}
                                    </select>
                                    {accessibleWarehouses.length === 0 && (
                                        <p className="mt-2 text-xs font-semibold text-amber-600">
                                            Bạn chưa được gán kho nào. Hãy nhờ quản lý kho phân quyền trước khi tạo yêu cầu.
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <label className="mb-2 block text-sm font-bold text-slate-700">Người duyệt</label>
                                    <select
                                        value={form.approverId || ''}
                                        onChange={(event) => setForm((current) => ({ ...current, approverId: event.target.value }))}
                                        className={modalSelectClass}
                                        disabled={approverOptions.length === 0 || !form.warehouseCode}
                                    >
                                        <option value="">Chọn người duyệt</option>
                                        {approverOptions.map((u) => (
                                            <option key={u.id} value={u.id}>
                                                {u.fullName || u.email}
                                            </option>
                                        ))}
                                    </select>
                                    {!form.warehouseCode ? (
                                        <p className="mt-2 text-xs font-semibold text-slate-500">Chọn kho trước để lọc người duyệt.</p>
                                    ) : approverOptions.length === 0 ? (
                                        <p className="mt-2 text-xs font-semibold text-amber-600">
                                            Kho này chưa có quản lý được gán. Hãy gán quản lý kho trong màn Nhân sự.
                                        </p>
                                    ) : null}
                                </div>
                                <div>
                                    <label className="mb-2 block text-sm font-bold text-slate-700">Trạng thái</label>
                                    <select
                                        value={form.status}
                                        onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as RequestStatus }))}
                                        className={modalSelectClass}
                                    >
                                        <option value="CREATED">Chờ duyệt</option>
                                        <option value="APPROVED">Đã duyệt</option>
                                        <option value="PARTIALLY_RECEIVED">Nhận một phần</option>
                                        <option value="RECEIVED">Hoàn thành</option>
                                        <option value="CANCELLED">Đã hủy</option>
                                    </select>
                                </div>
                                <div className="md:col-span-2 xl:col-span-3">
                                    <label className="mb-2 block text-sm font-bold text-slate-700">Diễn giải</label>
                                    <textarea
                                        value={form.description}
                                        onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                                        className="min-h-24 w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                                        placeholder="Ghi chú cho yêu cầu trả hàng"
                                    />
                                </div>
                            </div>

                            <section>
                                <div className="mb-4 flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                        <Undo2 className="h-5 w-5 text-cyan-600" />
                                        <h4 className="font-black text-slate-900">Hàng hóa</h4>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={addRow}
                                        className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-200 bg-cyan-50 px-4 py-2 text-sm font-bold text-cyan-700 transition hover:bg-cyan-100"
                                    >
                                        <PlusCircle className="h-4 w-4" />
                                        Thêm dòng
                                    </button>
                                </div>

                                <div className="overflow-hidden rounded-xl border border-slate-200">
                                    <div className="overflow-x-auto">
                                        <table className="w-full min-w-[1100px] bg-white">
                                            <thead className="bg-slate-50">
                                            <tr>
                                                <th className="w-16 px-3 py-3 text-center text-xs font-black uppercase text-slate-700">STT</th>
                                                <th className="px-3 py-3 text-center text-xs font-black uppercase text-slate-700">Mặt hàng</th>
                                                <th className="px-3 py-3 text-center text-xs font-black uppercase text-slate-700">SL yêu cầu</th>
                                                <th className="px-3 py-3 text-center text-xs font-black uppercase text-slate-700">SL đã nhận</th>
                                                <th className="px-3 py-3 text-center text-xs font-black uppercase text-slate-700">Đơn giá</th>
                                                <th className="px-3 py-3 text-center text-xs font-black uppercase text-slate-700">Thành tiền</th>
                                                <th className="px-3 py-3 text-center text-xs font-black uppercase text-slate-700">Xóa</th>
                                            </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200 bg-white">
                                            {form.items.map((item, index) => {
                                                const expectedQty = parseMoney(item.expectedQty);
                                                const unitPrice = parseMoney(item.unitPrice);
                                                return (
                                                    <tr key={item.rowId}>
                                                        <td className="px-3 py-3 text-center text-sm font-semibold text-slate-700">{index + 1}</td>
                                                        <td className="px-3 py-3">
                                                            <select
                                                                value={item.productId}
                                                                onChange={(event) => onProductChange(item.rowId, event.target.value)}
                                                                className="h-10 w-full rounded-xl border-2 border-slate-200 bg-white px-4 pr-10 text-sm outline-none appearance-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                                                            >
                                                                <option value="">Chọn mặt hàng</option>
                                                                {products.map((product) => (
                                                                    <option key={product.id} value={product.id}>
                                                                        {product.internalSku} - {product.name}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </td>
                                                        <td className="px-3 py-3">
                                                            <input
                                                                type="number"
                                                                min={0}
                                                                value={item.expectedQty}
                                                                onChange={(event) => updateRow(item.rowId, { expectedQty: event.target.value })}
                                                                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-right text-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                                                            />
                                                        </td>
                                                        <td className="px-3 py-3">
                                                            <input
                                                                type="number"
                                                                min={0}
                                                                value={item.receivedQty}
                                                                onChange={(event) => updateRow(item.rowId, { receivedQty: event.target.value })}
                                                                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-right text-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                                                            />
                                                        </td>
                                                        <td className="px-3 py-3">
                                                            <input
                                                                type="number"
                                                                min={0}
                                                                value={item.unitPrice}
                                                                onChange={(event) => updateRow(item.rowId, { unitPrice: event.target.value })}
                                                                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-right text-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                                                            />
                                                        </td>
                                                        <td className="px-3 py-3 text-right text-sm font-black text-slate-900">{formatMoney(expectedQty * unitPrice)}</td>
                                                        <td className="px-3 py-3 text-center">
                                                            <button type="button" onClick={() => removeRow(item.rowId)} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-100">
                                                                <Trash2 className="h-4 w-4" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </section>
                        </div>

                        <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
                            <button type="button" onClick={closeModal} className="rounded-xl border-2 border-slate-200 px-5 py-2.5 font-bold text-slate-600 hover:bg-slate-50">
                                Hủy
                            </button>
                            <button type="button" onClick={addDefaultProduct} className="rounded-xl border-2 border-cyan-200 bg-cyan-50 px-5 py-2.5 font-bold text-cyan-700 hover:bg-cyan-100">
                                Thêm dòng nhanh
                            </button>
                            <button type="submit" disabled={saving} className="rounded-xl bg-cyan-600 px-6 py-2.5 font-bold text-white shadow-sm hover:bg-cyan-700 disabled:opacity-60">
                                {saving ? 'Đang lưu...' : modalMode === 'edit' ? 'Lưu thay đổi' : 'Tạo yêu cầu trả hàng'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {receiveOpen && selectedRequest && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl">
                        <div className="flex items-center justify-between border-b-2 border-slate-100 px-6 py-4">
                            <div>
                                <h3 className="text-lg font-black text-slate-900">Nhận hàng cho {selectedRequest.requestNumber}</h3>
                                <p className="text-sm font-medium text-slate-500">Nhập số lượng thực tế đã nhận vào kho.</p>
                            </div>
                            <button type="button" onClick={() => setReceiveOpen(false)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="max-h-[calc(92vh-140px)] overflow-y-auto px-6 py-5">
                            <div className="space-y-3">
                                {receiveRows.map((row, index) => (
                                    <div key={row.detailId} className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 p-4 md:grid-cols-[1.8fr_0.6fr]">
                                        <div>
                                            <p className="text-sm font-black text-slate-900">{index + 1}. {row.label}</p>
                                            <p className="text-xs font-medium text-slate-500">Nhập số lượng muốn ghi nhận nhận kho.</p>
                                        </div>
                                        <input
                                            type="number"
                                            min={0}
                                            value={row.qty}
                                            onChange={(event) => setReceiveRows((current) => current.map((item) => (item.detailId === row.detailId ? { ...item, qty: event.target.value } : item)))}
                                            className="h-11 w-full rounded-xl border-2 border-slate-200 px-4 text-right text-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
                            <button type="button" onClick={() => setReceiveOpen(false)} className="rounded-xl border-2 border-slate-200 px-5 py-2.5 font-bold text-slate-600 hover:bg-slate-50">
                                Hủy
                            </button>
                            <button type="button" onClick={saveReceive} disabled={saving} className="rounded-xl bg-cyan-600 px-6 py-2.5 font-bold text-white shadow-sm hover:bg-cyan-700 disabled:opacity-60">
                                {saving ? 'Đang lưu...' : 'Lưu nhận hàng'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {modalMode === 'delete' && deleteTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
                        <div className="flex items-center justify-between border-b-2 border-slate-100 px-6 py-4">
                            <div>
                                <h3 className="text-lg font-black text-slate-900">Xóa yêu cầu trả hàng</h3>
                                <p className="text-sm font-medium text-slate-500">Thao tác này không thể hoàn tác.</p>
                            </div>
                            <button type="button" onClick={closeModal} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="px-6 py-5">
                            <p className="text-sm text-slate-700">
                                Bạn có chắc muốn xóa yêu cầu trả hàng <span className="font-black text-slate-950">{deleteTarget.requestNumber}</span> không?
                            </p>
                            <div className="mt-8 flex justify-end gap-3">
                                <button type="button" onClick={closeModal} className="rounded-xl border-2 border-slate-200 px-5 py-2.5 font-bold text-slate-600 hover:bg-slate-50">
                                    Hủy
                                </button>
                                <button type="button" onClick={handleDelete} disabled={saving} className="rounded-xl bg-red-600 px-5 py-2.5 font-bold text-white shadow-sm hover:bg-red-700 disabled:opacity-60">
                                    {saving ? 'Đang xóa...' : 'Xóa'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function Input({
                   label,
                   value,
                   onChange,
                   placeholder,
                   type = 'text',
               }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    type?: React.InputHTMLAttributes<HTMLInputElement>['type'];
}) {
    return (
        <div>
            <label className="mb-2 block text-sm font-bold text-slate-700">{label}</label>
            <input
                type={type}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                className="h-11 w-full rounded-xl border-2 border-slate-200 px-4 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
            />
        </div>
    );
}

export default function ReturnRequestsPage() {
    return <ReturnRequestsPageContent />;
}

export function InboundReturnRequestsComingSoon() {
    return (
        <div className="flex min-h-[400px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
            <h2 className="text-xl font-black text-slate-900">Đề nghị nhập kho hàng trả lại</h2>
            <p className="mt-2 max-w-md text-sm font-medium text-slate-500">
                Màn hình này có thể được nối tiếp sau khi bạn chốt xong luồng đơn trả hàng.
            </p>
        </div>
    );
}