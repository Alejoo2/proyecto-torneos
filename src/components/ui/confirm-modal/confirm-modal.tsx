"use client";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "primary";
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  variant = "primary",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const buttonClass = variant === "danger" 
    ? "bg-red-500 hover:bg-red-600 text-white" 
    : "bg-gray-900 hover:bg-gray-800 text-white";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="w-full max-w-md bg-white rounded-t-3xl shadow-xl p-6 flex flex-col gap-4">
        <h2 className="text-lg font-bold text-gray-900">{title}</h2>
        <p className="text-sm text-gray-500">{message}</p>
        
        <div className="flex flex-col gap-2 mt-2">
          <button 
            onClick={onConfirm}
            className={`w-full py-3 rounded-xl font-bold text-sm uppercase tracking-wide transition-colors active:scale-[0.98] ${buttonClass}`}
          >
            {confirmText}
          </button>
          <button 
            onClick={onCancel}
            className="w-full py-3 rounded-xl font-bold text-sm uppercase tracking-wide text-gray-500 hover:bg-gray-100 transition-colors active:scale-[0.98]"
          >
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  );
}