import { describe, it, expect, vi } from 'vitest';
import { screen, render } from '@testing-library/react';
import Error from './Error';
import MForm from '../MForm/MForm';

const props = {
    name: 'testedInput',
    id: 'test',
};

describe('Error Component', () => {
    it('renders correctly', () => {
        render(
            <MForm
                initialValues={{ testedInput: '' }}
                onSubmit={vi.fn()}
                initialErrors={
                    {
                        testedInput: {
                            type: 'manual',
                            message: 'This field is invalid',
                        },
                    }
                }
            >
                <Error {...props} />
            </MForm>
        );

        expect(screen.getByText('This field is invalid')).toBeInTheDocument();
    });
});
