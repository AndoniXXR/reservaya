import { getApiErrorMessage } from '@/api/errors';
import { Alert } from './Alert';
import { Button } from './Button';

export function ErrorMessage({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <Alert tone="error">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span>{getApiErrorMessage(error)}</span>
        {onRetry && (
          <Button size="sm" variant="secondary" onClick={onRetry}>
            Reintentar
          </Button>
        )}
      </div>
    </Alert>
  );
}
