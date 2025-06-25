import Alert, { InternalAlertProps } from './Alert';

export type WarningAlertProps = InternalAlertProps;

export const WarningAlert = (props: WarningAlertProps) => {
    return <Alert severity="warning" {...props} />;
};

export default WarningAlert;
