import { useState } from 'react';

export type Validator<T> = (value: string, values: T) => string;
export type Validators<T> = Partial<Record<keyof T, Validator<T>[]>>;

export function useFormValidation<T extends Record<string, string>>(values: T, validators: Validators<T>) {
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});

  const validateField = (name: keyof T, markTouched = true) => {
    const validator = validators[name]?.find((rule) => rule(values[name], values));
    const message = validator ? validator(values[name], values) : '';
    if (markTouched) setTouched((current) => ({ ...current, [name]: true }));
    setErrors((current) => ({ ...current, [name]: message || undefined }));
    return !message;
  };

  const validateForm = () => {
    const next: Partial<Record<keyof T, string>> = {};
    const nextTouched: Partial<Record<keyof T, boolean>> = {};
    (Object.keys(validators) as Array<keyof T>).forEach((name) => {
      nextTouched[name] = true;
      const validator = validators[name]?.find((rule) => rule(values[name], values));
      if (validator) next[name] = validator(values[name], values);
    });
    setTouched(nextTouched);
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const clearFieldError = (name: keyof T) => {
    setErrors((current) => ({ ...current, [name]: undefined }));
  };

  const setFieldErrors = (fieldErrors: Record<string, string>) => {
    setErrors((current) => ({ ...current, ...fieldErrors } as Partial<Record<keyof T, string>>));
    setTouched((current) => ({
      ...current,
      ...Object.fromEntries(Object.keys(fieldErrors).map((key) => [key, true])),
    } as Partial<Record<keyof T, boolean>>));
  };

  const visibleErrors = Object.fromEntries(
    Object.entries(errors).filter(([key, value]) => touched[key as keyof T] && value),
  ) as Partial<Record<keyof T, string>>;

  return { errors: visibleErrors, validateField, validateForm, clearFieldError, setFieldErrors };
}

export const required = (label: string) => (value: string) => value.trim() ? '' : `${label} is required`;
export const minLength = (label: string, length: number) => (value: string) =>
  value.length >= length ? '' : `${label} must be at least ${length} characters`;
export const email = (value: string) => /\S+@\S+\.\S+/.test(value) ? '' : 'Enter a valid email address';
