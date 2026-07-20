import React from 'react';
import {
    Download,
    Eye,
    FileSpreadsheet,
    Upload,
    Pencil,
    Plus,
    Search,
    Tags,
    Trash2,
    X,
    Check,
    ChevronDown,
} from 'lucide-react';
const XLSX: any = (typeof window !== 'undefined' && (window as any).XLSX) || {
  read: () => ({ SheetNames: [], Sheets: {} }),
  utils: { sheet_to_json: () => [] },
};
import Toast from '../../shared/components/Toast';
import {
    CATALOG_CATEGORY_TYPES,
    type CatalogCategory,
    type CatalogCategoryStatus,
    type CatalogCategoryType,
    getCatalogCategoryTypeLabel,
    getStoredCatalogCategories,
    saveStoredCatalogCategories,
} from '../../shared/utils/catalogCategories';

type CategoryForm = {
    type: CatalogCategoryType;
    code: string;
    name: string;
    description: string;
    status: CatalogCategoryStatus;
};

type ModalMode = 'create' | 'view' | 'edit' | 'delete' | 'mass-delete' | 'import' | 'export' | 'import-result' | null;
type ExportMode = 'rows' | 'sheets';
type ImportSummary = {
    successCount: number;
    failedCount: number;
    details: string[];
};

const statusOptions = [
    { value: 'all', label: 'Tất cả' },
    { value: 'active', label: 'Đang dùng' },
    { value: 'inactive', label: 'Ngừng dùng' },
];

const excelHeaders = ['STT', 'Mã danh mục', 'Tên danh mục', 'Ghi chú', 'Trạng thái'];
const API_BASE_URL = 'http://localhost:3000/api';

function escapeXml(value: unknown) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function normalizeStatusLabel(value: string): CatalogCategoryStatus {
    return value.trim().toLowerCase().includes('ngừng') || value.trim().toLowerCase().includes('inactive')
        ? 'inactive'
        : 'active';
}

function normalizeApiCategory(category: Partial<CatalogCategory> & { id?: string }) {
    const name = (category.name || '').trim();
    return {
        id: category.id || crypto.randomUUID(),
        type: category.type || 'item-group',
        code: (category.code?.trim() || name.toUpperCase().replace(/\s+/g, '-')).toUpperCase(),
        name,
        description: category.description?.trim() || '',
        status: category.status === 'inactive' ? 'inactive' : 'active',
        createdAt: category.createdAt || new Date().toISOString(),
    } satisfies CatalogCategory;
}

function normalizeApiCategories(categories: Array<Partial<CatalogCategory> & { id?: string }>) {
    const seen = new Set<string>();
    return categories
        .map(normalizeApiCategory)
        .filter((category) => {
            const key = `${category.type}:${category.code}`.toLowerCase();
            if (!category.name || seen.has(key)) return false;
            seen.add(key);
            return true;
        });
}

function authHeaders() {
    return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
    };
}

async function syncCategoriesToBackend(categories: CatalogCategory[]) {
    try {
        await fetch(`${API_BASE_URL}/categories/sync`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ categories }),
        });
    } catch {
        // Keep local edits working even if backend sync is temporarily unavailable.
    }
}

function generateExcelFile(fileName: string, sheets: Array<{ name: string; rows: any[][] }>) {
    const wb = XLSX.utils.book_new();
    sheets.forEach(sheet => {
        const ws = XLSX.utils.aoa_to_sheet(sheet.rows);
        XLSX.utils.book_append_sheet(wb, ws, sheet.name);
    });
    XLSX.writeFile(wb, fileName);
}

function buildEmptyForm(): CategoryForm {
    return {
        type: 'item-group',
        code: '',
        name: '',
        description: '',
        status: 'active',
    };
}

function buildForm(category: CatalogCategory): CategoryForm {
    return {
        type: category.type,
        code: category.code,
        name: category.name,
        description: category.description,
        status: category.status,
    };
}

function getStatusLabel(status: CatalogCategoryStatus) {
    return status === 'active' ? 'Đang dùng' : 'Ngừng dùng';
}

function getStatusClass(status: CatalogCategoryStatus) {
    return status === 'active'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
        : 'border-slate-200 bg-slate-100 text-slate-600';
}

