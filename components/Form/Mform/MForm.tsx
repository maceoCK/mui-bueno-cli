import {
  useForm,
  FormProvider,
  type SubmitHandler,
  type FieldValues,
  type DefaultValues,
  Path,
  FieldErrors,
  useWatch,
  UseFormSetValue,
  UseFormReturn,
} from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import type { AnyObjectSchema } from 'yup';
import * as yup from 'yup';
import { useEffect } from 'react';

type MFormProps<T extends FieldValues> = Readonly<{
  initialValues: DefaultValues<T>;
  initialErrors?: FieldErrors<T>;
  onSubmit: SubmitHandler<T>;
  children: React.ReactNode | ((props: {
    values: T;
    setValue: UseFormSetValue<T>;
    methods: UseFormReturn<T>
  }) => React.ReactNode);
  validationSchema?: AnyObjectSchema;
  shouldValidateOption?: boolean;
  validationOnMount?: boolean;
}>;

export function MForm<T extends FieldValues>({
  initialValues,
  onSubmit,
  children,
  initialErrors,
  validationSchema = yup.object({}),
  shouldValidateOption = true,
  validationOnMount = false
}: MFormProps<T>) {
  const { setValue: rhfSetValue, trigger, ...methods} = useForm<T>({
    defaultValues: initialValues,
    resolver: yupResolver(validationSchema),
    mode: "onChange",
    errors: initialErrors
  });

  const { control } = methods;

  const values = useWatch<T>({ control }) as T;

  const setValue = <K extends Path<T>>(name: K, value: T[K]) => {
    rhfSetValue(name, value, { shouldValidate: shouldValidateOption });
  };

  useEffect(() => {
    validationOnMount && trigger()
  }, [trigger])

  return (
    <FormProvider {...methods} setValue={setValue} trigger={trigger}>
      <form onSubmit={methods.handleSubmit(onSubmit)}>
        { typeof children === 'function' ? children({ values, setValue, methods: {...methods, setValue, trigger} }) : children}
      </form>
    </FormProvider>
  );
}

export default MForm;
