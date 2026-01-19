import type { ReactNode } from "react";

type Props = {
  children?: ReactNode;
};

export const TableContainer = ({ children }: Props) => {
  return <div className="relative h-full w-full select-none">{children}</div>;
};
