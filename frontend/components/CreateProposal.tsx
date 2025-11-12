"use client";

import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
import { Loader2, Plus, Sparkles } from "lucide-react";

interface CreateProposalProps {
  onCreateProposal: (
    title: string,
    description: string,
    durationInSeconds: number
  ) => Promise<void>;
}

export function CreateProposal({ onCreateProposal }: CreateProposalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [durationDays, setDurationDays] = useState("7");
  const [isCreating, setIsCreating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description || !durationDays) return;

    setIsCreating(true);
    try {
      const durationInSeconds = parseInt(durationDays) * 24 * 60 * 60;
      await onCreateProposal(title, description, durationInSeconds);
      setTitle("");
      setDescription("");
      setDurationDays("7");
    } catch (error) {
      console.error("Failed to create proposal:", error);
      alert("Failed to create proposal. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="title" className="text-white flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-400" />
          Proposal Title
        </Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g., Increase Treasury Allocation"
          className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-purple-400 transition-colors"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description" className="text-white">
          Description
        </Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Explain your proposal in detail..."
          className="bg-white/10 border-white/20 text-white placeholder:text-white/40 min-h-28 focus:border-purple-400 transition-colors"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="duration" className="text-white">
          Voting Duration (days)
        </Label>
        <Input
          id="duration"
          type="number"
          value={durationDays}
          onChange={(e) => setDurationDays(e.target.value)}
          min="1"
          max="30"
          className="bg-white/10 border-white/20 text-white focus:border-purple-400 transition-colors"
          required
        />
        <p className="text-xs text-slate-400">
          Recommended: 3-7 days for community review
        </p>
      </div>

      <Button
        type="submit"
        disabled={isCreating}
        className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold py-6 text-base shadow-lg shadow-purple-500/20"
      >
        {isCreating ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Creating Proposal...
          </>
        ) : (
          <>
            <Plus className="w-5 h-5 mr-2" />
            Create Proposal
          </>
        )}
      </Button>

      <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
        <p className="text-xs text-blue-300 flex items-center gap-2">
          <span className="text-blue-400">💡</span>
          <span>Your proposal will be visible to everyone. Make sure to provide clear details!</span>
        </p>
      </div>
    </form>
  );
}
