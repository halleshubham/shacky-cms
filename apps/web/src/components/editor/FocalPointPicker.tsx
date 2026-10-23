'use client';
import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

interface FocalPointPickerProps {
  src: string;
  /** CSS object-position, e.g. "50% 30%"; empty means centered. */
  value: string;
  onChange: (value: string) => void;
}

function parse(value: string): { x: number; y: number } {
  const m = value.match(/^([\d.]+)% ([\d.]+)%$/);
  return m ? { x: Number(m[1]), y: Number(m[2]) } : { x: 50, y: 50 };
}

export function FocalPointPicker({ src, value, onChange }: FocalPointPickerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { x, y } = parse(value);

  const pick = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = ref.current!.getBoundingClientRect();
    const px = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
    const py = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100));
    onChange(`${Math.round(px)}% ${Math.round(py)}%`);
  };

  return (
    <div className="space-y-2 mt-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs">Crop focus</Label>
        {value && (
          <Button type="button" variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => onChange('')}>
            Reset
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">Click or drag on the image to choose the point that stays visible when it is cropped.</p>
      <div
        ref={ref}
        className="relative cursor-crosshair touch-none select-none overflow-hidden rounded border"
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); pick(e); }}
        onPointerMove={(e) => { if (e.buttons) pick(e); }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" draggable={false} className="w-full block" />
        <div
          className="absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary/60 shadow ring-1 ring-black/40 pointer-events-none"
          style={{ left: `${x}%`, top: `${y}%` }}
        />
      </div>
      <Label className="text-xs">Preview (16:9, as shown on article page)</Label>
      <div className="relative aspect-[16/9] overflow-hidden rounded border bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: `${x}% ${y}%` }} />
      </div>
    </div>
  );
}
