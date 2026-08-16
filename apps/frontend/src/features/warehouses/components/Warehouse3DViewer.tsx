import React, { useEffect, useRef, useState } from 'react';
import { Move3d, RotateCw, Layers, ZoomIn, ZoomOut } from 'lucide-react';
import type { SubWarehouse } from '../../../shared/utils/warehouseAssignments';

interface Warehouse3DViewerProps {
  subWarehouse: SubWarehouse;
  allSubWarehouses?: SubWarehouse[];
}

export default function Warehouse3DViewer({ subWarehouse }: Warehouse3DViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [rotationX, setRotationX] = useState(30); // degrees
  const [rotationY, setRotationY] = useState(-40); // degrees
  const [zoom, setZoom] = useState(1.2);
  const [wireframe, setWireframe] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [autoRotate, setAutoRotate] = useState(false);

  // Sub-warehouse dimensions in real-time (Support 0 values)
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

    // Floor Slab Outer Line
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

    // 2. Draw Continuous Longitudinal Rack Rows (Only if racksCount > 0)
    if (racksCount > 0) {
      const rowSpacing = W / (racksCount + 1);
      const rackWidthX = Math.min(1.2, rowSpacing * 0.7); // Rộng 1.2m
      const rackLengthZ = Math.max(L - 2, 0.5); // Dài kéo gần suốt kho
      const zStart = 1.0;
      const zEnd = zStart + rackLengthZ;
      const shelfH = shelvesPerRack > 0 ? H / (shelvesPerRack + 1) : H;

      // Number of structural bay posts along length Z
      const bayCountZ = Math.max(1, Math.floor(rackLengthZ / 2.5));
      const bayStepZ = rackLengthZ / bayCountZ;

      const palletColors = ['#0284c7', '#059669', '#d97706', '#dc2626', '#4f46e5', '#0891b2'];

      for (let r = 1; r <= racksCount; r++) {
        const xCenter = r * rowSpacing;
        const xLeft = xCenter - rackWidthX / 2;
        const xRight = xCenter + rackWidthX / 2;

        // Draw Vertical Frame Posts (Khung sắt đứng)
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2;

        for (let b = 0; b <= bayCountZ; b++) {
          const zb = zStart + b * bayStepZ;
          const postL_bot = project(xLeft, 0, zb);
          const postL_top = project(xLeft, H * 0.85, zb);
          const postR_bot = project(xRight, 0, zb);
          const postR_top = project(xRight, H * 0.85, zb);

          // Left Vertical Column
          ctx.beginPath();
          ctx.moveTo(postL_bot.x, postL_bot.y);
          ctx.lineTo(postL_top.x, postL_top.y);
          ctx.stroke();

          // Right Vertical Column
          ctx.beginPath();
          ctx.moveTo(postR_bot.x, postR_bot.y);
          ctx.lineTo(postR_top.x, postR_top.y);
          ctx.stroke();
        }

        // Draw Horizontal Beams & Cargo Bins (Only if shelvesPerRack > 0)
        for (let s = 1; s <= shelvesPerRack; s++) {
          const sy = s * shelfH;

          // Long Beam Lines (Front & Back edge along Z-axis)
          const bLeftStart = project(xLeft, sy, zStart);
          const bLeftEnd = project(xLeft, sy, zEnd);
          const bRightStart = project(xRight, sy, zStart);
          const bRightEnd = project(xRight, sy, zEnd);

          ctx.strokeStyle = '#ea580c'; // Industrial Orange Beam
          ctx.lineWidth = 2.5;

          // Left Beam
          ctx.beginPath();
          ctx.moveTo(bLeftStart.x, bLeftStart.y);
          ctx.lineTo(bLeftEnd.x, bLeftEnd.y);
          ctx.stroke();

          // Right Beam
          ctx.beginPath();
          ctx.moveTo(bRightStart.x, bRightStart.y);
          ctx.lineTo(bRightEnd.x, bRightEnd.y);
          ctx.stroke();

          // Cross ties
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1.5;
          for (let b = 0; b <= bayCountZ; b++) {
            const zb = zStart + b * bayStepZ;
            const pL = project(xLeft, sy, zb);
            const pR = project(xRight, sy, zb);
            ctx.beginPath();
            ctx.moveTo(pL.x, pL.y);
            ctx.lineTo(pR.x, pR.y);
            ctx.stroke();
          }

          // Draw 3D Pallet Containers / Cargo Boxes
          if (!wireframe) {
            for (let b = 0; b < bayCountZ; b++) {
              const zb1 = zStart + b * bayStepZ + 0.2;
              const zb2 = zStart + (b + 1) * bayStepZ - 0.2;

              const bColor = palletColors[(r + s + b) % palletColors.length];

              const boxP = [
                project(xLeft + 0.1, sy, zb1),
                project(xRight - 0.1, sy, zb1),
                project(xRight - 0.1, sy, zb2),
                project(xLeft + 0.1, sy, zb2),
                project(xLeft + 0.1, sy + shelfH * 0.65, zb1),
                project(xRight - 0.1, sy + shelfH * 0.65, zb1),
                project(xRight - 0.1, sy + shelfH * 0.65, zb2),
                project(xLeft + 0.1, sy + shelfH * 0.65, zb2),
              ];

              ctx.fillStyle = bColor;
              ctx.globalAlpha = 0.85;

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
  }, [rotationX, rotationY, zoom, wireframe, W, L, H, racksCount, shelvesPerRack, subWarehouse]);

  return (
    <div className="rounded-2xl border-2 border-cyan-500 bg-white dark:bg-slate-900 p-5 shadow-lg space-y-4 font-sans">
      {/* 3D Header Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <div>
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Move3d className="h-4 w-4 text-cyan-600" />
            Mô Phỏng 3D Dãy Kệ Dọc: <span className="font-black text-cyan-600">{subWarehouse?.code || 'ZONE'}</span> - {subWarehouse?.name}
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
            className={`inline-flex items-center gap-1.5 rounded-xl border-2 px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
              autoRotate ? 'border-cyan-500 bg-cyan-600 text-white' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200'
            }`}
          >
            <RotateCw className={`h-3.5 w-3.5 ${autoRotate ? 'animate-spin' : ''}`} />
            Xoay 360°
          </button>

          <button
            type="button"
            onClick={() => setWireframe(!wireframe)}
            className={`inline-flex items-center gap-1.5 rounded-xl border-2 px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
              wireframe ? 'border-indigo-500 bg-indigo-600 text-white' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            {wireframe ? 'Khung Dây' : 'Khối 3D'}
          </button>

          {/* Zoom controls */}
          <div className="inline-flex items-center gap-1 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.6, z - 0.2))}
              className="p-1 font-black text-slate-700 dark:text-slate-200 hover:text-cyan-600 cursor-pointer"
              title="Thu nhỏ"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-100 px-1">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(3.0, z + 0.2))}
              className="p-1 font-black text-slate-700 dark:text-slate-200 hover:text-cyan-600 cursor-pointer"
              title="Phóng to"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 3D Canvas Box */}
      <div
        className="relative h-[420px] w-full overflow-hidden rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 cursor-grab active:cursor-grabbing flex items-center justify-center shadow-inner"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <canvas ref={canvasRef} width={850} height={420} className="w-full h-full object-contain" />
      </div>
    </div>
  );
}
