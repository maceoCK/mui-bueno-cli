import { describe, it, expect, vi } from 'vitest';
import { screen, render } from '@testing-library/react';
import { Formik, Form } from 'formik';
import { Submit } from './Submit';
import userEvent from '@testing-library/user-event';

const handleSubmit = vi.fn();

describe('Submit Component', () => {
    it('Submit renders with correct name', () => {
        render(<Submit>Submit</Submit>);
        expect(screen.getByText('Submit')).toBeInTheDocument();
    });

    it('Submit button gets clicked', async () => {
        render(
            <Formik initialValues={{}} onSubmit={handleSubmit}>
                <Form>
                    <Submit>Submit</Submit>
                </Form>
            </Formik>
        );
        await userEvent.click(screen.getByText('Submit'));
        expect(handleSubmit).toHaveBeenCalled();
    });
});
