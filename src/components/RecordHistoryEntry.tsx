"use client";

import { useEffect } from "react";

import { buildIdeaPreview, recordPreviousIdea } from "@/lib/idea-history";

export default function RecordHistoryEntry({
  id,
  rawText,
  submittedAt,
}: {
  id: string;
  rawText: string;
  submittedAt: string;
}) {
  useEffect(() => {
    recordPreviousIdea({
      id,
      ideaPreview: buildIdeaPreview(rawText),
      submittedAt,
    });
  }, [id, rawText, submittedAt]);
  return null;
}
