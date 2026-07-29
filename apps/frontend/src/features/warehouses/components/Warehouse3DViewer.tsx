import React, { useEffect, useRef, useState } from 'react';
import { Box, Eye, Maximize2, Move3d, RotateCw, Layers, ShieldCheck, DoorClosed, Plus, ZoomIn, ZoomOut } from 'lucide-react';
import type { SubWarehouse } from '../../../shared/utils/warehouseAssignments';

interface Warehouse3DViewerProps {
  subWarehouse: SubWarehouse;
  allSubWarehouses?: SubWarehouse[];
}

export default function Warehouse3DViewer({ subWarehouse, allSubWarehouses = [] }: Warehouse3DViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [rotationX, setRotationX] = useState(30); // degrees
  const [rotationY, setRotationY] = useState(-40); // degrees
  const [zoom, setZoom] = useState(1.2);
  const [wireframe, setWireframe] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [autoRotate, setAutoRotate] = useState(false);

  // Sub-warehouse dimensions
  const W = Math.max(subWarehouse.width || 15, 5); // meters
  const L = Math.max(subWarehouse.length || 20, 5); // meters
  const H = Math.max(subWarehouse.height || 8, 3); // meters
  const racksCount = subWarehouse.racksCount || 6;
  const shelvesPerRack = subWarehouse.shelvesPerRack || 4;

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

  // Render 3D Sub-warehouse Canvas
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
    const cy = height / 2 + 20;

    // Scale factor based on zoom and canvas size
    const baseScale = (Math.min(width, height) / (Math.max(W, L, H) * 2.2)) * zoom;

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

    // Draw Floor Grid
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    const step = 2;
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

    // Floor Slab Fill
    const f0 = project(0, 0, 0);
    const f1 = project(W, 0, 0);
    const f2 = project(W, 0, L);
    const f3 = project(0, 0, L);

    ctx.fillStyle = 'rgba(6, 182, 212, 0.12)';
    ctx.beginPath();
    ctx.moveTo(f0.x, f0.y);
    ctx.lineTo(f1.x, f1.y);
    ctx.lineTo(f2.x, f2.y);
    ctx.lineTo(f3.x, f3.y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#0891b2';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw 3D Sub-warehouse Wall Pillars
    const corners = [
      project(0, 0, 0),
      project(W, 0, 0),
      project(W, 0, L),
      project(0, 0, L),
      project(0, H, 0),
      project(W, H, 0),
      project(W, H, L),
      project(0, H, L),
    ];

    if (!wireframe) {
      // Back wall
      ctx.fillStyle = 'rgba(241, 245, 249, 0.7)';
      ctx.beginPath();
      ctx.moveTo(corners[3].x, corners[3].y);
      ctx.lineTo(corners[2].x, corners[2].y);
      ctx.lineTo(corners[6].x, corners[6].y);
      ctx.lineTo(corners[7].x, corners[7].y);
      ctx.closePath();
      ctx.fill();

      // Left wall
      ctx.fillStyle = 'rgba(226, 232, 240, 0.6)';
      ctx.beginPath();
      ctx.moveTo(corners[0].x, corners[0].y);
      ctx.lineTo(corners[3].x, corners[3].y);
      ctx.lineTo(corners[7].x, corners[7].y);
      ctx.lineTo(corners[4].x, corners[4].y);
      ctx.closePath();
      ctx.fill();
    }

    // Draw Racks (Kệ hàng 3D) inside the Sub-warehouse
    const rowCount = Math.min(racksCount, 12);
    const rowSpacing = L / (rowCount + 1);
    const rackDepth = 1.2;
    const shelfHeight = H / (shelvesPerRack + 1);

    const palletColors = ['#0284c7', '#059669', '#d97706', '#dc2626', '#4f46e5', '#0891b2'];

    for (let r = 1; r <= rowCount; r++) {
      const zPos = r * rowSpacing;

      // Draw Rack Beams (Left & Right Sections)
      for (let side = 0; side < 2; side++) {
        const xStart = side === 0 ? 1.5 : W * 0.5 + 1;
        const rackWidth = W * 0.4 - 1.5;

        // Draw 4 vertical posts for each rack
        const posts = [
          project(xStart, 0, zPos),
          project(xStart + rackWidth, 0, zPos),
          project(xStart + rackWidth, 0, zPos + rackDepth),
          project(xStart, 0, zPos + rackDepth),
          project(xStart, H * 0.85, zPos),
          project(xStart + rackWidth, H * 0.85, zPos),
          project(xStart + rackWidth, H * 0.85, zPos + rackDepth),
          project(xStart, H * 0.85, zPos + rackDepth),
        ];

        // Draw Rack Frame Posts
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1.5;

        // 4 Vertical Pillars
        [0, 1, 2, 3].forEach((i) => {
          ctx.beginPath();
          ctx.moveTo(posts[i].x, posts[i].y);
          ctx.lineTo(posts[i + 4].x, posts[i + 4].y);
          ctx.stroke();
        });

        // Horizontal Shelves
        for (let s = 1; s <= shelvesPerRack; s++) {
          const sy = s * shelfHeight;
          const sLevel = [
            project(xStart, sy, zPos),
            project(xStart + rackWidth, sy, zPos),
            project(xStart + rackWidth, sy, zPos + rackDepth),
            project(xStart, sy, zPos + rackDepth),
          ];

          // Draw Shelf Beam Line
          ctx.strokeStyle = '#0284c7';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(sLevel[0].x, sLevel[0].y);
          ctx.lineTo(sLevel[1].x, sLevel[1].y);
          ctx.lineTo(sLevel[2].x, sLevel[2].y);
          ctx.lineTo(sLevel[3].x, sLevel[3].y);
          ctx.closePath();
          ctx.stroke();

          // Draw 3D Pallet Cargo Boxes on shelves
          if (!wireframe) {
            const boxes = Math.min(3, Math.floor(rackWidth / 1.5));
            const boxW = rackWidth / boxes - 0.2;

            for (let b = 0; b < boxes; b++) {
              const bx = xStart + 0.1 + b * (boxW + 0.2);
              const bColor = palletColors[(r + s + b) % palletColors.length];

              const boxP = [
                project(bx, sy, zPos),
                project(bx + boxW, sy, zPos),
                project(bx + boxW, sy, zPos + rackDepth * 0.8),
                project(bx, sy, zPos + rackDepth * 0.8),
                project(bx, sy + shelfHeight * 0.7, zPos),
                project(bx + boxW, sy + shelfHeight * 0.7, zPos),
                project(bx + boxW, sy + shelfHeight * 0.7, zPos + rackDepth * 0.8),
                project(bx, sy + shelfHeight * 0.7, zPos + rackDepth * 0.8),
              ];

              ctx.fillStyle = bColor;
              ctx.globalAlpha = 0.85;

              // Top Box Face
              ctx.beginPath();
              ctx.moveTo(boxP[4].x, boxP[4].y);
              ctx.lineTo(boxP[5].x, boxP[5].y);
              ctx.lineTo(boxP[6].x, boxP[6].y);
              ctx.lineTo(boxP[7].x, boxP[7].y);
              ctx.closePath();
              ctx.fill();

              // Front Box Face
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

    // Outer Room Wireframe Edges
    ctx.strokeStyle = '#0891b2';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);

    const edges = [
      [0, 4],
      [1, 5],
      [2, 6],
      [3, 7],
      [4, 5],
      [5, 6],
      [6, 7],
      [7, 4],
    ];
    edges.forEach(([a, b]) => {
      ctx.beginPath();
      ctx.moveTo(corners[a].x, corners[a].y);
      ctx.lineTo(corners[b].x, corners[b].y);
      ctx.stroke();
    });
    ctx.setLineDash([]);

    // Entrance door indicator for the Sub-warehouse
    const d1 = project(W * 0.4, 0, L);
    const d2 = project(W * 0.6, 0, L);
    const d3 = project(W * 0.6, H * 0.5, L);
    const d4 = project(W * 0.4, H * 0.5, L);

    ctx.fillStyle = 'rgba(16, 185, 129, 0.2)';
    ctx.beginPath();
    ctx.moveTo(d1.x, d1.y);
    ctx.lineTo(d2.x, d2.y);
    ctx.lineTo(d3.x, d3.y);
    ctx.lineTo(d4.x, d4.y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;
    ctx.stroke();

    const dCenter = project(W * 0.5, H * 0.25, L);
    ctx.fillStyle = '#047857';
    ctx.font = 'bold 11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CỬA PHÂN KHU', dCenter.x, dCenter.y);

    // Dimension labels
    const dLength = project(-1.5, 0, L / 2);
    ctx.fillStyle = '#334155';
    ctx.font = 'bold 11px Inter, sans-serif';
    ctx.fillText(`Chiều dài: ${L}m`, dLength.x, dLength.y);

    const dWidth = project(W / 2, 0, -1.5);
    ctx.fillText(`Chiều rộng: ${W}m`, dWidth.x, dWidth.y);

    const dHeight = project(W + 1.5, H / 2, 0);
    ctx.fillText(`Chiều cao: ${H}m`, dHeight.x, dHeight.y);
  }, [rotationX, rotationY, zoom, wireframe, W, L, H, racksCount, shelvesPerRack, subWarehouse]);

  return (
    <div className="rounded-2xl border-2 border-cyan-500 bg-white p-5 shadow-lg space-y-4 font-sans">
      {/* 3D Header Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Move3d className="h-4 w-4 text-cyan-600" />
            Mô Phỏng 3D Phân Khu: <span className="font-bold text-cyan-700">{subWarehouse.code}</span> - {subWarehouse.name}
            <span
              className={`ml-2 inline-flex rounded-lg px-2 py-0.5 text-[11px] font-bold ${
                subWarehouse.status === 'inactive'
                  ? 'border border-rose-200 bg-rose-50 text-rose-700'
                  : 'border border-emerald-200 bg-emerald-50 text-emerald-700'
              }`}
            >
              {subWarehouse.status === 'inactive' ? 'Không hoạt động' : 'Đang hoạt động'}
            </span>
          </h3>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            Kích thước: <strong className="text-slate-900">{L}m</strong> Dài × <strong className="text-slate-900">{W}m</strong> Rộng × <strong className="text-slate-900">{H}m</strong> Cao | Sức chứa: <strong className="text-cyan-700">{racksCount} Kệ</strong> × <strong className="text-cyan-700">{shelvesPerRack} Tầng</strong> | Kệ tường: <strong className="text-indigo-700">{subWarehouse.wallRacksCount || 2} Kệ</strong> | Hàng kệ: <strong className="text-indigo-700">{subWarehouse.rackRowsCount || 2} Hàng</strong>
          </p>
        </div>

        {/* Control buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setAutoRotate(!autoRotate)}
            className={`inline-flex items-center gap-1.5 rounded-xl border-2 px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
              autoRotate ? 'border-cyan-500 bg-cyan-600 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <RotateCw className={`h-3.5 w-3.5 ${autoRotate ? 'animate-spin' : ''}`} />
            Xoay 360°
          </button>

          <button
            type="button"
            onClick={() => setWireframe(!wireframe)}
            className={`inline-flex items-center gap-1.5 rounded-xl border-2 px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
              wireframe ? 'border-indigo-500 bg-indigo-600 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            {wireframe ? 'Khung Dây' : 'Khối 3D'}
          </button>

          {/* Zoom controls */}
          <div className="inline-flex items-center gap-1 rounded-xl border-2 border-slate-200 bg-slate-50 px-2 py-1">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.6, z - 0.2))}
              className="p-1 font-black text-slate-700 hover:text-cyan-600 cursor-pointer"
              title="Thu nhỏ"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <span className="text-xs font-bold text-slate-800 px-1">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(3.0, z + 0.2))}
              className="p-1 font-black text-slate-700 hover:text-cyan-600 cursor-pointer"
              title="Phóng to"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 3D Canvas Box */}
      <div
        className="relative h-[380px] w-full overflow-hidden rounded-2xl border-2 border-slate-200 bg-slate-50 cursor-grab active:cursor-grabbing flex items-center justify-center shadow-inner"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <canvas ref={canvasRef} width={800} height={380} className="w-full h-full object-contain" />
      </div>

      {/* Structure Specs Summary Badge */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-medium text-slate-700">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
          <span className="block text-[11px] font-black text-slate-400 uppercase">Tường Kho</span>
          <strong className="text-slate-900">{subWarehouse.structure?.wallType || 'Tường gạch / Tôn cách nhiệt'}</strong>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
          <span className="block text-[11px] font-black text-slate-400 uppercase">Trần Kho</span>
          <strong className="text-slate-900">{subWarehouse.structure?.ceilingType || 'Trần tôn PU cách nhiệt'}</strong>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
          <span className="block text-[11px] font-black text-slate-400 uppercase">Sàn Kho</span>
          <strong className="text-slate-900">{subWarehouse.structure?.floorType || 'Sàn bê tông phủ Epoxy'}</strong>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
          <span className="block text-[11px] font-black text-slate-400 uppercase">Góc Kho</span>
          <strong className="text-slate-900">{subWarehouse.structure?.cornerInfo || 'Góc bo tròn inox'}</strong>
        </div>
      </div>
    </div>
  );
}
