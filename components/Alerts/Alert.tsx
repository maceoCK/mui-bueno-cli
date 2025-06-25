import { Typography, useTheme } from '@mui/material';
import MuiAlert, { AlertProps as MuiAlertProps } from '@mui/material/Alert/Alert';
import { ReactNode } from 'react';

type BaseAlertProps = {
    /** Hides the icon */
    noIcon?: boolean;

    /** Body of the alert. Recommend passing a string or component. */
    children?: ReactNode;

    /**
     * Variant of the alert: "standard", "filled", "outlined", or "leftBorder"
     * @default leftBorder
     */
    variant?: MuiAlertProps['variant'];

    /** (optional) Title for the alert */
    title?: string;
};

export type AlertProps = BaseAlertProps & Omit<MuiAlertProps, 'variant'>;

// DO NOT EXPORT IN INDEX.TS -- only used internally for SuccessAlert, InfoAlert, WarningAlert & ErrorAlert
export type InternalAlertProps = Omit<AlertProps, 'color' | 'severity'>;

// Internal Alert component. Handles common functionality between SuccessAlert, InfoAlert, WarningAlert & ErrorAlert
/**
 * Compatible with all of MUI's Alert props EXCEPT FOR:
 * - `severity` -- instead of `<Alert severity='success' {...props}>`, use `<SuccessAlert {...props}>`
 * - `color` -- do not mix up severity colors
 *
 * Additional props:
 * - `noIcon` -- icons are displayed by default. Use this to hide the icon.
 *
 * Modified props:
 * - `variant` -- works with standard MUI variants: `standard`, `filled`, `outlined`, with one additional: `leftBorder` (default) which adds a border to the left of the alert matching the severity color
 */
export const Alert = (props: AlertProps) => {
    const { noIcon = false, children, severity = 'success', variant = 'leftBorder', sx, title, ...rest } = props;
    const { palette } = useTheme();
    const iconProps = noIcon ? { icon: false } : {};

    // handle `leftBorder` variant manually
    const muiVariant = variant === 'leftBorder' ? 'standard' : variant;
    const updatedSx =
        variant === 'leftBorder'
            ? {
                  ...sx,
                  borderLeft: `4px solid ${palette[severity]?.main}`,
              }
            : sx;

    // if using a title, adjust the icon so that it's horizontally-aligned with the built-in title
    const slotProps = title
        ? {
              icon: {
                  sx: {
                      mt: '6px', // Adjust this value to align with h3 baseline
                  },
              },
          }
        : {};

    return (
        <MuiAlert
            severity={severity}
            variant={muiVariant}
            sx={updatedSx}
            slotProps={slotProps}
            {...iconProps}
            {...rest}
        >
            {title && <Typography variant="h3">{title}</Typography>}
            {children}
        </MuiAlert>
    );
};

export default Alert;
