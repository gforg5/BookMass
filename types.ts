
export interface Chapter {
  id: number;
  title: string;
  content: string;
  summary: string;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  genre: string;
  coverImageUrl?: string;
  description: string;
  chapters: Chapter[];
  createdAt: number;
}

export type GenerationStep = 'idle' | 'outlining' | 'painting' | 'writing' | 'completed' | 'error';
export type AppView = 'home' | 'history' | 'about' | 'developer' | 'book';
