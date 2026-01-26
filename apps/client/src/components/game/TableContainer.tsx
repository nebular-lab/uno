import type { ReactNode } from "react";

type Props = {
  children?: ReactNode;
};

export const TableContainer = ({ children }: Props) => {
  return (
    <div className="relative h-full w-full select-none bg-gradient-to-b from-slate-900 to-slate-800 overflow-hidden">
      {children}
    </div>
  );
};
