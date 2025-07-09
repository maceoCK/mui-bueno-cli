import { vi } from "vitest";

let mockDefaultValue: unknown;
let mockErrorState: unknown;


export const setMockDefaultValue = <T>(val: T): void => {
  mockDefaultValue = val;
};

export const setMockErrorState = <T>(val: T): void => {
  mockErrorState = val;
};

export const clearRHFMocks = (): void => {
  mockDefaultValue = undefined;
  mockErrorState = undefined;
};

export const setValueSpy = vi.fn();

export const useFormContext = () => ({
  register: vi.fn(),
  handleSubmit: vi.fn(),
  formState: { defaultValues: { testCheckBox: mockDefaultValue }, errors: mockErrorState || {} },
  control: {},
  setValue: setValueSpy,
  getValues: vi.fn(() => mockDefaultValue),
});

export const useForm = () => ({
  register: vi.fn(),
  handleSubmit: vi.fn(),
  formState: { defaultValues: { testCheckBox: mockDefaultValue }, errors: mockErrorState || {} },
  control: {},
});

interface ControllerProps {
  name: string;
  render: (params: {
    field: {
      name: string;
      value: unknown;
      onChange: (...args: any[]) => void;
      onBlur: (...args: any[]) => void;
      ref: (...args: any[]) => void;
    };
    fieldState: {
      invalid: boolean;
      isTouched: boolean;
      isDirty: boolean;
      error?: any;
    };
    formState: {
      isSubmitting: boolean;
      isValid: boolean;
      defaultValues: unknown;
      errors: unknown;
    };
  }) => Element;
}

export const Controller = ({ render, name }: ControllerProps) =>
  render({
    field: {
      name,
      value: mockDefaultValue,
      onChange: vi.fn(),
      onBlur: vi.fn(),
      ref: vi.fn(),
    },
    fieldState: {
      invalid: false,
      isTouched: false,
      isDirty: false,
      error: undefined,
    },
    formState: {
      isSubmitting: false,
      isValid: true,
      defaultValues: mockDefaultValue,
      errors: mockErrorState,
    },
  });
