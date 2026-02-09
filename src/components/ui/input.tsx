import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    // If a value prop is present (even if undefined/null), we ensure it's at least an empty string
    // to prevent React from seeing it as a switch from uncontrolled to controlled.
    // File inputs must remain uncontrolled.
    const isControlled = 'value' in props;
    const controlledValue = isControlled ? (props.value ?? "") : undefined;
    const valueProps = type === 'file' ? {} : { value: controlledValue };

    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        )}
        ref={ref}
        {...props}
        {...valueProps}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
