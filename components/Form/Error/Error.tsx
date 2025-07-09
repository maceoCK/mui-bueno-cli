import * as React from 'react';

import { Box, Typography } from '@mui/material';
import ErrorIcon from '@mui/icons-material/Error';
import { useFormContext } from 'react-hook-form';

export type ErrorProps = {
    /**
     * Name of the component.
     * @required
     */
    name: string;
    /**
     * ID of the element.
     * @required
     */
    id: string;
    /**
     * Specifies the styling on the typography.
     */
    className?: string;
};

/**
 * This component provides a simple error block containing
 * an error and status
 */
export const Error: React.FC<ErrorProps> = (props) => {
    const { name, id, className } = props;

    const {
        formState: { errors },
      } = useFormContext();

    return (
        <Typography
            id={id}
            variant="caption"
            display="block"
            color="error"
            style={{ visibility: errors[name] ? 'visible' : 'hidden' }}
            className={className}
            fontSize=".9rem"
        >
            <Box
                component="span"
                sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    position: 'relative',
                    top: '3px', // mui icons always svgs so they always need slight alignment adjustments
                    mr: 0.5,
                }}
            >
                <ErrorIcon fontSize="inherit" />
            </Box>
            {`${errors[name]?.message}`}
        </Typography>
    );
};
export default Error;
