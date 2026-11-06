import { startTransition, type FormEvent } from 'react';

/**
 * onSubmit handler that calls a useActionState dispatcher with the form's data WITHOUT React 19's automatic form reset
 * (which would wipe what was typed — or desync controlled radios — when the action returns a validation error).
 */
export function submitWith(dispatch: (fd: FormData) => void) {
  return (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    const fd = new FormData(e.currentTarget, submitter);
    startTransition(() => dispatch(fd));
  };
}
