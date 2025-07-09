import * as React from 'react';

import { Button as MuiButton, ButtonProps as MuiButtonProps } from '@mui/material';

import { removeStrayProps } from '../../../common/Utils';
import { useWindowDimensions } from '../../../common/WindowDimensions/WindowDimensions';

type BaseButtonProps = {
    /**
     * Name of the button.
     * @default 'button'
     */
    name?: string;
    /**
     * If true, buttons become full width at the default xs Material-UI Breakpoint (form width < 600).
     * @default true
     */
    fullWidthOnMobile?: boolean;
};

export type ButtonProps = BaseButtonProps & MuiButtonProps;

/**
 * Button doesn't have any default action. You may use for toggling or changing your own state.
 * For type 'submit', use `Submit`
 *
 * To include the Button within the layout grid of MUI-Bueno, provide either a w or a breakpoint size (xs, sm, md, lg, xl).
 * Otherwise, the button will be rendered as is (`<button>`).
 */
export const Button: React.FC<ButtonProps> = (props) => {
    const {
        name = 'button',
        color = 'primary',
        fullWidthOnMobile = true,
        type = 'button',
        variant = 'contained',
    } = props;

    const { width } = useWindowDimensions();
    const remove: string[] = ['locationInBar', 'closeDialog', 'fullWidthOnMobile'];

    const flag = fullWidthOnMobile && width < 600;

    return (
        <MuiButton
            role="button"
            name={name}
            color={color}
            variant={variant}
            type={type}
            fullWidth={props.fullWidth ? true : flag}
            {...removeStrayProps({ ...props }, remove)}
        />
    );
};
