import { describe, it, expect, vi } from 'vitest';
import { screen, render } from '@testing-library/react';
import { Button } from './Button';
import userEvent from '@testing-library/user-event';

const handleClick = vi.fn();

describe('Button Component', () => {
    it('Button renders with correct name', () => {
        render(<Button onClick={handleClick}> Click Me </Button>);
        expect(screen.getByText('Click Me')).toBeInTheDocument();
    });

    it('Button gets clicked', async () => {
        render(<Button onClick={handleClick}> Click Me </Button>);
        await userEvent.click(screen.getByText('Click Me'));
        expect(handleClick).toHaveBeenCalledTimes(1);
    });
});
