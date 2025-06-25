import Alert, { InternalAlertProps } from './Alert';

export type ErrorAlertProps = InternalAlertProps;

export const ErrorAlert = (props: ErrorAlertProps) => {
    return <Alert severity="error" {...props} />;
};

export default ErrorAlert;
