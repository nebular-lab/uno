import { BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  onClick: () => void;
};

export const ScoreButton = ({ onClick }: Props) => {
  return (
    <Button
      className="absolute right-4 top-4 size-[80px] bg-slate-700 text-white hover:bg-slate-600"
      onClick={onClick}
      variant="ghost"
    >
      <BarChart3 className="h-6 w-6" />
    </Button>
  );
};
