import * as React from "react";

import {
  Typography,
  TypographyProps,
  TextField as MuiTextField,
  TextFieldProps as MuiTextFieldProps,
  FormControl,
  Box,
} from "@mui/material";

import { Controller, useFormContext } from "react-hook-form";
import { Error } from '../../Error/Error';
import { autoformat, makeLabel, removeStrayProps } from '../../../../common/Utils';

type BaseTextFieldProps = {
  /**
   * Name and ID of the component. Must match a key from initialValues in Formik.
   * @required
   */
  name: string;
  /**
   * If true, ensures that user enters only input that matches the format.
   * Defaults to true if a format is specified.
   * @default format ? true : false
   */
  autoFormat?: boolean;
  /**
   * A format string that will be used for formatting the user input.
   * 9 = numbers, X = characters
   * @example
   * format='999-XXX-9999'
   */
  format?: string;
  /**
   * If true, the prepackaged dynamic input label that comes with Material UI's input components
   * will be replaced with a static typography label above the input.
   * @default false
   */
  staticLabel?: boolean;
  /**
   * Props from MUI-Bueno's Typography component.
   * Used to customize the label when the static label option is selected or the field is readOnly.
   */
  staticLabelProps?: TypographyProps;

  /**
   * If `true`, the component becomes readonly.
   * @default false
   */
  readOnly?: boolean;

  /**
   * If provided, will show the icon at the start of the input field.
   */
  startIcon?: React.JSX.Element;

  /**
   * If provided, will show the icon at the end of the input field.
   */
  endIcon?: React.JSX.Element;

  /**
   * Margin for the FormControl
   */
  margin?: "dense" | "none" | "normal";

  /**
   * By default, TextField will trim leading and trailing whitespace on blur. To disable this, set `noTrimOnBlur` to true.
   */
  noTrimOnBlur?: boolean;
};

export type TextFieldProps = BaseTextFieldProps &
  Omit<
    MuiTextFieldProps,
    "defaultValue" | "error" | "fullWidth" | "select" | "SelectProps" | "value"
  >;

/**
 * The `TextField` is a MUI input. For use with validation, view the examples at the bottom of this page.
 */
export const TextField: React.FC<TextFieldProps> = ({ noTrimOnBlur, ...props }) => {
  const {
    name,
    label = makeLabel(name),
    format = "",
    autoFormat = format,
    placeholder = label,
    staticLabel = false,
    staticLabelProps = { fontSize: ".9em", color: "#808080" },
    readOnly = false,
    startIcon,
    endIcon,
    margin = "dense",
  } = props;

  // React Hook Form Boilerplate -----------------------------
  const {
    control,
    setValue,
    getValues,
    formState: { errors }
  } = useFormContext();

  // ------------------------------------------------

  if (getValues(name) === undefined) {
    console.error(`Please set an initial value for ${name}`);
  }
  if (!format && autoFormat) {
    console.error("Can't auto format when there is no format");
  }

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    // autoFormat ensures that the user enters the correct formatted value
    if (autoFormat) {
      const formattedValue = autoformat(
        event.target.value,
        format,
        getValues(name),
        event.target
      );
      // Sends formatted value to formik context store
      setValue(name, formattedValue);
    } else {
      // None formatted value is sent to formik context store
      setValue(name, event.target.value);
    }

    if (props.onChange) {
      props.onChange(event);
    }
  };

  const remove: string[] = [
    "autoFormat",
    "format",
    "staticLabel",
    "staticLabelProps",
    "endIcon",
    "startIcon",
  ];

  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <FormControl margin={margin} fullWidth>
          {(staticLabel || readOnly) && (
            <Typography {...staticLabelProps}>{label}</Typography>
          )}

          {readOnly ? (
            <Typography>{getValues(name)}</Typography>
          ) : (
            <Box>
              <MuiTextField
                {...field}
                variant="outlined"
                fullWidth
                {...getValues}
                id={`${name}-tf`}
                error={Boolean(errors[name])}
                placeholder={placeholder as string}
                {...removeStrayProps({ ...props }, remove)}
                onChange={handleChange}
                label={staticLabel ? undefined : label}
                slotProps={{
                  input: {
                    endAdornment: endIcon,
                    startAdornment: startIcon,
                  },
                }}
                onBlur={(event) => {
                  // auto-trim leading & trailing whitespace
                  if (!noTrimOnBlur) setValue(name, event.target.value.trim());

                  // if developer has defined onBlur, call their onBlur next:
                  if (props.onBlur) props.onBlur(event);
                }}
              />
              <Error name={name} id={`${name}-err`} />
            </Box>
          )}
        </FormControl>
      )}
    />
  );
};
