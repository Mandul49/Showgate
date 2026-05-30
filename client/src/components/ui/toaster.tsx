import { useToast } from "@/hooks/use-toast";

export function Toaster() {
  const { toasts } = useToast();

  return (
    <div className="fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]">
      {toasts.map(({ id, title, description }) => (
        <div key={id} className="bg-card text-card-foreground border rounded-md p-4 shadow-lg mb-2">
          {title && <div className="font-semibold">{title}</div>}
          {description && <div className="text-sm text-muted-foreground">{description}</div>}
        </div>
      ))}
    </div>
  );
}
