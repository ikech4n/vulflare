import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test/utils';
import { StatusBadge } from './StatusBadge';

describe('StatusBadge', () => {
  it('renders active status correctly', () => {
    render(<StatusBadge status="active" />);
    expect(screen.getByText('対応中')).toBeInTheDocument();
  });

  it('renders fixed status correctly', () => {
    render(<StatusBadge status="fixed" />);
    expect(screen.getByText('修正済み')).toBeInTheDocument();
  });

  it('renders accepted_risk status correctly', () => {
    render(<StatusBadge status="accepted_risk" />);
    expect(screen.getByText('リスク受容')).toBeInTheDocument();
  });

  it('renders false_positive status correctly', () => {
    render(<StatusBadge status="false_positive" />);
    expect(screen.getByText('誤検知')).toBeInTheDocument();
  });

  it('applies correct color classes for active', () => {
    const { container } = render(<StatusBadge status="active" />);
    const badge = container.querySelector('span');
    expect(badge).toHaveClass('bg-blue-100');
    expect(badge).toHaveClass('text-blue-800');
  });

  it('applies correct color classes for fixed', () => {
    const { container } = render(<StatusBadge status="fixed" />);
    const badge = container.querySelector('span');
    expect(badge).toHaveClass('bg-green-100');
    expect(badge).toHaveClass('text-green-800');
  });
});
