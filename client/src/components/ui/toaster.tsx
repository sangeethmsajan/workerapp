import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { CheckCircle2, AlertCircle } from "lucide-react"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        const isDestructive = props.variant === "destructive"
        return (
          <Toast key={id} duration={3500} {...props}>
            <div className="flex items-start gap-3 w-full">
              {isDestructive ? (
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              )}
              <div className="grid gap-0.5 flex-1 min-w-0 pr-4">
                {title && <ToastTitle className="text-sm font-semibold tracking-tight text-foreground">{title}</ToastTitle>}
                {description && (
                  <ToastDescription className="text-xs text-muted-foreground leading-normal">{description}</ToastDescription>
                )}
              </div>
            </div>
            {action}
            <ToastClose className="text-foreground/40 hover:text-foreground opacity-100" />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
