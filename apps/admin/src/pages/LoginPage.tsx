import { useLogin } from '@refinedev/core';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Button, Card, Field, Input, tokens } from '@gabi/ui';
import { isApiMisconfigured } from '../lib/api';

export function LoginPage() {
  const { mutate: login } = useLogin();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('admin@gabi.local');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    login(
      { email, password },
      {
        onError: (err) => {
          setError(String(err));
          setIsLoading(false);
        },
        onSuccess: () => setIsLoading(false),
      },
    );
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: `linear-gradient(135deg, ${tokens.color.primary} 0%, ${tokens.color.primaryLight} 100%)`,
      }}
    >
      <Card padding="lg" className="w-full max-w-md shadow-lg">
        <form onSubmit={handleSubmit}>
          <div className="text-center mb-6">
            <img src="/gabi.png" alt="GABI" className="h-16 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-gabi-primary m-0">GABI Framework</h1>
            <p className="text-sm text-gabi-muted mt-1 mb-0">Entre para continuar</p>
          </div>

          {isApiMisconfigured() && (
            <Alert variant="danger" className="mb-4">
              <strong>API não configurada.</strong> Defina <code>VITE_API_URL</code> no deploy ou use
              o <code>vercel.json</code> da raiz do repo (admin + API no mesmo domínio).
            </Alert>
          )}

          {error && (
            <Alert variant="danger" className="mb-4">
              {error}
            </Alert>
          )}

          <Field label="E-mail" required>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Field>

          <Field label="Senha" required className="!mb-6">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Field>

          <Button type="submit" variant="accent" fullWidth disabled={isLoading}>
            {isLoading ? 'Entrando...' : 'Entrar'}
          </Button>

          <p className="text-center text-sm text-gabi-muted mt-4 mb-0">
            <Link to="/" className="text-gabi-primary underline">
              Voltar ao início
            </Link>
          </p>
        </form>
      </Card>
    </div>
  );
}
