export const DeployEmptyTerminal = ({ message = 'waiting for docker compose…' }: { message?: string }) => <span className="text-neutral-500">$ {message}</span>;
