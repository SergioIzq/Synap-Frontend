export interface AssistantAnswer {
  answer: string;
  sourceNoteIds: string[];
  grounded: boolean;
}

export interface ChatMessage {
  question: string;
  answer: AssistantAnswer | null;
  pending: boolean;
}
