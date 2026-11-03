import { Dialog, DialogContent } from "./ui/dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * ルール説明動画のダイアログ
 * 動画は各アプリの public/tutorial/tutorial.mp4 に置く（client で pnpm render:tutorial で書き出す）
 */
export const TutorialVideoDialog = ({ open, onOpenChange }: Props) => (
  <Dialog onOpenChange={onOpenChange} open={open}>
    <DialogContent className="max-w-[1024px] p-4">
      {/* biome-ignore lint/a11y/useMediaCaption: 字幕は映像に焼き込み済み */}
      <video
        className="w-full max-w-[960px] aspect-video bg-black"
        controls
        playsInline
        preload="metadata"
        src="/tutorial/tutorial.mp4"
      />
    </DialogContent>
  </Dialog>
);
