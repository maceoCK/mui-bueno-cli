import { describe, it, expect, beforeEach, vi } from 'vitest'; // Assuming vitest for testing utilities
import { render, screen, waitFor } from '@testing-library/react';
import { TextField } from './TextField';
import userEvent from '@testing-library/user-event';
import { clearRHFMocks, setMockDefaultValue, setMockErrorState, setValueSpy } from '../../../../common/TestUtils/reactHookForms';

const props = {
    name: 'firstName',
    label: 'First Name',
};

vi.mock("react-hook-form", async () => {
  return await import("../../../../common/TestUtils/reactHookForms");
});

const consoleMock = vi.spyOn(console, 'error').mockImplementation(() => {});

describe('TextField Component', () => {
    beforeEach(() => {
        vi.clearAllMocks(); // Clear all mock calls before each test
        clearRHFMocks();
        consoleMock.mockReset();
    });

    it('renders with provided label', () => {
        render(<TextField {...props} />);

        expect(screen.getByLabelText('First Name')).toBeInTheDocument();
    });

    it('updates value on change', async () => {
        render(<TextField {...props} />);

        const input = screen.getByLabelText('First Name');
        await userEvent.type(input, 'J');
        expect(setValueSpy).toHaveBeenCalledWith('firstName', 'J');
    });

    it('renders as readOnly', async () => {
        setMockDefaultValue('John');

        render(<TextField {...props} readOnly />);

        expect(screen.getByText('First Name')).toHaveClass('MuiTypography-root MuiTypography-body1');
        expect(await screen.findByText('John')).toHaveClass('MuiTypography-root MuiTypography-body1');
    });

    it('autoformats when a format is provided', async () => {
        setMockDefaultValue('123123123');

        render(<TextField {...props} format="999-999-9999" />);

        await userEvent.type(screen.getByLabelText('First Name'), '4');
        expect(setValueSpy).toHaveBeenCalledWith('firstName', '123-123-1234');
    });

    it('logs a console error autoformat is specified but  a format is not defined', () => {
        render(<TextField {...props} autoFormat />);

        expect(consoleMock).toHaveBeenCalledWith("Can't auto format when there is no format");
    });

    it('logs a console error when an initial value is not specified', () => {
        setMockDefaultValue(undefined)
        render(<TextField {...props} />);

        expect(consoleMock).toHaveBeenCalledWith('Please set an initial value for firstName');
    });

    it('hides floating label when static label is enabeld', async () => {
        render(<TextField {...props} staticLabel />);

        // Typography label should exist
        const label = screen.getByText('First Name');
        expect(label).toHaveClass('MuiTypography-body1');

        // Floating label should not exist
        expect(await screen.queryByLabelText('First Name')).toBeNull();
    });

    it('should call onChange if one is supplied', async () => {
        const mockOnChange = vi.fn();
        render(<TextField {...props} onChange={mockOnChange} />);

        await userEvent.type(screen.getByLabelText('First Name'), 'A');

        expect(mockOnChange).toHaveBeenCalled();
    });

    it('should pass error to MUI when formik has an error', () => {
        setMockErrorState({firstName: {message: 'There is an error', type: 'required'}});

        render(<TextField {...props} />);

        expect(screen.getByLabelText('First Name').parentElement).toHaveClass('Mui-error');
        expect(screen.getAllByText('First Name')[0]).toHaveClass('Mui-error');
    });

    it('should trim whitespace automatically on blur', async () => {
        render(<TextField {...props} />);

        await userEvent.type(screen.getByLabelText('First Name'), '   John    [Tab]');
        await waitFor(() => expect(setValueSpy).toHaveBeenLastCalledWith('firstName', 'John'));
    });

    it('should NOT trim whitespace automatically on blur if noTrimOnBlur is true', async () => {
        render(<TextField {...props} noTrimOnBlur />);

        await userEvent.type(screen.getByLabelText('First Name'), '   John    [Tab]');
        await waitFor(() => expect(setValueSpy).toHaveBeenLastCalledWith('firstName', '   John    '));
    });

    it('should call onBlur and internal onBlur (trim whitespace)', async () => {
        const customOnBlur = vi.fn();
        render(<TextField {...props} onBlur={customOnBlur} />);

        await userEvent.type(screen.getByLabelText('First Name'), '   John    [Tab]');
        await waitFor(() => expect(setValueSpy).toHaveBeenCalledWith('firstName', 'John'));
        expect(customOnBlur).toHaveBeenCalled();
    });

    it('should call onBlur but NOT trim whitespace if noTrimOnBlur is true', async () => {
        const customOnBlur = vi.fn();
        render(<TextField {...props} noTrimOnBlur onBlur={customOnBlur} />);

        await userEvent.type(screen.getByLabelText('First Name'), '   John    [Tab]');
        await waitFor(() => expect(setValueSpy).toHaveBeenLastCalledWith('firstName', '   John    '));
        expect(customOnBlur).toHaveBeenCalled();
    });
});
