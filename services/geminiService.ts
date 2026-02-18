import { GoogleGenAI, Type } from "@google/genai";
import { Book, Chapter } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const generateBookOutline = async (title: string): Promise<Partial<Book>> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Generate a structured outline for a book titled "${title}". 
    Create 5 compelling chapters with titles and short summaries. 
    Include a genre and a brief back-cover description.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          genre: { type: Type.STRING },
          description: { type: Type.STRING },
          chapters: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.NUMBER },
                title: { type: Type.STRING },
                summary: { type: Type.STRING }
              },
              required: ["id", "title", "summary"]
            }
          }
        },
        required: ["title", "genre", "description", "chapters"]
      }
    }
  });

  return JSON.parse(response.text || '{}');
};

export const generateChapterContent = async (bookTitle: string, chapter: { title: string, summary: string }): Promise<string> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Write a full chapter for the book "${bookTitle}". 
    The chapter is titled "${chapter.title}" and the plot point is: ${chapter.summary}.
    Write in a professional, engaging literary style. Aim for approximately 400-600 words.`,
  });

  return response.text || "Content generation failed.";
};

export const generateCoverImage = async (title: string, author: string, genre: string, description: string): Promise<string> => {
  const prompt = `A professional, high-quality, high-aesthetic book cover for a ${genre} novel. 
  Title: "${title}"
  Author: "${author}"
  Theme: ${description}
  Visual Style: Cinematic lighting, evocative atmospheric illustration. 
  Crucial Instruction: Please design the cover layout to include the title "${title}" and the author name "${author}" in a clear, stylish, and premium font that is beautifully integrated into the artwork. Professional typography is mandatory.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts: [{ text: prompt }] },
    config: {
      imageConfig: {
        aspectRatio: "3:4"
      }
    }
  });

  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }

  return 'https://picsum.photos/600/800'; // Fallback
};