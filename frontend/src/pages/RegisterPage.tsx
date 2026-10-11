import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { getApiError, getApiErrorMessage } from '@/api/errors';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/features/auth/useAuth';
import { registerSchema, type RegisterForm } from '@/lib/schemas';

interface LocationState {
  from?: { pathname: string; search?: string };
}

export function RegisterPage() {
  const { register: registerUser, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) });

  const from = (location.state as LocationState | null)?.from;
  const redirectTo = from ? `${from.pathname}${from.search ?? ''}` : '/';

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await registerUser({
        name: values.name,
        email: values.email,
        phone: values.phone || null,
        password: values.password,
      });
      navigate(redirectTo, { replace: true });
    } catch (error) {
      const apiError = getApiError(error);
      if (apiError?.code === 'CONFLICT') {
        setError('email', { message: apiError.message });
        return;
      }
      setServerError(getApiErrorMessage(error));
    }
  });

  // Con sesión iniciada no tiene sentido mostrar el formulario
  if (user) return <Navigate to={redirectTo} replace />;

  return (
    <div className="mx-auto w-full max-w-md">
      <h1 className="mb-6 text-2xl font-bold text-slate-900">Crear cuenta</h1>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {serverError && <Alert tone="error">{serverError}</Alert>}
        <Input
          label="Nombre"
          autoComplete="name"
          error={errors.name?.message}
          {...register('name')}
        />
        <Input
          label="Correo electrónico"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <Input
          label="Teléfono (opcional)"
          type="tel"
          autoComplete="tel"
          placeholder="+502 5555 1234"
          error={errors.phone?.message}
          {...register('phone')}
        />
        <Input
          label="Contraseña"
          type="password"
          autoComplete="new-password"
          hint="Mínimo 8 caracteres, con al menos una letra y un número"
          error={errors.password?.message}
          {...register('password')}
        />
        <Input
          label="Confirmar contraseña"
          type="password"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />
        <Button type="submit" size="lg" loading={isSubmitting}>
          Crear cuenta
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600">
        ¿Ya tienes cuenta?{' '}
        <Link
          to="/login"
          state={location.state}
          className="font-medium text-brand-600 hover:underline"
        >
          Inicia sesión
        </Link>
      </p>
    </div>
  );
}
