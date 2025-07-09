import * as React from 'react';

import { Button, ButtonProps } from '../Button/Button';

export type SubmitProps = ButtonProps;

/**
 * IMPORTANT: Has to be a child of Form
 *
 * This button will automatically submit the form. It accepts all the props that Button accepts, since it is a specific type of Button.
 *
 * This button does not have its own props; it uses the props from Button.
 */
export const Submit: React.FC<SubmitProps> = (props) => {
    const { name = 'submit' } = props;

    return <Button name={name} type="submit" {...props} />;
};
