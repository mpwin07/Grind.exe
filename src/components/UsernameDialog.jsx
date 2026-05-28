import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function UsernameDialog({
  open,
  onOpenChange,
  currentUsername,
  onSave,
}) {
  const [value, setValue] = useState(currentUsername);
  useEffect(() => setValue(currentUsername), [currentUsername, open]);

  const submit = () => {
    const v = value.trim();
    if (!v) return;
    onSave(v);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-night border-white/10">
        <DialogHeader>
          <DialogTitle className="font-display tracking-tight text-xl">LINK LEETCODE</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Drop in your LeetCode username. We pull your stats live from leetcode.com — no password needed.
          </DialogDescription>
        </DialogHeader>
        <Input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. algo_rare"
          onKeyDown={(e) => e.key === "Enter" && submit()}
          className="bg-carbon border-white/10 focus-visible:ring-neon"
        />
        <DialogFooter>
          <Button
            onClick={submit}
            className="bg-neon text-night hover:bg-neon-glow font-display text-xs tracking-widest"
          >
            CONNECT
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
