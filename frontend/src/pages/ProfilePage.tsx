import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { updateMe } from '@/api/auth';
import { getApiErrorMessage } from '@/api/errors';
import { useToast } from '@/components/toast/useToast';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/features/auth/useAuth';
import { profileSchema, type ProfileForm } from '@/lib/schemas';

export function ProfilePage() {
  const { user, setUser } = useAuth();
  const toast = useToast();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user?.name ?? '', phone: user?.phone ?? '' },
  });

  const mutation = useMutation({
    mutationFn: (values: ProfileForm) =>
      updateMe({ name: values.name, phone: values.phone || null }),
    onSuccess: (updated) => {
      setUser(updated);
      reset({ name: updated.name, phone: updated.phone ?? '' });
      toast('Perfil actualizado', 'success');
    },
    onError: (error) => toast(getApiErrorMessage(error), 'error'),
  });

  return (
    <div className="mx-auto w-full max-w-md">
      <h1 className="mb-1 text-2xl font-bold text-slate-900">Mi perfil</h1>
      <p className="mb-6 text-sm text-slate-500">{user?.email}</p>
      <form
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
        noValidate
        className="flex flex-col gap-4"
      >
        <Input
          label="Nombre"
          autoComplete="name"
          error={errors.name?.message}
          {...register('name')}
        />
        <Input
          label="Teléfono"
          type="tel"
          autoComplete="tel"
          placeholder="+502 5555 1234"
          error={errors.phone?.message}
          {...register('phone')}
        />
        <Button type="submit" disabled={!isDirty} loading={mutation.isPending}>
          Guardar cambios
        </Button>
      </form>
    </div>
  );
}
