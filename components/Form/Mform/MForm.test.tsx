import { describe, it, expect, beforeEach, vi } from 'vitest'; // Assuming vitest for testing utilities
import { render, screen } from '@testing-library/react';
import MForm from './MForm';
import { TextField } from '../Inputs/TextField/TextField';
import * as Yup from 'yup';
import userEvent from '@testing-library/user-event';
import { Submit } from '../../Buttons/Submit/Submit';

const handleSubmit = vi.fn();

const textFieldFirstNameProps = {
    name: 'firstName',
    label: 'First Name',
};
const textFieldLastNameProps = {
    name: 'lastName',
    label: 'Last Name',
};
const formValidationSchema = Yup.object().shape({
    firstName: Yup.string().nullable().required('First Name is required'),
    lastName: Yup.string().nullable().required('Last Name is required'),
});
const mockInitialValue = { firstName: 'John', lastName: 'Doe' };
const mockInitialValueEmpty = { firstName: '', lastName: '' };
const consoleMock = vi.spyOn(console, 'error').mockImplementation(() => {});

describe('MForm Component', () => {
    beforeEach(() => {
        vi.clearAllMocks(); // Clear all mock calls before each test
        consoleMock.mockReset();
    });

    it('updates initial form value reflect on the child component', async () => {
        render(
            <MForm initialValues={mockInitialValue} onSubmit={vi.fn()}>
                <TextField {...textFieldFirstNameProps} />
                <TextField {...textFieldLastNameProps} />
            </MForm>
        );

        expect(screen.getByLabelText('First Name')).toHaveValue('John');
        expect(screen.getByLabelText('Last Name')).toHaveValue('Doe');
    });

    it('validation prevent form submit', async () => {
        render(
            <MForm
                initialValues={mockInitialValueEmpty}
                onSubmit={handleSubmit}
                validationSchema={formValidationSchema}
                validationOnMount
            >
                <TextField {...textFieldFirstNameProps} />
                <TextField {...textFieldLastNameProps} />
                <Submit>Submit</Submit>
            </MForm>
        );
        await userEvent.type(screen.getByLabelText('Last Name'), 'Doe');

        expect(screen.getByLabelText('First Name')).toHaveValue('');
        expect(screen.getByLabelText('Last Name')).toHaveValue('Doe');

        await userEvent.click(screen.getByText('Submit'));
        expect(handleSubmit).not.toHaveBeenCalled(); //validation prevent handleSubmit from being called
        expect(screen.getByLabelText('First Name').parentElement).toHaveClass('Mui-error');
        expect(screen.getAllByText('First Name')[0]).toHaveClass('Mui-error');
    });
});
