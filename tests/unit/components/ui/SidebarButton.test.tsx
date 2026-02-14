import { render, screen } from '@testing-library/react';
import { SidebarButton } from '../../../../components/ui/SidebarButton';
import { describe, it, expect } from 'vitest';
import React from 'react';

// Mock Icon component
const MockIcon = (props: any) => <svg {...props} data-testid="mock-icon" />;

describe('SidebarButton', () => {
  it('renders with accessible label', () => {
    render(
      <SidebarButton
        onClick={() => {}}
        icon={MockIcon}
        label="Test Button"
      />
    );

    // Check for aria-label
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-label', 'Test Button');
  });

  it('has focus-visible styles for keyboard accessibility', () => {
    render(
      <SidebarButton
        onClick={() => {}}
        icon={MockIcon}
        label="Test Button"
      />
    );

    const button = screen.getByRole('button');
    // Check for focus-visible classes
    expect(button).toHaveClass('focus-visible:ring-2');
    expect(button).toHaveClass('focus-visible:ring-white');
    expect(button).toHaveClass('focus-visible:outline-none');
  });
});
