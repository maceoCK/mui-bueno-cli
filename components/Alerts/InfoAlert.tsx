import Alert, { InternalAlertProps } from './Alert';

export type InfoAlertProps = InternalAlertProps;

export const InfoAlert = (props: InfoAlertProps) => {
    return <Alert severity="info" {...props} />;
};

export default InfoAlert;
