import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test/utils';
import { SeverityBadge } from './SeverityBadge';

describe('SeverityBadge', () => {
  it('renders critical severity correctly', () => {
    render(<SeverityBadge severity="critical" />);
    expect(screen.getByText('クリティカル')).toBeInTheDocument();
  });

  it('renders high severity correctly', () => {
    render(<SeverityBadge severity="high" />);
    expect(screen.getByText('高')).toBeInTheDocument();
  });

  it('renders medium severity correctly', () => {
    render(<SeverityBadge severity="medium" />);
    expect(screen.getByText('中')).toBeInTheDocument();
  });

  it('renders low severity correctly', () => {
    render(<SeverityBadge severity="low" />);
    expect(screen.getByText('低')).toBeInTheDocument();
  });

  it('renders informational severity correctly', () => {
    render(<SeverityBadge severity="informational" />);
    expect(screen.getByText('情報')).toBeInTheDocument();
  });

  it('applies correct color classes for critical', () => {
    const { container } = render(<SeverityBadge severity="critical" />);
    const badge = container.querySelector('span');
    expect(badge).toHaveClass('bg-purple-100');
    expect(badge).toHaveClass('text-purple-800');
  });

  it('applies correct color classes for high', () => {
    const { container } = render(<SeverityBadge severity="high" />);
    const badge = container.querySelector('span');
    expect(badge).toHaveClass('bg-red-100');
    expect(badge).toHaveClass('text-red-800');
  });
});
