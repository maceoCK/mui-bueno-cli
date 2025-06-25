import Alert, { InternalAlertProps } from './Alert';

export type SuccessAlertProps = InternalAlertProps;

export const SuccessAlert = (props: SuccessAlertProps) => {
    return <Alert severity="success" {...props} />;
};

export default SuccessAlert;
