/** Botão laranja padrão do sistema. Repassa qualquer prop (onClick, disabled, type, etc.) pro <button>. */
export default function PrimaryButton({ children, className = '', ...props }) {
  return (
    <button
      type="button"
      className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-control bg-primary px-4 py-2 text-sm font-medium text-white shadow-card transition-colors duration-150 hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
