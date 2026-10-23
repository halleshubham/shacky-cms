import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FocalPointPicker } from '@/components/editor/FocalPointPicker';

function setup(value = '') {
  const onChange = vi.fn();
  const { container } = render(<FocalPointPicker src="/img.jpg" value={value} onChange={onChange} />);
  const surface = container.querySelector('.cursor-crosshair') as HTMLElement;
  surface.getBoundingClientRect = () =>
    ({ left: 100, top: 50, width: 200, height: 100, right: 300, bottom: 150, x: 100, y: 50, toJSON: () => ({}) }) as DOMRect;
  surface.setPointerCapture = vi.fn();
  return { onChange, container, surface };
}

describe('FocalPointPicker', () => {
  it('reports the clicked point as a percentage object-position', () => {
    const { onChange, surface } = setup();
    fireEvent.pointerDown(surface, { clientX: 150, clientY: 75, pointerId: 1 });
    expect(onChange).toHaveBeenCalledWith('25% 25%');
  });

  it('clamps points dragged outside the image', () => {
    const { onChange, surface } = setup();
    fireEvent.pointerDown(surface, { clientX: 1000, clientY: -500, pointerId: 1 });
    expect(onChange).toHaveBeenCalledWith('100% 0%');
  });

  it('applies the value to the 16:9 preview crop', () => {
    const { container } = setup('30% 10%');
    const preview = container.querySelector('img.object-cover') as HTMLElement;
    expect(preview.style.objectPosition).toBe('30% 10%');
  });

  it('defaults to a centered crop', () => {
    const { container } = setup('');
    const preview = container.querySelector('img.object-cover') as HTMLElement;
    expect(preview.style.objectPosition).toBe('50% 50%');
  });

  it('shows Reset only when a focus is set, and clears it', () => {
    const { onChange } = setup('30% 10%');
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('hides Reset for the default crop', () => {
    setup('');
    expect(screen.queryByRole('button', { name: 'Reset' })).toBeNull();
  });
});
