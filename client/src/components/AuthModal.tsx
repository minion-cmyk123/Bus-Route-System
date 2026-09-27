import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { api } from '../api';
import { Modal, ErrorMessage } from './UI';
import type { User } from '../../../shared/types';
export function AuthModal({ onClose }: { onClose: () => void }) {
  const [register, setRegister] = useState(false);
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (data: Record<string, string>) =>
      api<{ user: User }>(`/auth/${register ? 'register' : 'login'}`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: (data) => {
      qc.setQueryData(['me'], data);
      qc.invalidateQueries({ queryKey: ['saved'] });
      onClose();
    },
  });
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    mutation.mutate(Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>);
  }
  return (
    <Modal title={register ? 'Make yourself at home.' : 'Welcome back.'} onClose={onClose}>
      <p className="muted">Save your everyday journeys and spend less time planning.</p>
      <form onSubmit={submit} className="form-stack">
        {register && (
          <label>
            Your name
            <input name="name" autoComplete="name" maxLength={80} required />
          </label>
        )}
        <label>
          Email address
          <input name="email" type="email" autoComplete="email" maxLength={254} required />
        </label>
        <label>
          Password
          <input
            aria-label="Password"
            aria-describedby={register ? 'password-help' : undefined}
            name="password"
            type="password"
            autoComplete={register ? 'new-password' : 'current-password'}
            minLength={register ? 12 : 1}
            maxLength={128}
            required
          />
          {register && <small id="password-help">Use at least 12 characters.</small>}
        </label>
        <ErrorMessage error={mutation.error} />
        <button className="button primary" disabled={mutation.isPending}>
          {mutation.isPending ? 'One moment…' : register ? 'Create account' : 'Sign in'}
          <ArrowRight size={17} />
        </button>
      </form>
      <button
        className="auth-switch text-button"
        onClick={() => {
          setRegister(!register);
          mutation.reset();
        }}
      >
        {register ? 'Already have an account? Sign in' : 'New here? Create an account'}
      </button>
      <div className="security-note">
        <ShieldCheck size={16} /> Your saved journeys stay in your account.
      </div>
    </Modal>
  );
}
