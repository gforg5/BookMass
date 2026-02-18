import React, { useState, useEffect } from 'react';
import { Book, GenerationStep, AppView } from './types';
import { generateBookOutline, generateChapterContent, generateCoverImage } from './services/geminiService';
import { Button } from './components/Button';

const App: React.FC = () => {
  const [titleInput, setTitleInput] = useState('');
  const [authorInput, setAuthorInput] = useState('');
  const [step, setStep] = useState<GenerationStep>('idle');
  const [view, setView] = useState<AppView>(() => {
    return (localStorage.getItem('bookmass_last_view') as AppView) || 'home';
  });
  const [book, setBook] = useState<Book | null>(() => {
    const saved = localStorage.getItem('bookmass_current_book');
    try {
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
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
    localStorage.setItem('bookmass_last_view', view);
    if (book) {
      localStorage.setItem('bookmass_current_book', JSON.stringify(book));
    } else {
      localStorage.removeItem('bookmass_current_book');
    }
  }, [view, book]);

  useEffect(() => {
    if (history.length > 0) {
      localStorage.setItem('bookmass_history', JSON.stringify(history));
    }
  }, [history]);

  const handleGenerate = async () => {
    if (!titleInput.trim() || !authorInput.trim()) return;

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
        authorInput,
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
        author: authorInput,
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
    return text
      .replace(/^(Chapter|CHAPTER|Section|SECTION)\s+\d+[:.]?.*$/gm, '')
      .replace(/^[#*].*$/gm, '')
      .trim();
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
      margin:       [0.75, 0.75],
      filename:     `${book.title.replace(/\s+/g, '_')}.pdf`,
      image:        { type: 'jpeg', quality: 1.0 },
      html2canvas:  { 
        scale: 2, 
        useCORS: true,
        logging: false,
        letterRendering: true,
        scrollY: 0,
        windowWidth: 1200
      },
      jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' },
      pagebreak:    { mode: ['avoid-all', 'css', 'legacy'], before: '.pdf-chapter' }
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

  const deleteFromHistory = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setHistory(prev => prev.filter(b => b.id !== id));
  };

  const selectBook = (b: Book) => {
    setBook(b);
    setStep('completed');
    setView('book');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goBack = () => {
    if (view === 'book') setView('history');
    else setView('home');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-start">
      {/* Navbar */}
      <div className="fixed top-4 md:top-6 z-50 w-full flex justify-center px-4 no-print">
        <nav className="nav-pill flex items-center rounded-full px-2 py-2 gap-1 border border-slate-100 bg-white/90 backdrop-blur-xl">
          {[
            { id: 'home', label: 'Writer', icon: <path d="M12 4v16m8-8H4" /> },
            { id: 'history', label: 'Vault', icon: <path d="M4 6h16M4 12h16M4 18h16" /> },
            { id: 'developer', label: 'Developer', icon: <path d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /> },
            { id: 'about', label: 'Info', icon: <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /> },
          ].map((nav) => (
            <button
              key={nav.id}
              onClick={() => { setView(nav.id as AppView); window.scrollTo(0,0); }}
              className={`flex items-center gap-2 px-3 md:px-5 py-2.5 rounded-full transition-all duration-500 text-[10px] md:text-xs font-black uppercase tracking-widest ${
                view === nav.id 
                  ? 'bg-[#0f172a] text-white shadow-xl scale-105' 
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">{nav.icon}</svg>
              <span className="hidden sm:inline">{nav.label}</span>
            </button>
          ))}
        </nav>
      </div>

      <div className="w-full mt-24 md:mt-32 px-4 md:px-12 flex flex-col items-center flex-1 max-w-7xl mx-auto">
        
        {view === 'home' && step === 'idle' && (
          <main className="w-full max-w-4xl flex flex-col items-center text-center py-6 md:py-12 animate-reveal no-print">
            <div className="w-12 h-12 bg-[#0f172a] text-white rounded-xl flex items-center justify-center shadow-2xl mb-6 animate-orbit">
               <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M11 2L6 7l1 1h8l1-1-5-5zM4 9v11a2 2 0 002 2h12a2 2 0 002-2V9H4zm11 8H9v-2h6v2z" /></svg>
            </div>
            <h1 className="text-[2.5rem] leading-[1.1] md:text-7xl lg:text-8xl font-black text-slate-900 mb-6 md:mb-8 tracking-tighter hero-gradient uppercase">
              BookMass <br className="hidden sm:block" />
              Faster Book Writer
            </h1>
            <p className="text-lg md:text-2xl text-slate-400 mb-8 md:mb-12 max-w-2xl font-medium serif-font italic px-4">
              "Input a title and author, generate a masterpiece. BookMass is the neural engine of modern authorship."
            </p>
            
            <div className="w-full max-w-2xl px-2 space-y-4">
              <div className="bg-white p-2 rounded-[1.5rem] md:rounded-[2.5rem] shadow-2xl border border-slate-50 flex flex-col gap-2 transition-all duration-700 hover:shadow-slate-200">
                <input 
                  type="text" 
                  placeholder="Masterpiece Title..."
                  className="flex-1 px-4 md:px-8 py-4 md:py-6 text-lg md:text-xl bg-transparent border-none focus:ring-0 outline-none font-bold placeholder:text-slate-200"
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                />
                <div className="h-px bg-slate-100 mx-4"></div>
                <input 
                  type="text" 
                  placeholder="Author Name..."
                  className="flex-1 px-4 md:px-8 py-4 md:py-6 text-lg md:text-xl bg-transparent border-none focus:ring-0 outline-none font-bold placeholder:text-slate-200"
                  value={authorInput}
                  onChange={(e) => setAuthorInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                />
                <Button 
                  className="py-4 md:py-6 px-8 md:px-10 text-base md:text-lg rounded-[1rem] md:rounded-[2rem] bg-[#0f172a] m-1"
                  onClick={handleGenerate}
                  isLoading={false}
                >
                  Create Book
                </Button>
              </div>
            </div>
          </main>
        )}

        {(step !== 'idle' && step !== 'completed' && step !== 'error' && view === 'home') && (
          <main className="w-full max-w-xl flex flex-col items-center text-center py-16 md:py-20 animate-reveal no-print">
            <div className="relative w-20 h-20 md:w-24 md:h-24 mb-8 md:mb-10">
               <div className="absolute inset-0 rounded-full border-4 border-slate-100"></div>
               <div className="absolute inset-0 rounded-full border-4 border-[#0f172a] border-t-transparent animate-spin"></div>
            </div>
            <h3 className="text-xl md:text-2xl font-black text-[#0f172a] mb-4 uppercase tracking-tighter italic px-4">
              {step === 'outlining' && "Synthesizing Structure"}
              {step === 'painting' && "Illustrating Canvas"}
              {step === 'writing' && "Generating Prose"}
            </h3>
            <div className="w-full max-w-md bg-slate-100 h-1.5 rounded-full overflow-hidden mb-6 mx-auto">
              <div className="bg-[#0f172a] h-full transition-all duration-700 ease-out" style={{ width: `${progress}%` }}></div>
            </div>
            <span className="text-[10px] font-black text-slate-300 tracking-[0.3em] uppercase">{Math.round(progress)}% Optimized</span>
          </main>
        )}

        {view === 'history' && (
          <main className="w-full animate-reveal no-print">
            <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between mb-10 md:mb-12 gap-4">
               <div>
                 <button onClick={goBack} className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300 hover:text-[#0f172a] mb-2 flex items-center gap-1 group">
                    <svg className="w-3 h-3 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" strokeWidth="4" viewBox="0 0 24 24"><path d="M10 19l-7-7m0 0l7-7" /></svg>
                    Writer
                 </button>
                 <h2 className="text-5xl md:text-6xl font-black text-[#0f172a] tracking-tighter uppercase italic">The Vault</h2>
               </div>
               <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{history.length} MANUSCRIPTS</span>
            </div>
            {history.length === 0 ? (
              <div className="text-center py-20 md:py-32 bg-white rounded-[2rem] md:rounded-[3rem] shadow-sm border border-slate-50 flex flex-col items-center justify-center px-4">
                <p className="text-slate-300 font-black uppercase tracking-widest mb-8 text-center">No Manuscripts Found</p>
                <Button variant="outline" onClick={() => setView('home')}>Generate First</Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
                {history.map(b => (
                  <div key={b.id} onClick={() => selectBook(b)} className="group cursor-pointer bg-white rounded-[2rem] p-4 shadow-xl hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 border border-slate-50">
                    <div className="aspect-[3/4] overflow-hidden rounded-[1.5rem] mb-6 shadow-inner bg-slate-50">
                      <img src={b.coverImageUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" />
                    </div>
                    <h3 className="text-lg md:text-xl font-black text-slate-900 line-clamp-1 mb-1 uppercase tracking-tight italic">{b.title}</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{b.author}</p>
                    <div className="flex justify-between items-center mt-4 md:mt-6">
                      <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{new Date(b.createdAt).toLocaleDateString()}</span>
                      <button onClick={(e) => deleteFromHistory(b.id, e)} className="text-slate-200 hover:text-red-500 transition-all p-2">
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
          <main className="w-full max-w-4xl flex items-center justify-center animate-reveal no-print h-full min-h-[60vh] md:min-h-[70vh]">
            <div className="relative w-full overflow-hidden bg-[#0f172a] rounded-[2rem] md:rounded-[3rem] p-6 md:p-12 shadow-2xl flex flex-col items-center text-center border border-white/5">
              <button 
                onClick={goBack} 
                className="absolute top-6 left-6 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-white/20 hover:text-white transition-all group z-20"
              >
                <svg className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" strokeWidth="4" viewBox="0 0 24 24"><path d="M10 19l-7-7m0 0l7-7" /></svg>
                BACK
              </button>
              
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
              
              <div className="mb-8 md:mb-12 pt-8 md:pt-4">
                 <h2 className="text-[10px] font-black text-white/30 uppercase tracking-[0.8em]">FULL STACK DEVELOPER</h2>
              </div>
              
              <div className="relative z-10 flex flex-col items-center w-full max-w-2xl">
                <div className="w-40 h-40 md:w-56 md:h-56 rounded-full p-1 border border-white/10 mb-8 md:mb-10 shadow-2xl overflow-hidden animate-orbit bg-[#0f172a]">
                  <div className="w-full h-full rounded-full overflow-hidden">
                    <img 
                      src="https://raw.githubusercontent.com/gforg5/Nano-Lens/refs/heads/main/1769069098374.png" 
                      alt="Sayed Mohsin Ali" 
                      className="w-full h-full object-contain scale-100" 
                    />
                  </div>
                </div>
                
                <h2 className="text-3xl sm:text-4xl md:text-7xl font-black text-white mb-2 tracking-tighter italic uppercase whitespace-nowrap overflow-hidden">
                   Sayed Mohsin Ali
                </h2>
                <p className="text-[10px] font-black uppercase tracking-[0.6em] md:tracking-[0.8em] text-slate-500 mb-8 md:mb-10">BookMass • Systems Developer</p>
                
                <p className="text-lg md:text-2xl text-slate-300 font-medium leading-relaxed max-w-xl serif-font italic px-4">
                  "Architecture is the bridge between human intent and machine execution."
                </p>
              </div>
            </div>
          </main>
        )}

        {view === 'about' && (
          <main className="w-full max-w-3xl animate-reveal no-print">
            <div className="bg-white rounded-[2.5rem] p-8 md:p-16 shadow-2xl border border-slate-50 relative overflow-hidden">
               <button onClick={goBack} className="absolute top-8 left-8 text-[10px] font-black uppercase tracking-[0.3em] text-slate-300 hover:text-[#0f172a] flex items-center gap-1 group">
                  <svg className="w-3 h-3 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" strokeWidth="4" viewBox="0 0 24 24"><path d="M10 19l-7-7m0 0l7-7" /></svg>
                  BACK
               </button>
               <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-10 mt-6 md:mt-0 tracking-tight italic uppercase">System Intel</h2>
               <div className="space-y-6 text-slate-500 font-medium text-base md:text-lg leading-relaxed serif-font">
                 <p className="text-2xl font-black text-slate-900 leading-tight uppercase italic mb-10 tracking-tighter">Instant authorship for the digital era.</p>
                 <p>BookMass operates on a proprietary neural expansion layer. Every title is treated as a semantic seed that our factory expands into a comprehensive literary structure.</p>
                 <p>From visual synthesis to contextual prose generation, the entire workflow is optimized for speed without sacrificing stylistic fidelity.</p>
               </div>
            </div>
          </main>
        )}

        {view === 'book' && book && (
          <main className="w-full animate-reveal">
            <div className="flex flex-col lg:flex-row gap-8 md:gap-12 items-start mb-16 md:mb-24 no-print bg-white p-6 md:p-12 rounded-[2.5rem] md:rounded-[3rem] shadow-2xl border border-slate-50 relative">
              <button 
                onClick={goBack} 
                className="absolute top-8 left-8 text-[10px] font-black uppercase tracking-[0.3em] text-slate-300 hover:text-[#0f172a] flex items-center gap-1 group z-10"
              >
                <svg className="w-3 h-3 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" strokeWidth="4" viewBox="0 0 24 24"><path d="M10 19l-7-7m0 0l7-7" /></svg>
                LIBRARY
              </button>
              
              <div className="w-full lg:w-5/12 mt-8 md:mt-0">
                <div className="aspect-[3/4] w-full rounded-[2rem] md:rounded-[2.5rem] shadow-2xl overflow-hidden ring-4 ring-white bg-slate-50">
                  <img src={book.coverImageUrl} className="w-full h-full object-cover" />
                </div>
              </div>
              <div className="w-full lg:w-7/12 py-4">
                <span className="inline-block px-4 py-1.5 bg-[#0f172a] text-white text-[9px] font-black uppercase tracking-[0.4em] rounded-full mb-8">
                  {book.genre}
                </span>
                <h2 className="text-4xl md:text-7xl font-black text-slate-900 serif-font leading-[1.1] md:leading-[0.9] tracking-tighter uppercase italic mb-2 break-words">{book.title}</h2>
                <p className="text-sm font-black text-slate-400 uppercase tracking-widest mb-8">By {book.author}</p>
                <p className="text-lg md:text-xl text-slate-400 italic font-medium leading-relaxed mb-10 md:mb-12 serif-font pl-6 md:pl-8 border-l-4 border-slate-100">
                  "{book.description}"
                </p>
                <div className="flex flex-col sm:flex-row gap-4 pt-8 border-t border-slate-50">
                  <Button onClick={downloadPDF} isLoading={isExporting} className="flex-1 py-4 md:py-5 shadow-2xl hover:scale-[1.02] text-xs">
                    {isExporting ? "Compiling PDF..." : "Get PDF Manuscript"}
                  </Button>
                  <Button variant="secondary" onClick={() => window.print()} className="flex-1 py-4 md:py-5 text-xs">Full Print</Button>
                </div>
              </div>
            </div>

            <div id="book-content" className="prose prose-lg md:prose-2xl prose-slate max-w-4xl mx-auto serif-font bg-white p-6 md:p-20 shadow-sm print:shadow-none rounded-[1.5rem] md:rounded-[2rem]">
              <div className="pdf-cover print:block hidden min-h-[900px] flex flex-col justify-center items-center text-center">
                 <h1 className="text-7xl font-black uppercase italic tracking-tighter mb-4">{book.title}</h1>
                 <p className="text-2xl font-bold uppercase tracking-[0.2em] mb-12">By {book.author}</p>
                 <p className="text-sm font-medium tracking-[0.8em] uppercase text-slate-300">A BookMass Original</p>
              </div>

              {book.chapters.map((chapter, idx) => {
                const paragraphs = cleanContent(chapter.content).split('\n').filter(p => p.trim());
                return (
                  <div key={chapter.id} className="pdf-chapter mb-24 md:mb-48 relative min-h-screen">
                    <div className="flex flex-col items-center mb-12 md:mb-16 text-center">
                       <span className="text-slate-400 font-black mb-4 uppercase tracking-[0.8em] text-xs opacity-100">CHAPTER {idx + 1}</span>
                       <h3 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tighter italic uppercase break-words px-4 leading-tight">{chapter.title}</h3>
                       <div className="w-16 h-1 bg-[#0f172a] mt-8 md:mt-12 rounded-full"></div>
                    </div>
                    <div className="text-slate-800 leading-[1.8] md:leading-[2] text-lg md:text-2xl text-justify space-y-8 md:space-y-10 px-2 md:px-0">
                      {paragraphs.map((para, i) => {
                        if (i === 0) {
                          const firstLetter = para.charAt(0);
                          const rest = para.substring(1);
                          return (
                            <p key={i} className="relative">
                              <span className="text-6xl md:text-8xl font-black text-[#0f172a] mr-4 float-left leading-[0.85] inline-block mt-2 h-full">
                                {firstLetter}
                              </span>
                              {rest}
                            </p>
                          );
                        }
                        return <p key={i}>{para}</p>;
                      })}
                    </div>
                    <div className="print:block hidden absolute bottom-0 left-0 right-0 text-center text-slate-300 text-[10px] font-black tracking-[0.5em] pb-8">
                      PAGE {idx + 1} • BookMass
                    </div>
                  </div>
                );
              })}
            </div>
          </main>
        )}
      </div>

      <footer className="w-full py-12 md:py-16 flex flex-col items-center justify-center no-print mt-auto">
        <div className="flex flex-col items-center gap-6 group">
           <div className="relative h-12 flex items-center justify-center min-w-[200px]">
              <div className="absolute inset-0 flex items-center justify-center transition-all duration-700 opacity-100 group-hover:opacity-0 group-hover:translate-y-2">
                 <span className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-400">
                    made with ❤️ in PK
                 </span>
              </div>
              <div className="absolute inset-0 flex items-center justify-center transition-all duration-700 opacity-0 -translate-y-2 group-hover:opacity-100 group-hover:translate-y-0">
                 <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#0f172a] whitespace-nowrap">
                    Pakhtunistan, Khyber Pakhtunkhwa
                 </span>
              </div>
           </div>
           
           <div className="w-24 h-[1px] bg-slate-100 rounded-full group-hover:w-40 group-hover:bg-[#0f172a] transition-all duration-700"></div>
           <div className="text-[9px] font-black uppercase tracking-[0.5em] text-slate-200 opacity-0 group-hover:opacity-100 transition-opacity duration-1000">
              EST. 2025 • GENESIS SERIES
           </div>
        </div>
      </footer>
    </div>
  );
};

export default App;