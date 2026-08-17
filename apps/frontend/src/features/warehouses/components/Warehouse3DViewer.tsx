import React, { useEffect, useRef, useState } from 'react';
import { Move3d, RotateCw, Layers, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import type { SubWarehouse } from '../../../shared/utils/warehouseAssignments';

interface Warehouse3DViewerProps {
  subWarehouse: SubWarehouse;
  allSubWarehouses?: SubWarehouse[];
  selectedRackIds?: string[];
}

export default function Warehouse3DViewer({ subWarehouse, selectedRackIds = [] }: Warehouse3DViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [rotationX, setRotationX] = useState(30); // degrees
  const [rotationY, setRotationY] = useState(-40); // degrees
  const [zoom, setZoom] = useState(1.4);
  const [wireframe, setWireframe] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [autoRotate, setAutoRotate] = useState(false);

  // Sub-warehouse dimensions in real-time
  const W = Math.max(subWarehouse?.width ?? 0, 1); // meters (Width)
  const L = Math.max(subWarehouse?.length ?? 0, 1); // meters (Length)
  const H = Math.max(subWarehouse?.height ?? 0, 1);  // meters (Height)
  const racksCount = Math.max(subWarehouse?.racksCount ?? 0, 0);
  const shelvesPerRack = Math.max(subWarehouse?.shelvesPerRack ?? 0, 0);

  // Auto rotation loop
  useEffect(() => {
    if (!autoRotate) return;
    const interval = setInterval(() => {
      setRotationY((prev) => (prev + 0.8) % 360);
    }, 30);
    return () => clearInterval(interval);
  }, [autoRotate]);

  // Mouse drag to rotate 3D view
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    setRotationY((prev) => prev + dx * 0.5);
    setRotationX((prev) => Math.max(5, Math.min(85, prev - dy * 0.5)));
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Render 3D Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    // Center of canvas
    const cx = width / 2;
    const cy = height / 2 + 25;

    // Dynamic scale factor based on zoom and real 3D bounding box
    const maxDim = Math.max(W, L, H, 5);
    const baseScale = (Math.min(width, height) / (maxDim * 2.2)) * zoom;

    const radX = (rotationX * Math.PI) / 180;
    const radY = (rotationY * Math.PI) / 180;

    // 3D to 2D projection function
    const project = (x: number, y: number, z: number) => {
      const wx = x - W / 2;
      const wy = y;
      const wz = z - L / 2;

      // Y-axis rotation
      const rx1 = wx * Math.cos(radY) + wz * Math.sin(radY);
      const rz1 = -wx * Math.sin(radY) + wz * Math.cos(radY);

      // X-axis rotation
      const ry2 = wy * Math.cos(radX) - rz1 * Math.sin(radX);
      const rz2 = wy * Math.sin(radX) + rz1 * Math.cos(radX);

      return {
        x: cx + rx1 * baseScale,
        y: cy - ry2 * baseScale,
        z: rz2,
      };
    };

    // 1. Draw Floor Slab & Grid
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    const step = Math.max(1, Math.floor(Math.min(W, L) / 10));

    for (let x = 0; x <= W; x += step) {
      const p1 = project(x, 0, 0);
      const p2 = project(x, 0, L);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
    for (let z = 0; z <= L; z += step) {
      const p1 = project(0, 0, z);
      const p2 = project(W, 0, z);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }

    // Floor Slab Outer Line (Cyan Glassmorphism accent)
    const f0 = project(0, 0, 0);
    const f1 = project(W, 0, 0);
    const f2 = project(W, 0, L);
    const f3 = project(0, 0, L);

    ctx.fillStyle = 'rgba(6, 182, 212, 0.08)';
    ctx.beginPath();
    ctx.moveTo(f0.x, f0.y);
    ctx.lineTo(f1.x, f1.y);
    ctx.lineTo(f2.x, f2.y);
    ctx.lineTo(f3.x, f3.y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#0891b2';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // 2. Draw Continuous Longitudinal Rack Rows
    if (racksCount > 0) {
      const rowSpacing = W / (racksCount + 1);
      const rackWidthX = Math.min(1.2, rowSpacing * 0.7); // Rộng 1.2m
      const rackLengthZ = Math.max(L - 2, 0.5); // Dài kéo gần suốt kho
      const zStart = 1.0;
      const zEnd = zStart + rackLengthZ;

      // Vách Ngang Input (Total horizontal partition beam levels, e.g. 5 = 1 bottom + 3 middle + 1 top roof)
      const vachNgangInput = subWarehouse?.shelvesPerRack && subWarehouse.shelvesPerRack > 0 ? subWarehouse.shelvesPerRack : 5;
      const shelvesCount = Math.max(1, vachNgangInput - 1); // 4 storage shelf levels

      // Calculate realistic rack height & shelf level Y positions starting from near ground (0.3m)
      const baseGroundY = 0.3; // Level 1 is 0.3m above ground slab
      const shelfGap = shelvesCount > 1 ? Math.min(1.8, (H * 0.8 - baseGroundY) / shelvesCount) : 1.5;
      const rackTopY = baseGroundY + shelvesCount * shelfGap;

      // Vách Dọc Input (Total vertical partition posts, e.g. 2 = 1 start/head + 1 end/tail)
      const vachDocInput = subWarehouse?.binsPerShelf && subWarehouse.binsPerShelf > 0 ? subWarehouse.binsPerShelf : 2;
      const bayCountZ = Math.max(1, vachDocInput - 1); // 1 bay between head and tail
      const bayStepZ = rackLengthZ / bayCountZ;

      const palletColors = ['#0891b2', '#059669', '#d97706', '#dc2626', '#4f46e5', '#2563eb'];

      for (let r = 1; r <= racksCount; r++) {
        const rackCode = `R${String(r).padStart(2, '0')}`;
        const isSelected = selectedRackIds.length === 0 || selectedRackIds.includes(rackCode) || selectedRackIds.includes(`rack-${r}`);

        const xCenter = r * rowSpacing;
        const xLeft = xCenter - rackWidthX / 2;
        const xRight = xCenter + rackWidthX / 2;

        // Draw Vertical Frame Posts (Highlight selected racks with Cyan glow)
        ctx.strokeStyle = isSelected ? '#0e7490' : '#94a3b8';
        ctx.lineWidth = isSelected ? 2.5 : 1.5;

        for (let b = 0; b <= bayCountZ; b++) {
          const zb = zStart + b * bayStepZ;
          const postL_bot = project(xLeft, 0, zb);
          const postL_top = project(xLeft, rackTopY, zb);
          const postR_bot = project(xRight, 0, zb);
          const postR_top = project(xRight, rackTopY, zb);

          ctx.beginPath();
          ctx.moveTo(postL_bot.x, postL_bot.y);
          ctx.lineTo(postL_top.x, postL_top.y);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(postR_bot.x, postR_bot.y);
          ctx.lineTo(postR_top.x, postR_top.y);
          ctx.stroke();
        }

        // Draw Horizontal Beams & Cargo Bins (Total vachNgangInput levels: bottom floor s=0 to top roof s=shelvesCount)
        for (let s = 0; s <= shelvesCount; s++) {
          const sy = s === shelvesCount ? rackTopY : baseGroundY + s * shelfGap;

          const bLeftStart = project(xLeft, sy, zStart);
          const bLeftEnd = project(xLeft, sy, zEnd);
          const bRightStart = project(xRight, sy, zStart);
          const bRightEnd = project(xRight, sy, zEnd);

          ctx.strokeStyle = isSelected ? '#06b6d4' : '#cbd5e1'; // Cyan beam if selected
          ctx.lineWidth = isSelected ? 2.5 : 1.5;

          ctx.beginPath();
          ctx.moveTo(bLeftStart.x, bLeftStart.y);
          ctx.lineTo(bLeftEnd.x, bLeftEnd.y);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(bRightStart.x, bRightStart.y);
          ctx.lineTo(bRightEnd.x, bRightEnd.y);
          ctx.stroke();

          // Cross ties at every level including top roof level
          ctx.strokeStyle = isSelected ? '#67e8f9' : '#e2e8f0';
          ctx.lineWidth = 1.2;
          for (let b = 0; b <= bayCountZ; b++) {
            const zb = zStart + b * bayStepZ;
            const pL = project(xLeft, sy, zb);
            const pR = project(xRight, sy, zb);
            ctx.beginPath();
            ctx.moveTo(pL.x, pL.y);
            ctx.lineTo(pR.x, pR.y);
            ctx.stroke();
          }

          // Draw 3D Pallet Cargo Boxes for storage shelf levels s < shelvesCount
          if (!wireframe && s < shelvesCount) {
            const boxH = Math.min(1.2, shelfGap * 0.75);

            for (let b = 0; b < bayCountZ; b++) {
              const zb1 = zStart + b * bayStepZ + 0.2;
              const zb2 = zStart + (b + 1) * bayStepZ - 0.2;

              const bColor = isSelected ? palletColors[(r + s + b) % palletColors.length] : '#cbd5e1';

              const boxP = [
                project(xLeft + 0.1, sy, zb1),
                project(xRight - 0.1, sy, zb1),
                project(xRight - 0.1, sy, zb2),
                project(xLeft + 0.1, sy, zb2),
                project(xLeft + 0.1, sy + boxH, zb1),
                project(xRight - 0.1, sy + boxH, zb1),
                project(xRight - 0.1, sy + boxH, zb2),
                project(xLeft + 0.1, sy + boxH, zb2),
              ];

              ctx.fillStyle = bColor;
              ctx.globalAlpha = isSelected ? 0.9 : 0.3;

              // Top Face
              ctx.beginPath();
              ctx.moveTo(boxP[4].x, boxP[4].y);
              ctx.lineTo(boxP[5].x, boxP[5].y);
              ctx.lineTo(boxP[6].x, boxP[6].y);
              ctx.lineTo(boxP[7].x, boxP[7].y);
              ctx.closePath();
              ctx.fill();

              // Front/Side Face
              ctx.beginPath();
              ctx.moveTo(boxP[0].x, boxP[0].y);
              ctx.lineTo(boxP[1].x, boxP[1].y);
              ctx.lineTo(boxP[5].x, boxP[5].y);
              ctx.lineTo(boxP[4].x, boxP[4].y);
              ctx.closePath();
              ctx.fill();

              ctx.globalAlpha = 1.0;
            }
          }
        }

        // Draw Rack Code Label Above Rack
        const topLabelP = project(xCenter, rackTopY + 0.4, zStart + rackLengthZ / 2);
        ctx.fillStyle = isSelected ? '#0891b2' : '#64748b';
        ctx.font = 'bold 12px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(rackCode, topLabelP.x, topLabelP.y);
      }
    }

    // 3. Render Real-time Dimension Labels
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 12px Inter, sans-serif';

    const dLength = project(-1.2, 0, L / 2);
    ctx.fillText(`Dài Phân Khu: ${L}m`, dLength.x, dLength.y);

    const dWidth = project(W / 2, 0, -1.2);
    ctx.fillText(`Rộng Phân Khu: ${W}m`, dWidth.x, dWidth.y);

    const dHeight = project(W + 1.2, H / 2, 0);
    ctx.fillText(`Cao Phân Khu: ${H}m`, dHeight.x, dHeight.y);
  }, [rotationX, rotationY, zoom, wireframe, W, L, H, racksCount, shelvesPerRack, subWarehouse, selectedRackIds]);

  return (
    <div className="rounded-2xl border border-cyan-200 dark:border-cyan-800 bg-white dark:bg-slate-900 p-5 shadow-lg space-y-4 font-sans">
      {/* 3D Header Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-cyan-100 dark:border-cyan-900/50 pb-3">
        <div>
          <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Move3d className="h-4.5 w-4.5 text-cyan-600" />
            Mô Phỏng 3D Dãy Kệ Dọc: <span className="text-cyan-600">{subWarehouse?.code || 'ZONE'}</span> - {subWarehouse?.name}
          </h3>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            Kích thước: <strong className="text-slate-900 dark:text-white">{L}m Dài</strong> × <strong className="text-slate-900 dark:text-white">{W}m Rộng</strong> × <strong className="text-slate-900 dark:text-white">{H}m Cao</strong> | Sức chứa: <strong className="text-cyan-600">{racksCount} Dãy Dọc</strong> × <strong className="text-cyan-600">{shelvesPerRack} Tầng Hàng</strong>
          </p>
        </div>

        {/* Control buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setAutoRotate(!autoRotate)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-extrabold transition cursor-pointer ${
              autoRotate ? 'border-cyan-500 bg-cyan-600 text-white shadow-md shadow-cyan-200' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-cyan-50'
            }`}
          >
            <RotateCw className={`h-3.5 w-3.5 ${autoRotate ? 'animate-spin' : ''}`} />
            Xoay 360°
          </button>

          <button
            type="button"
            onClick={() => setWireframe(!wireframe)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-extrabold transition cursor-pointer ${
              wireframe ? 'border-indigo-500 bg-indigo-600 text-white' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-indigo-50'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            {wireframe ? 'Khung Dây' : 'Khối 3D'}
          </button>

          {/* Zoom controls (Support up to 500% zoom!) */}
          <div className="inline-flex items-center gap-1 rounded-xl border border-cyan-200 dark:border-cyan-800 bg-cyan-50/50 dark:bg-cyan-950/40 px-2.5 py-1">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.6, z - 0.3))}
              className="p-1 font-black text-slate-700 dark:text-slate-200 hover:text-cyan-600 cursor-pointer"
              title="Thu nhỏ"
            >
              <ZoomOut className="h-4 w-4" />
            </button>

            <span className="text-xs font-black text-cyan-700 dark:text-cyan-400 px-1">{Math.round(zoom * 100)}%</span>

            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(5.0, z + 0.3))}
              className="p-1 font-black text-slate-700 dark:text-slate-200 hover:text-cyan-600 cursor-pointer"
              title="Phóng to đến 500%"
            >
              <ZoomIn className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => setZoom(1.4)}
              className="p-1 text-slate-500 hover:text-cyan-600 cursor-pointer border-l border-cyan-200 ml-1 pl-1.5"
              title="Đặt lại phóng to"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 3D Canvas Box (Increased canvas height h-[520px]) */}
      <div
        className="relative h-[520px] w-full overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-900/5 cursor-grab active:cursor-grabbing flex items-center justify-center shadow-inner"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <canvas ref={canvasRef} width={950} height={520} className="w-full h-full object-contain" />
      </div>
    </div>
  );
}
