
import { GoogleGenAI, Type } from "@google/genai";
import { Book, Chapter } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const generateBookOutline = async (title: string, author: string): Promise<Partial<Book>> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `ACT AS A WORLD-CLASS PUBLISHING EDITOR. 
    Generate a high-end book outline for a title: "${title}" by "${author}". 
    Create exactly 7 chapters that form a cohesive and thrilling narrative arc. 
    Include a genre and a sophisticated back-cover description that hooks a potential reader.`,
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
    model: 'gemini-3-pro-preview',
    contents: `ACT AS AN AWARD-WINNING NOVELIST.
    Write a complete chapter for the book "${bookTitle}". 
    Chapter Title: "${chapter.title}"
    Key Plot Event: ${chapter.summary}
    REQUIREMENTS:
    - Minimum 1000 words.
    - Immersive descriptive prose.
    - Engaging dialogue.
    - Deep emotional resonance.
    - Professional literary pacing.`,
  });

  return response.text || "Chapter writing failed.";
};

export const generateCoverOptions = async (title: string, genre: string, description: string): Promise<string[]> => {
  const coverStyles = [
    { name: "Minimalist Modern", style: "Minimalist, bold typography, flat vector illustration, striking contrast, award-winning graphic design style." },
    { name: "Classical Painterly", style: "Oil painting, fine art, visible brushstrokes, dramatic chiaroscuro lighting, classical masterpiece aesthetic." },
    { name: "Cinematic Digital", style: "Hyper-realistic 8k digital art, cinematic lighting, complex textures, atmospheric, moody, intricate details." }
  ];

  const coverPromises = coverStyles.map(async (config) => {
    const prompt = `A professional book cover illustration for a ${genre} novel titled "${title}". 
    Theme: ${description}. 
    Art Style: ${config.style}. 
    No text in the image. High-end, museum quality art.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: prompt }] },
      config: { imageConfig: { aspectRatio: "3:4" } }
    });

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
    return `https://picsum.photos/600/800?random=${Math.random()}`;
  });

  return Promise.all(coverPromises);
};
