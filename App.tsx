
import React, { useState, useEffect } from 'react';
import { Book, GenerationStep, AppView } from './types';
import { generateBookOutline, generateChapterContent, generateCoverImage } from './services/geminiService';
import { Button } from './components/Button';

const App: React.FC = () => {
  const [titleInput, setTitleInput] = useState('');
  const [step, setStep] = useState<GenerationStep>('idle');
  const [view, setView] = useState<AppView>('home');
  const [book, setBook] = useState<Book | null>(null);
  const [history, setHistory] = useState<Book[]>([]);
  const [progress, setProgress] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  
  useEffect(() => {
    const saved = localStorage.getItem('bookmass_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, []);

  useEffect(() => {
    if (history.length > 0) {
      localStorage.setItem('bookmass_history', JSON.stringify(history));
    }
  }, [history]);

  const handleGenerate = async () => {
    if (!titleInput.trim()) return;

    setStep('outlining');
    setProgress(10);
    setBook(null);
    setView('home');

    try {
      const outline = await generateBookOutline(titleInput);
      setProgress(30);

      setStep('painting');
      const coverUrlPromise = generateCoverImage(
        outline.title || titleInput, 
        outline.genre || 'General', 
        outline.description || ''
      );

      setStep('writing');
      const chaptersWithContent = [];
      const totalChapters = outline.chapters?.length || 0;

      for (let i = 0; i < totalChapters; i++) {
        const chapter = outline.chapters![i];
        const content = await generateChapterContent(outline.title!, chapter);
        chaptersWithContent.push({ ...chapter, content });
        setProgress(30 + ((i + 1) / totalChapters) * 50);
      }

      const coverImageUrl = await coverUrlPromise;
      
      const newBook: Book = {
        id: crypto.randomUUID(),
        title: outline.title || titleInput,
        author: 'BookMass ARCHIVE',
        genre: outline.genre || 'CLASSIC',
        description: outline.description || '',
        coverImageUrl,
        chapters: chaptersWithContent,
        createdAt: Date.now()
      };

      setBook(newBook);
      setHistory(prev => [newBook, ...prev]);
      setStep('completed');
      setView('book');
      setProgress(100);
    } catch (error) {
      console.error(error);
      setStep('error');
    }
  };

  const cleanContent = (text: string) => {
    // Removes asterisks and hashes that often appear in AI-generated Markdown
    return text.replace(/[*#]/g, '').trim();
  };

  const downloadPDF = async () => {
    if (!book) return;
    setIsExporting(true);
    
    const element = document.getElementById('book-content');
    if (!element) {
      setIsExporting(false);
      return;
    }

    const opt = {
      margin:       0.75,
      filename:     `${book.title.replace(/\s+/g, '_')}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { 
        scale: 2, 
        useCORS: true,
        logging: false,
        letterRendering: true
      },
      jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' },
      pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] }
    };

    try {
      // @ts-ignore
      await html2pdf().set(opt).from(element).save();
    } catch (err) {
      console.error("PDF generation failed:", err);
      window.print();
    } finally {
      setIsExporting(false);
    }
  };

  const exportJSON = (targetBook: Book) => {
    const blob = new Blob([JSON.stringify(targetBook, null, 2)], {type : 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${targetBook.title.replace(/\s+/g, '_')}.json`;
    a.click();
  };

  const deleteFromHistory = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setHistory(prev => prev.filter(b => b.id !== id));
  };

  const selectBook = (b: Book) => {
    setBook(b);
    setStep('completed');
    setView('book');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-start p-6 md:p-12">
      {/* Brand Header */}
      <div className="flex flex-col items-center mb-16 no-print fade-in w-full">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-14 h-14 bg-white rounded-2xl shadow-xl border border-slate-100 flex items-center justify-center overflow-hidden">
            <svg className="w-8 h-8 text-[#0f172a]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M11 2L6 7l1 1h8l1-1-5-5zM4 9v11a2 2 0 002 2h12a2 2 0 002-2V9H4zm11 8H9v-2h6v2z" />
            </svg>
          </div>
          <h1 className="text-4xl font-black tracking-tighter text-[#0f172a]">BookMass</h1>
        </div>

        <nav className="nav-pill flex items-center rounded-full px-5 py-2.5 gap-2 md:gap-6 border border-slate-100 bg-white/80 backdrop-blur-md">
          <button onClick={() => setView('history')} className={`flex items-center gap-2 px-5 py-2 rounded-full transition-all text-sm font-bold ${view === 'history' ? 'bg-[#0f172a] text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Records
          </button>
          <div className="w-px h-6 bg-slate-200"></div>
          <button onClick={() => setView('home')} className={`flex items-center gap-2 px-5 py-2 rounded-full transition-all text-sm font-bold ${view === 'home' ? 'bg-[#0f172a] text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            New Book
          </button>
          <div className="w-px h-6 bg-slate-200"></div>
          <button onClick={() => setView('developer')} className={`flex items-center gap-2 px-5 py-2 rounded-full transition-all text-sm font-bold ${view === 'developer' ? 'bg-[#0f172a] text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
            Developer
          </button>
          <div className="w-px h-6 bg-slate-200"></div>
          <button onClick={() => setView('about')} className={`flex items-center gap-2 px-5 py-2 rounded-full transition-all text-sm font-bold ${view === 'about' ? 'bg-[#0f172a] text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            About
          </button>
        </nav>
      </div>

      {/* Views Logic */}
      {view === 'home' && step === 'idle' && (
        <main className="w-full max-w-4xl flex flex-col items-center text-center mt-4 animate-in fade-in duration-1000 no-print">
          <div className="mb-6 bg-[#0f172a] text-white px-5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.3em] shadow-sm">
            The Ultimate Book Factory
          </div>
          <h2 className="text-5xl md:text-8xl font-black text-slate-900 mb-8 leading-tight tracking-tight hero-gradient">
            Fastest Book Writer <br/>
            in Minutes
          </h2>
          <p className="text-lg md:text-xl text-slate-500 mb-12 max-w-2xl font-medium leading-relaxed">
            BookMass transforms any idea into a fully-fleshed book with chapters, illustrations, and a professional layout.
          </p>
          
          <div className="w-full max-w-2xl px-4">
            <div className="relative group bg-white p-3 rounded-3xl shadow-2xl shadow-slate-200 border border-slate-100">
              <input 
                type="text" 
                placeholder="What's your book title?"
                className="w-full px-6 py-5 text-xl bg-transparent border-none focus:ring-0 transition-all outline-none font-bold placeholder:text-slate-200"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
              />
              <Button 
                className="mt-4 md:mt-0 md:absolute md:right-2 md:top-2 md:bottom-2 px-10"
                onClick={handleGenerate}
                isLoading={false}
              >
                Faster Build Books
              </Button>
            </div>
          </div>
        </main>
      )}

      {(step !== 'idle' && step !== 'completed' && step !== 'error' && view === 'home') && (
        <main className="w-full max-w-xl flex flex-col items-center text-center mt-20 no-print p-14 bg-white rounded-[3.5rem] shadow-2xl border border-slate-50">
          <div className="w-20 h-20 mb-10 relative">
             <div className="absolute inset-0 border-[4px] border-slate-50 rounded-full"></div>
             <div className="absolute inset-0 border-[4px] border-[#0f172a] rounded-full border-t-transparent animate-spin"></div>
          </div>
          <h3 className="text-3xl font-black text-[#0f172a] mb-2 uppercase tracking-tight">
            {step === 'outlining' && "Drafting Structure"}
            {step === 'painting' && "Synthesizing Cover"}
            {step === 'writing' && "Generating Chapters"}
          </h3>
          <div className="w-full bg-slate-50 h-3 rounded-full overflow-hidden mb-6 p-1 border border-slate-100 shadow-inner">
            <div 
              className="bg-[#0f172a] h-full rounded-full transition-all duration-700 ease-out"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <span className="text-[11px] font-black text-[#0f172a] tracking-[0.5em]">{Math.round(progress)}% COMPLETED</span>
        </main>
      )}

      {view === 'history' && (
        <main className="w-full max-w-6xl animate-in fade-in duration-500 no-print">
          <div className="mb-16">
            <h2 className="text-5xl font-black text-[#0f172a] tracking-tighter uppercase italic">The Library</h2>
            <div className="h-1.5 w-24 bg-[#0f172a] mt-6 rounded-full"></div>
          </div>
          {history.length === 0 ? (
            <div className="text-center py-40 bg-white rounded-[4rem] shadow-sm border border-slate-100">
              <h3 className="text-2xl font-black text-slate-200 uppercase tracking-[0.3em]">Your Shelf is Empty</h3>
              <Button variant="outline" className="mt-10 mx-auto" onClick={() => setView('home')}>Start First Manuscript</Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
              {history.map(b => (
                <div key={b.id} onClick={() => selectBook(b)} className="group cursor-pointer bg-white rounded-[2.5rem] p-5 shadow-sm hover:shadow-2xl transition-all duration-500 border border-slate-100 hover:-translate-y-2">
                  <div className="aspect-[3/4] overflow-hidden rounded-2xl mb-6 shadow-inner bg-slate-50">
                    <img src={b.coverImageUrl} alt={b.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" />
                  </div>
                  <h3 className="text-xl font-black text-slate-900 line-clamp-1 mb-2 uppercase tracking-tight italic">{b.title}</h3>
                  <div className="flex justify-between items-center mt-6">
                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{new Date(b.createdAt).toLocaleDateString()}</span>
                    <button onClick={(e) => deleteFromHistory(b.id, e)} className="text-red-300 hover:text-red-500 transition-colors p-2">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      )}

      {view === 'developer' && (
        <main className="w-full max-w-4xl flex flex-col items-center no-print mt-12 fade-in">
          <div className="w-full bg-white rounded-[4rem] p-12 md:p-20 shadow-2xl border border-slate-50 flex flex-col items-center text-center overflow-hidden relative">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-slate-100 via-[#0f172a] to-slate-100"></div>
            <div className="w-56 h-56 rounded-[3rem] overflow-hidden mb-12 shadow-2xl ring-12 ring-slate-50 grayscale hover:grayscale-0 transition-all duration-1000">
              <img src="https://raw.githubusercontent.com/gforg5/Nano-Lens/refs/heads/main/1769069098374.png" alt="Sayed Mohsin Ali" className="w-full h-full object-cover" />
            </div>
            <h2 className="text-6xl font-black text-slate-900 mb-2 tracking-tighter uppercase italic">Sayed Mohsin Ali</h2>
            <p className="text-xs font-black uppercase tracking-[0.5em] text-slate-400 mb-12">Architect • Systems Developer</p>
            <p className="text-xl text-slate-600 font-medium leading-relaxed mb-16 max-w-2xl serif-font italic">
              "Redefining the boundaries of digital creation through neural interfaces and minimalist structural design."
            </p>
          </div>
        </main>
      )}

      {view === 'book' && book && (
        <main className="w-full max-w-6xl fade-in pb-20">
          <div className="flex flex-col md:flex-row gap-16 items-start mb-40 no-print bg-white p-10 md:p-16 rounded-[4rem] shadow-2xl border border-slate-50">
            <div className="w-full md:w-5/12">
              <div className="aspect-[3/4] w-full rounded-[3rem] shadow-2xl overflow-hidden bg-slate-50 border-8 border-white">
                <img src={book.coverImageUrl} alt={book.title} className="w-full h-full object-cover" />
              </div>
            </div>
            <div className="w-full md:w-7/12 py-6">
              <span className="px-6 py-2 bg-[#0f172a] text-white text-[10px] font-black uppercase tracking-[0.4em] rounded-full">{book.genre}</span>
              <h2 className="text-6xl md:text-7xl font-black text-slate-900 serif-font mt-12 mb-10 leading-[0.9] tracking-tighter uppercase italic">{book.title}</h2>
              <p className="text-2xl text-slate-500 italic font-medium leading-relaxed mb-16 serif-font pl-10 border-l-8 border-slate-50">"{book.description}"</p>
              <div className="flex flex-col sm:flex-row gap-6 pt-12 border-t border-slate-100">
                <Button onClick={downloadPDF} isLoading={isExporting} className="flex-1 py-6 text-base">
                  {isExporting ? "Generating PDF..." : "Download PDF Manuscript"}
                </Button>
                <Button variant="secondary" onClick={() => exportJSON(book)} className="flex-1 py-6 text-base">Export Metadata</Button>
              </div>
            </div>
          </div>

          <div id="book-content" className="prose prose-2xl prose-slate max-w-4xl mx-auto serif-font px-4">
            <div className="hidden print:block mb-32 text-center h-[900px] flex flex-col justify-center items-center">
              <h1 className="text-8xl font-black uppercase italic tracking-tighter mb-8">{book.title}</h1>
              <p className="text-2xl uppercase tracking-[0.5em] text-slate-400">Published by BookMass Factory</p>
              <div className="mt-20 w-32 h-2 bg-black mx-auto"></div>
            </div>

            {book.chapters.map((chapter) => (
              <section key={chapter.id} id={`chapter-${chapter.id}`} className="mb-48 print:mb-0 print:page-break-before-always">
                <div className="flex flex-col items-center mb-24">
                   <span className="text-slate-200 font-black mb-6 uppercase tracking-[0.8em] text-[12px]">Chapter {chapter.id}</span>
                   <h3 className="text-7xl font-black text-slate-900 text-center tracking-tighter italic uppercase">{chapter.title}</h3>
                   <div className="w-24 h-1.5 bg-[#0f172a] mt-16 rounded-full shadow-lg"></div>
                </div>
                <div className="text-slate-800 leading-[2] text-xl md:text-2xl text-justify print:columns-1 print:text-black space-y-12">
                  {cleanContent(chapter.content).split('\n').map((para, i) => (
                    para.trim() ? <p key={i} className="first-letter:text-8xl first-letter:font-black first-letter:text-[#0f172a] first-letter:mr-5 first-letter:float-left first-letter:leading-[0.7]">{para}</p> : null
                  ))}
                </div>
              </section>
            ))}
          </div>
        </main>
      )}

      {view === 'about' && (
        <main className="w-full max-w-4xl animate-in fade-in duration-500 no-print">
          <div className="bg-white rounded-[4rem] p-16 md:p-24 shadow-2xl border border-slate-50">
            <h2 className="text-7xl font-black text-slate-900 mb-12 tracking-tighter uppercase italic">The Philosophy</h2>
            <div className="space-y-16 text-slate-600 font-medium text-xl leading-relaxed">
              <p className="text-4xl font-black text-slate-900 leading-[1.1] tracking-tight italic uppercase">BookMass is the brutalist architecture of digital authorship.</p>
              <p>We provide the structural scaffolding for human creativity. Every title is a seed; our engine provides the rich soil, the rain, and the time to grow it into a complete literary work in seconds.</p>
            </div>
            <div className="mt-24 flex justify-center">
              <Button onClick={() => setView('home')} className="px-16 py-8 text-lg">Enter Factory</Button>
            </div>
          </div>
        </main>
      )}

      <footer className="w-full py-16 flex flex-col items-center justify-center no-print mt-auto">
        <div className="group relative flex items-center justify-center h-14 w-full max-w-md">
          <div className="nav-pill px-10 py-3.5 rounded-full bg-white shadow-xl border border-slate-100 transition-all duration-300">
             <div className="relative flex items-center justify-center min-w-[140px] text-center">
                <span className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-400 group-hover:opacity-0 transition-opacity duration-500">
                  Made with ❤️ in PK
                </span>
                <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-500 text-[#0f172a] font-black uppercase tracking-[0.2em] text-[10px] whitespace-nowrap">
                  Pakhtunistan, KP
                </span>
             </div>
          </div>
        </div>
        <div className="mt-8 text-[9px] text-slate-300 font-black uppercase tracking-[0.8em]">BookMass SYSTEMS • 2025</div>
      </footer>
    </div>
  );
};

export default App;