export default function CategoryManagement() {
    const [categories, setCategories] = React.useState<CatalogCategory[]>(() => getStoredCatalogCategories());
    const [search, setSearch] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState<'all' | CatalogCategoryStatus>('all');

    // Custom dropdown states
    const [isStatusOpen, setIsStatusOpen] = React.useState(false);

    // Refs for click outside
    const statusDropdownRef = React.useRef<HTMLDivElement>(null);

    // Selection states
    const [selectedIds, setSelectedIds] = React.useState<string[]>([]);

    const [modalMode, setModalMode] = React.useState<ModalMode>(null);
    const [selectedCategory, setSelectedCategory] = React.useState<CatalogCategory | null>(null);
    const [form, setForm] = React.useState<CategoryForm>(() => buildEmptyForm());
    const [error, setError] = React.useState('');
    const [success, setSuccess] = React.useState('');
    const [pageSize, setPageSize] = React.useState(20);
    const [currentPage, setCurrentPage] = React.useState(1);
    const [exportMode, setExportMode] = React.useState<ExportMode>('sheets');
    const [importSummary, setImportSummary] = React.useState<ImportSummary | null>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
        saveStoredCatalogCategories(categories);
        void syncCategoriesToBackend(categories);
    }, [categories]);

    React.useEffect(() => {
        let cancelled = false;

        const loadCategories = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/categories`, { headers: authHeaders() });
                if (!response.ok) {
                    throw new Error('Failed to load categories');
                }

                const data = (await response.json()) as Array<Partial<CatalogCategory> & { id?: string }>;
                const backendCategories = Array.isArray(data) ? normalizeApiCategories(data) : [];
                if (!cancelled && backendCategories.length > 0) {
                    setCategories(backendCategories);
                    saveStoredCatalogCategories(backendCategories);
                    return;
                }
            } catch {
                // Fall back to local storage below.
            }

            if (!cancelled) {
                setCategories(getStoredCatalogCategories());
            }
        };

        void loadCategories();
        return () => {
            cancelled = true;
        };
    }, []);

    React.useEffect(() => {
        setCurrentPage(1);
        setSelectedIds([]); // Clear selection when filters change
    }, [search, statusFilter]);

    // Click outside listener for dropdowns
    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
                setIsStatusOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const filteredCategories = categories.filter((category) => {
        const keyword = search.trim().toLowerCase();
        const matchesKeyword =
            !keyword ||
            category.code.toLowerCase().includes(keyword) ||
            category.name.toLowerCase().includes(keyword) ||
            category.description.toLowerCase().includes(keyword);
        const matchesStatus = statusFilter === 'all' || category.status === statusFilter;

        return matchesKeyword && matchesStatus;
    });

    const totalItems = filteredCategories.length;
    const totalPages = Math.ceil(totalItems / pageSize) || 1;
    const paginatedCategories = filteredCategories.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    const startIndex = (currentPage - 1) * pageSize + 1;
    const endIndex = Math.min(currentPage * pageSize, totalItems);
    const activeCount = categories.filter((category) => category.status === 'active').length;
    const inactiveCount = categories.filter((category) => category.status === 'inactive').length;

    const closeModal = () => {
        setModalMode(null);
        setSelectedCategory(null);
    };

    const openImportModal = () => {
        setError('');
        setSuccess('');
        setImportSummary(null);
        setModalMode('import');
    };

    const openExportModal = () => {
        setError('');
        setSuccess('');
        setExportMode('sheets');
        setModalMode('export');
    };

    const openCreateModal = () => {
        setError('');
        setSuccess('');
        setSelectedCategory(null);
        setForm(buildEmptyForm());
        setModalMode('create');
    };

    const openCategoryModal = (mode: Exclude<ModalMode, 'create' | null>, category: CatalogCategory) => {
        setError('');
        setSuccess('');
        setSelectedCategory(category);
        setForm(buildForm(category));
        setModalMode(mode);
    };

    const buildRowsByType = (type: CatalogCategoryType) => [
        excelHeaders,
        ...filteredCategories
            .filter((category) => category.type === type)
            .map((category) => [category.code, category.name, category.description, getStatusLabel(category.status)]),
    ];

    const buildRows = () => [
        excelHeaders,
        ...filteredCategories.map((category, index) => [
            String(index + 1),
            category.code,
            category.name,
            category.description,
            getStatusLabel(category.status)
        ]),
    ];

    const downloadImportTemplate = () => {
        const sheets = [{
            name: 'Danh muc',
            rows: [excelHeaders, ['1', '', '', '', 'Đang dùng']],
        }];
        generateExcelFile('mau-import-danh-muc.xlsx', sheets);
    };

    const handleExport = () => {
        const sheets = [{
            name: 'Danh muc',
            rows: buildRows(),
        }];
        generateExcelFile('danh-muc.xlsx', sheets);
        setSuccess('Đã xuất file danh mục.');
        closeModal();
    };

    const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;

        try {
            const buffer = await file.arrayBuffer();
            const workbook = XLSX.read(buffer, { type: 'array' });
            
            const nextCategories = [...categories];
            const details: string[] = [];
            let successCount = 0;
            let failedCount = 0;

            if (workbook.SheetNames.length === 0) {
                setImportSummary({
                    successCount: 0,
                    failedCount: 1,
                    details: ['Không tìm thấy sheet hợp lệ trong file Excel.'],
                });
                setModalMode('import-result');
                return;
            }

            // Always take the first sheet for simplicity
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const rawRows = (XLSX.utils.sheet_to_json(sheet, { header: 1 }) || []) as any[];
            
            if (rawRows.length > 0) {
                // Find header row dynamically
                const headerRowIndex = rawRows.findIndex((r: any) => r && r.length > 0 && String(r[0] || '').toLowerCase().includes('mã') || String(r[1] || '').toLowerCase().includes('mã'));
                const headerRow = headerRowIndex >= 0 ? rawRows[headerRowIndex] : rawRows[0];
                const actualRows = headerRowIndex >= 0 ? rawRows.slice(headerRowIndex + 1) : rawRows.slice(1);

                let codeIdx = 1, nameIdx = 2, descIdx = 3, statusIdx = 4;
                if (headerRow) {
                    const headers = headerRow.map((h: any) => String(h || '').trim().toLowerCase());
                    const cIdx = headers.findIndex((h: string) => h.includes('mã'));
                    const nIdx = headers.findIndex((h: string) => h.includes('tên'));
                    const dIdx = headers.findIndex((h: string) => h.includes('ghi chú') || h.includes('ý nghĩa') || h.includes('mô tả'));
                    const sIdx = headers.findIndex((h: string) => h.includes('trạng thái'));
                    
                    if (cIdx >= 0) codeIdx = cIdx;
                    if (nIdx >= 0) nameIdx = nIdx;
                    if (dIdx >= 0) descIdx = dIdx;
                    else descIdx = -1; // Not found
                    if (sIdx >= 0) statusIdx = sIdx;
                    else statusIdx = -1; // Not found
                }
                
                actualRows.forEach((row: any, index: number) => {
                    if (!row || !row.length) return;
                    
                    const code = String(row[codeIdx] ?? '').trim();
                    const name = String(row[nameIdx] ?? '').trim();
                    const description = descIdx >= 0 ? String(row[descIdx] ?? '').trim() : '';
                    const status = statusIdx >= 0 ? String(row[statusIdx] ?? '').trim() : '';
                    const rowNumber = (headerRowIndex >= 0 ? headerRowIndex : 0) + index + 2;

                    if (!code && !name && !description && !status) return;

                    if (!code || !name) {
                        failedCount += 1;
                        details.push(`Dòng ${rowNumber}: thiếu mã hoặc tên danh mục.`);
                        return;
                    }

                    const normalizedCode = code.toUpperCase();
                    const duplicateCode = nextCategories.some(
                        (category) => category.code.toUpperCase() === normalizedCode,
                    );

                    if (duplicateCode) {
                        failedCount += 1;
                        details.push(`Dòng ${rowNumber}: mã "${normalizedCode}" đã tồn tại.`);
                        return;
                    }

                    nextCategories.unshift({
                        id: crypto.randomUUID(),
                        type: 'item-group',
                        code: normalizedCode,
                        name,
                        description,
                        status: normalizeStatusLabel(status || 'Đang dùng'),
                        createdAt: new Date().toISOString(),
                    });
                    successCount += 1;
                });
            }

            setCategories(nextCategories);
            const summary = { successCount, failedCount, details };
            setImportSummary(summary);
            setSuccess(summary.successCount > 0 ? `Import thành công ${summary.successCount} dòng.` : '');
            setError(summary.successCount === 0 && summary.failedCount > 0 ? 'Import thất bại. Vui lòng kiểm tra file.' : '');
            setModalMode('import-result');
        } catch (error) {
            console.error('Lỗi đọc file Excel', error);
            setImportSummary({
                successCount: 0,
                failedCount: 1,
                details: ['Không đọc được file. Vui lòng đảm bảo đây là file Excel hợp lệ (.xlsx, .xls).'],
            });
            setModalMode('import-result');
        }
    };

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!form.code.trim() || !form.name.trim()) {
            setError('Vui lòng nhập mã danh mục và tên danh mục.');
            return;
        }

        const normalizedCode = form.code.trim().toUpperCase();
        const duplicateCode = categories.some(
            (category) =>
                category.type === form.type &&
                category.code.toUpperCase() === normalizedCode &&
                category.id !== selectedCategory?.id,
        );

        if (duplicateCode) {
            setError('Mã danh mục đã tồn tại trong cùng loại danh mục.');
            return;
        }

        const payload: CatalogCategory = {
            id: selectedCategory?.id || crypto.randomUUID(),
            type: form.type,
            code: normalizedCode,
            name: form.name.trim(),
            description: form.description.trim(),
            status: form.status,
            createdAt: selectedCategory?.createdAt || new Date().toISOString(),
        };

        setCategories((current) =>
            modalMode === 'edit'
                ? current.map((category) => (category.id === payload.id ? payload : category))
                : [payload, ...current],
        );
        setSuccess(modalMode === 'edit' ? 'Đã cập nhật danh mục.' : 'Đã thêm danh mục mới.');
        closeModal();
    };

    const handleDelete = () => {
        if (!selectedCategory) return;
        setCategories((current) => current.filter((category) => category.id !== selectedCategory.id));
        setSuccess('Đã xóa danh mục.');
        closeModal();
    };

    const modalTitle =
        modalMode === 'create'
            ? 'Thêm danh mục'
            : modalMode === 'view'
                ? 'Chi tiết danh mục'
                : modalMode === 'edit'
                    ? 'Sửa danh mục'
                    : modalMode === 'import'
                        ? 'Import danh mục'
                        : modalMode === 'export'
                            ? 'Export danh mục'
                            : modalMode === 'import-result'
                                ? 'Kết quả import'
                                : modalMode === 'mass-delete'
                                    ? 'Xóa hàng loạt'
                                    : 'Xóa danh mục';

    const modalDescription =
        modalMode === 'import'
            ? 'Import file Excel theo mẫu, chỉ bao gồm 1 sheet dữ liệu'
            : modalMode === 'export'
                ? 'Xuất toàn bộ danh mục thành file Excel'
                : modalMode === 'import-result'
                    ? 'Tổng hợp số dòng import thành công và thất bại'
                    : modalMode === 'mass-delete'
                        ? 'Xóa nhiều danh mục cùng lúc khỏi hệ thống'
                        : 'Chỉ tạo master data, không tạo sản phẩm trong màn này';

    return (
        <div>
            <Toast
                message={error || success}
                type={error ? 'error' : 'success'}
                onClose={() => {
                    setError('');
                    setSuccess('');
                }}
            />
            <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.xml"
                className="hidden"
                onChange={handleImportFile}
            />

            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                    <h1 className="text-2xl font-black text-cyan-950">Danh mục</h1>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <button
                        type="button"
                        onClick={openImportModal}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-600 bg-white px-4 py-2.5 text-sm font-bold text-cyan-700 transition hover:bg-cyan-50"
                    >
                        <Upload className="h-4 w-4" />
                        Import
                    </button>
                    <button
                        type="button"
                        onClick={openExportModal}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-600 bg-white px-4 py-2.5 text-sm font-bold text-cyan-700 transition hover:bg-cyan-50"
                    >
                        <Download className="h-4 w-4" />
                        Xuất Excel
                    </button>
                    <button
                        type="button"
                        onClick={openCreateModal}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-cyan-700"
                    >
                        <Plus className="h-4 w-4" />
                        Thêm danh mục
                    </button>
                </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3 border-b-2 border-slate-100">
                <button
                    type="button"
                    onClick={() => setStatusFilter('all')}
                    className={`border-b-2 px-3 pb-3 text-sm font-black ${
                        statusFilter === 'all' ? 'border-cyan-600 text-cyan-600' : 'border-transparent text-slate-500'
                    }`}
                >
                    Tất cả ({categories.length})
                </button>
                <button
                    type="button"
                    onClick={() => setStatusFilter('active')}
                    className={`border-b-2 px-3 pb-3 text-sm font-bold ${
                        statusFilter === 'active' ? 'border-cyan-600 text-cyan-600' : 'border-transparent text-slate-500'
                    }`}
                >
                    Đang dùng ({activeCount})
                </button>
                <button
                    type="button"
                    onClick={() => setStatusFilter('inactive')}
                    className={`border-b-2 px-3 pb-3 text-sm font-bold ${
                        statusFilter === 'inactive' ? 'border-cyan-600 text-cyan-600' : 'border-transparent text-slate-500'
                    }`}
                >
                    Ngừng dùng ({inactiveCount})
                </button>
            </div>

            <div className="mt-4 rounded-2xl border-2 border-slate-200 bg-white p-4 shadow-sm">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr_1fr] items-end">
                    <div className="relative">
                        <label className="mb-1.5 block text-sm font-bold text-slate-700">Từ khóa tìm kiếm</label>
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                            <input
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                className="h-11 w-full rounded-xl border-2 border-slate-200 bg-slate-50 pl-11 pr-4 text-sm font-semibold outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                                placeholder="Tìm kiếm mã, tên hoặc ý nghĩa danh mục..."
                            />
                        </div>
                    </div>

                    <div className="relative" ref={statusDropdownRef}>
                        <label className="mb-1.5 block text-sm font-bold text-slate-700">Trạng thái</label>
                        <button
                            type="button"
                            onClick={() => setIsStatusOpen(!isStatusOpen)}
                            className="relative z-20 flex h-11 w-full items-center justify-between rounded-xl border-2 border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700 outline-none transition hover:bg-slate-100 focus:border-cyan-500"
                        >
              <span>
                {statusOptions.find((s) => s.value === statusFilter)?.label || 'Tất cả'}
              </span>
                            <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isStatusOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {isStatusOpen && (
                            <ul className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 max-h-64 overflow-y-auto rounded-xl border-2 border-slate-100 bg-white p-2 shadow-xl">
                                {statusOptions.map((status) => (
                                    <li
                                        key={status.value}
                                        onClick={() => {
                                            setStatusFilter(status.value as 'all' | CatalogCategoryStatus);
                                            setIsStatusOpen(false);
                                        }}
                                        className={`flex cursor-pointer items-center justify-between rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors hover:bg-cyan-50 ${
                                            statusFilter === status.value ? 'bg-cyan-50 text-cyan-700' : 'text-slate-700'
                                        }`}
                                    >
                                        {status.label}
                                        {statusFilter === status.value && <Check className="h-4 w-4 text-cyan-600" />}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            </div>

            {selectedIds.length > 0 && (
                <div className="mt-5 flex items-center justify-between rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 shadow-sm">
          <span className="text-sm font-bold text-cyan-800">
            Đã chọn <b>{selectedIds.length}</b> danh mục trên trang này
          </span>
                    <button
                        onClick={() => setModalMode('mass-delete')}
                        className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-red-700"
                    >
                        <Trash2 className="h-4 w-4" />
                        Xóa đã chọn
                    </button>
                </div>
            )}

            <div className="mt-5 overflow-hidden rounded-xl border-2 border-slate-200 bg-white">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[1120px] border-collapse bg-white">
                        <thead className="bg-slate-50">
                        <tr className="border-b-2 border-slate-200">
                            <th className="w-12 border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">
                                <input
                                    title="Chọn tất cả"
                                    type="checkbox"
                                    checked={paginatedCategories.length > 0 && selectedIds.length === paginatedCategories.length}
                                    onChange={(e) => {
                                        if (e.target.checked) {
                                            setSelectedIds(paginatedCategories.map((c) => c.id!));
                                        } else {
                                            setSelectedIds([]);
                                        }
                                    }}
                                    className="h-4 w-4 cursor-pointer rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                                />
                            </th>
                            <th className="w-12 border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">STT</th>
                            <th className="w-40 border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Mã danh mục</th>
                            <th className="w-56 border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Tên danh mục</th>
                            <th className="w-40 border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Số lượng SP</th>
                            <th className="w-48 border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Ghi chú</th>
                            <th className="w-36 border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-700">Trạng thái</th>
                            <th className="sticky right-0 w-36 border-l border-slate-200 bg-slate-50 px-3 py-4 text-center text-sm font-black uppercase text-slate-700 shadow-[-4px_0_12px_rgba(0,0,0,0.03)]">
                                Thao tác
                            </th>
                        </tr>
                        </thead>
                        <tbody>
                        {paginatedCategories.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="px-6 py-12 text-center text-sm font-semibold text-slate-500">
                                    Chưa có danh mục. Hãy tạo danh mục đầu tiên để dùng khi thêm sản phẩm.
                                </td>
                            </tr>
                        ) : (
                            paginatedCategories.map((category, index) => (
                                <tr key={category.id} className="group border-b border-slate-200 transition hover:bg-cyan-50/50">
                                    <td className="border-x border-slate-200 px-3 py-4 text-center">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.includes(category.id!)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedIds((prev) => [...prev, category.id!]);
                                                } else {
                                                    setSelectedIds((prev) => prev.filter((id) => id !== category.id!));
                                                }
                                            }}
                                            className="h-4 w-4 cursor-pointer rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                                        />
                                    </td>
                                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm text-slate-700">
                                        {startIndex + index}
                                    </td>
                                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-black uppercase text-slate-800">
                                        {category.code}
                                    </td>
                                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm text-slate-700">
                                        {category.name}
                                    </td>
                                    <td className="border-x border-slate-200 px-3 py-4 text-center text-sm font-bold text-slate-600">
                                        0
                                    </td>
                                    <td className="border-x border-slate-200 px-3 py-4 text-sm leading-6 text-slate-600">
                                        {category.description || '-'}
                                    </td>
                                    <td className="border-x border-slate-200 px-3 py-4 text-center">
                      <span className={`inline-flex rounded-lg border px-3 py-1 text-xs font-bold ${getStatusClass(category.status)}`}>
                        {getStatusLabel(category.status)}
                      </span>
                                    </td>
                                    <td className="sticky right-0 border-l border-slate-200 bg-white px-3 py-4 text-center align-middle shadow-[-4px_0_12px_rgba(0,0,0,0.03)] group-hover:bg-cyan-50/50">
                                        <div className="flex items-center justify-center gap-2">
                                            <button type="button" onClick={() => openCategoryModal('view', category)} title="Xem" className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 transition-colors hover:bg-cyan-100">
                                                <Eye size={18} strokeWidth={2} />
                                            </button>
                                            <button type="button" onClick={() => openCategoryModal('edit', category)} title="Sửa" className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 transition-colors hover:bg-cyan-100">
                                                <Pencil size={18} strokeWidth={2} />
                                            </button>
                                            <button type="button" onClick={() => openCategoryModal('delete', category)} title="Xóa" className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 transition-colors hover:bg-cyan-100">
                                                <Trash2 size={18} strokeWidth={2} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                        </tbody>
                    </table>
                </div>

                {totalItems > 0 && (
                    <div className="flex flex-col items-center justify-between border-t border-slate-200 bg-slate-50/50 px-6 py-3 sm:flex-row">
                        <div className="text-sm text-slate-600">
                            Tổng số: <b>{totalItems}</b> <span className="ml-2">Hiển thị {startIndex} - {endIndex}</span>
                        </div>
                        <div className="mt-4 flex items-center gap-2 sm:mt-0">
                            <select
                                value={pageSize}
                                onChange={(event) => {
                                    setPageSize(Number(event.target.value));
                                    setCurrentPage(1);
                                }}
                                className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-sm outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                            >
                                <option value={5}>5</option>
                                <option value={20}>20</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                            <div className="flex items-center gap-1">
                                <button type="button" onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50">«</button>
                                <button type="button" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage === 1} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50">‹</button>
                                <button type="button" className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-600 text-sm font-bold text-white">{currentPage}</button>
                                <button type="button" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={currentPage === totalPages} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50">›</button>
                                <button type="button" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50">»</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {modalMode && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm transition-all">
                    <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl">
                        <div className="flex items-center justify-between border-b-2 border-slate-100 px-6 py-4">
                            <div className="flex items-center gap-3">
                                <div className="rounded-xl bg-cyan-50 p-2 text-cyan-600">
                                    {modalMode === 'import' || modalMode === 'import-result' ? (
                                        <Upload className="h-6 w-6" />
                                    ) : modalMode === 'export' ? (
                                        <FileSpreadsheet className="h-6 w-6" />
                                    ) : (
                                        <Tags className="h-6 w-6" />
                                    )}
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-slate-800">{modalTitle}</h2>
                                    <p className="text-sm font-medium text-slate-500">{modalDescription}</p>
                                </div>
                            </div>
                            <button type="button" onClick={closeModal} className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {modalMode === 'import' ? (
                            <div className="px-6 py-5">
                                <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                                    <p className="font-black">Lưu ý trước khi import</p>
                                    <ul className="mt-3 list-disc space-y-2 pl-5 font-semibold">
                                        <li>Cột bắt buộc: Mã danh mục và Tên danh mục.</li>
                                        <li>Mã danh mục không được trùng lặp.</li>
                                        <li>Trạng thái hợp lệ: Đang dùng hoặc Ngừng dùng.</li>
                                    </ul>
                                </div>

                                <div className="mt-8 flex flex-col justify-end gap-3 sm:flex-row">
                                    <button
                                        type="button"
                                        onClick={downloadImportTemplate}
                                        className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-600 px-5 py-2.5 font-bold text-cyan-700 transition hover:bg-cyan-50"
                                    >
                                        <Download className="h-4 w-4" />
                                        Tải file mẫu
                                    </button>
                                    <button type="button" onClick={closeModal} className="rounded-xl border-2 border-slate-200 px-5 py-2.5 font-bold text-slate-600 transition hover:bg-slate-50">
                                        Hủy
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-6 py-2.5 font-bold text-white shadow-sm transition hover:bg-cyan-700"
                                    >
                                        <Upload className="h-4 w-4" />
                                        Chọn file import
                                    </button>
                                </div>
                            </div>
                        ) : modalMode === 'export' ? (
                            <div className="px-6 py-5">
                                <div className="rounded-2xl border-2 border-cyan-200 bg-cyan-50 p-5">
                                    <p className="font-black text-cyan-900">Xác nhận xuất Excel</p>
                                    <p className="mt-2 text-sm font-medium leading-6 text-cyan-800">
                                        Hệ thống sẽ tải xuống file Excel chứa danh sách danh mục đang được hiển thị trên bảng.
                                    </p>
                                </div>

                                <div className="mt-8 flex justify-end gap-3">
                                    <button type="button" onClick={closeModal} className="rounded-xl border-2 border-slate-200 px-5 py-2.5 font-bold text-slate-600 transition hover:bg-slate-50">
                                        Hủy
                                    </button>
                                    <button type="button" onClick={handleExport} className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-6 py-2.5 font-bold text-white shadow-sm transition hover:bg-cyan-700">
                                        <Download className="h-4 w-4" />
                                        Xuất file
                                    </button>
                                </div>
                            </div>
                        ) : modalMode === 'import-result' ? (
                            <div className="px-6 py-5">
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-5">
                                        <p className="text-sm font-bold uppercase tracking-wide text-emerald-600">Thành công</p>
                                        <p className="mt-2 text-3xl font-black text-emerald-700">{importSummary?.successCount || 0}</p>
                                        <p className="mt-1 text-sm font-medium text-emerald-700">dòng danh mục</p>
                                    </div>
                                    <div className="rounded-2xl border-2 border-red-200 bg-red-50 p-5">
                                        <p className="text-sm font-bold uppercase tracking-wide text-red-500">Thất bại</p>
                                        <p className="mt-2 text-3xl font-black text-red-600">{importSummary?.failedCount || 0}</p>
                                        <p className="mt-1 text-sm font-medium text-red-600">lỗi cần kiểm tra</p>
                                    </div>
                                </div>

                                <div className="mt-5 max-h-64 overflow-y-auto rounded-2xl border-2 border-slate-200 bg-slate-50 p-4">
                                    <p className="mb-3 font-black text-slate-800">Chi tiết</p>
                                    {importSummary?.details.length ? (
                                        <ul className="space-y-2 text-sm font-medium text-slate-600">
                                            {importSummary.details.map((detail, index) => (
                                                <li key={`${detail}-${index}`}>• {detail}</li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="text-sm font-semibold text-emerald-700">Không có lỗi. File import hợp lệ.</p>
                                    )}
                                </div>

                                <div className="mt-8 flex justify-end gap-3">
                                    <button type="button" onClick={closeModal} className="rounded-xl bg-cyan-600 px-6 py-2.5 font-bold text-white shadow-sm transition hover:bg-cyan-700">
                                        Đóng
                                    </button>
                                </div>
                            </div>
                        ) : modalMode === 'delete' ? (
                            <div className="px-6 py-5">
                                <p className="text-base text-slate-700">
                                    Bạn có chắc muốn xóa danh mục{' '}
                                    <span className="font-black text-slate-950">{selectedCategory?.name}</span> không?
                                </p>
                                <p className="mt-2 text-sm font-medium text-red-500">Sản phẩm đang dùng danh mục này sẽ không tự động đổi danh mục.</p>
                                <div className="mt-8 flex justify-end gap-3">
                                    <button type="button" onClick={closeModal} className="rounded-xl border-2 border-slate-200 px-5 py-2.5 font-bold text-slate-600 transition hover:bg-slate-50">Hủy</button>
                                    <button type="button" onClick={handleDelete} className="rounded-xl bg-red-600 px-5 py-2.5 font-bold text-white shadow-sm transition hover:bg-red-700">Xóa</button>
                                </div>
                            </div>
                        ) : modalMode === 'mass-delete' ? (
                            <div className="px-6 py-5">
                                <p className="text-base text-slate-700">
                                    Bạn có chắc muốn xóa <b>{selectedIds.length}</b> danh mục đã chọn không?
                                </p>
                                <p className="mt-2 text-sm font-medium text-red-500">Sản phẩm đang dùng các danh mục này sẽ bị ảnh hưởng hoặc hiển thị lỗi.</p>
                                <div className="mt-8 flex justify-end gap-3">
                                    <button type="button" onClick={closeModal} className="rounded-xl border-2 border-slate-200 px-5 py-2.5 font-bold text-slate-600 transition hover:bg-slate-50">Hủy</button>
                                    <button type="button" onClick={() => {
                                        setCategories((current) => current.filter((category) => !selectedIds.includes(category.id!)));
                                        setSelectedIds([]);
                                        setSuccess(`Đã xóa ${selectedIds.length} danh mục.`);
                                        closeModal();
                                    }} className="rounded-xl bg-red-600 px-5 py-2.5 font-bold text-white shadow-sm transition hover:bg-red-700">Xóa tất cả</button>
                                </div>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="px-6 py-5">
                                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                                    <div>
                                        <label className="mb-2 block text-sm font-bold text-slate-700">Mã danh mục <span className="text-red-500">*</span></label>
                                        <input
                                            value={form.code}
                                            onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))}
                                            readOnly={modalMode === 'view'}
                                            className="h-11 w-full rounded-xl border-2 border-slate-200 px-4 uppercase outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 read-only:bg-slate-50 read-only:focus:border-slate-200 read-only:focus:ring-0"
                                            placeholder="VD: QUAN_AO, ĐIEN_THOAI"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-2 block text-sm font-bold text-slate-700">Tên danh mục <span className="text-red-500">*</span></label>
                                        <input
                                            value={form.name}
                                            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                                            readOnly={modalMode === 'view'}
                                            className="h-11 w-full rounded-xl border-2 border-slate-200 px-4 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 read-only:bg-slate-50 read-only:focus:border-slate-200 read-only:focus:ring-0"
                                            placeholder="VD: Quần áo, Điện thoại"
                                            required
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="mb-2 block text-sm font-bold text-slate-700">Ghi chú</label>
                                        <textarea
                                            value={form.description}
                                            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                                            readOnly={modalMode === 'view'}
                                            rows={2}
                                            className="w-full resize-none rounded-xl border-2 border-slate-200 px-4 py-3 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 read-only:bg-slate-50 read-only:focus:border-slate-200 read-only:focus:ring-0"
                                            placeholder="Thông tin thêm (nếu có)"
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="mb-2 block text-sm font-bold text-slate-700">Trạng thái</label>
                                        <select
                                            value={form.status}
                                            onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as CatalogCategoryStatus }))}
                                            disabled={modalMode === 'view'}
                                            className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 disabled:bg-slate-50"
                                        >
                                            <option value="active">Đang dùng</option>
                                            <option value="inactive">Ngừng dùng</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="mt-8 flex justify-end gap-3">
                                    <button type="button" onClick={closeModal} className="rounded-xl border-2 border-slate-200 px-5 py-2.5 font-bold text-slate-600 transition hover:bg-slate-50">
                                        {modalMode === 'view' ? 'Đóng' : 'Hủy'}
                                    </button>
                                    {modalMode !== 'view' && (
                                        <button type="submit" className="rounded-xl bg-cyan-600 px-6 py-2.5 font-bold text-white shadow-sm transition hover:bg-cyan-700">
                                            {modalMode === 'create' ? 'Thêm danh mục' : 'Lưu thay đổi'}
                                        </button>
                                    )}
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
